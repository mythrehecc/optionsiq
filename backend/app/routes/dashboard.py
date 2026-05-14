from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Trade, Statement
from datetime import date
from collections import defaultdict
from app.services.csv_parser import _extract_expiry_date
import math

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/mom", methods=["GET"])
@jwt_required()
def get_mom():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")

    query = Trade.query.filter_by(user_id=user_id).join(Statement)
    if statement_id and statement_id != "undefined":
        query = query.filter(Statement.statement_id == statement_id)
    elif account_id and account_id != "undefined":
        query = query.filter(Statement.account_id == account_id)
    
    trades = query.all()
    
    expiry_buckets = defaultdict(float)

    for t in trades:
        # 1. GROUPING: Use the LAST date in description (destination expiry)
        raw_date = _extract_expiry_date(t.description)
        target_month = date(raw_date.year, raw_date.month, 1) if raw_date else None
        
        if target_month:
            # 2. CONSISTENCY: Use the gross_amount column 
            # (which our parser already set as unit * price * 100 * sign)
            val = float(t.gross_amount or 0.0)
            if val > 0:
                expiry_buckets[target_month] += val
    
    result = []
    for d in sorted(expiry_buckets.keys()):
        result.append({
            "month_year": d.isoformat(),
            "premium_collected": expiry_buckets[d]
        })
    
    return jsonify({"mom": result}), 200

@dashboard_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_summary():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")
    
    query = Trade.query.filter_by(user_id=user_id).join(Statement)
    statement_query = Statement.query.filter_by(user_id=user_id)
    
    if statement_id and statement_id != "undefined":
        query = query.filter(Statement.statement_id == statement_id)
        statement_query = statement_query.filter_by(statement_id=statement_id)
    elif account_id and account_id != "undefined":
        query = query.filter(Statement.account_id == account_id)
        statement_query = statement_query.filter_by(account_id=account_id)
        
    trades = query.all()

    # CONSISTENCY: Sum the gross_amount column directly (only positive collected premiums)
    total_premium = sum(float(t.gross_amount or 0.0) for t in trades if float(t.gross_amount or 0.0) > 0)
    
    latest = statement_query.order_by(Statement.statement_end.desc()).first()

    return jsonify({
        "summary": {
            "premium_collected": total_premium,
            "tickers_traded": len(set(t.ticker for t in trades)),
            "buying_power_total": float(latest.buying_power_total) if latest else 0,
            "buying_power_remaining": float(latest.buying_power_remaining) if latest else 0,
            "account_id": latest.account_id if latest else account_id,
        }
    }), 200

@dashboard_bp.route("/positions", methods=["GET"])
@jwt_required()
def get_positions():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)

    query = Trade.query.filter_by(user_id=user_id).join(Statement)
    if statement_id and statement_id != "undefined":
        query = query.filter(Statement.statement_id == statement_id)
    elif account_id and account_id != "undefined":
        query = query.filter(Statement.account_id == account_id)

    # Fetch ALL options trade records (no expiry date filter — show all positions)
    all_trades = query.filter(Trade.trade_type == "TRD").all()

    today = date.today()

    # Risk priority sort: soonest expiry first (High DTE ≤10, Medium ≤20, Low >20)
    def risk_sort_key(t):
        if not t.expiration_date:
            return (3, 9999)
        dte = (t.expiration_date - today).days
        if dte <= 0:
            priority = 0   # expired — show at top as highest priority
        elif dte <= 10:
            priority = 1
        elif dte <= 20:
            priority = 2
        else:
            priority = 3
        return (priority, dte)

    sorted_trades = sorted(all_trades, key=risk_sort_key)
    total = len(sorted_trades)
    start = (page - 1) * per_page
    page_trades = sorted_trades[start: start + per_page]

    positions = []
    for t in page_trades:
        dte = (t.expiration_date - today).days if t.expiration_date else None
        if dte is not None:
            if dte <= 10:
                risk_level = "High"
            elif dte <= 20:
                risk_level = "Medium"
            else:
                risk_level = "Low"
        else:
            risk_level = "Low"

        trade_dict = t.to_dict()
        trade_dict["risk_level"] = risk_level
        trade_dict["dte"] = dte
        positions.append(trade_dict)

    pages = math.ceil(total / per_page) if per_page > 0 else 1
    return jsonify({
        "positions": positions,
        "total": total,
        "pages": pages,
        "current_page": page
    }), 200


@dashboard_bp.route("/daily", methods=["GET"])
@jwt_required()
def get_daily():
    """Date-based premium bucketing — groups premium by exact expiry date."""
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")

    query = Trade.query.filter_by(user_id=user_id).join(Statement)
    if statement_id and statement_id != "undefined":
        query = query.filter(Statement.statement_id == statement_id)
    elif account_id and account_id != "undefined":
        query = query.filter(Statement.account_id == account_id)

    trades = query.all()
    date_buckets = defaultdict(float)

    for t in trades:
        raw_date = _extract_expiry_date(t.description)
        if raw_date:
            val = float(t.gross_amount or 0.0)
            if val > 0:
                date_buckets[raw_date] += val

    result = [
        {"expiry_date": d.isoformat(), "premium_collected": round(date_buckets[d], 2)}
        for d in sorted(date_buckets.keys())
    ]
    return jsonify({"daily": result}), 200