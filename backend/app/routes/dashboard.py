from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Trade, Statement, MonthlySummary
from app.services.risk_engine import generate_alerts
from app import db
from datetime import date, datetime
from collections import defaultdict

dashboard_bp = Blueprint("dashboard", __name__)


def _get_account_and_user(request, user_id):
    account_id = request.args.get("account_id")
    return account_id


@dashboard_bp.route("/accounts", methods=["GET"])
@jwt_required()
def get_accounts():
    """List all distinct account_ids for this user."""
    user_id = get_jwt_identity()
    results = db.session.query(Statement.account_id, Statement.account_type).filter_by(
        user_id=user_id
    ).distinct().all()
    accounts = [{"account_id": r[0], "account_type": r[1]} for r in results]
    return jsonify({"accounts": accounts}), 200


@dashboard_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_summary():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")

    # Get most recent statement
    q = Statement.query.filter_by(user_id=user_id)
    if statement_id:
        q = q.filter_by(statement_id=statement_id)
    elif account_id:
        q = q.filter_by(account_id=account_id)
    latest_stmt = q.order_by(Statement.statement_end.desc()).first()

    if not latest_stmt:
        return jsonify({"summary": {}, "message": "No statements uploaded yet"}), 200

    # Get trades for the period
    tq = Trade.query.filter_by(user_id=user_id, statement_id=latest_stmt.statement_id)
    trades = tq.all()

    # Premium collected = Premium amount * quantity for all credit trades
    premium = sum(float(t.premium_per_contract or 0) * abs(float(t.contracts or 0)) *100 for t in trades 
                  if t.trade_type == "TRD" and float(t.gross_amount) > 0)
    # Net premium = Add all credits - Subtract all debits (commissions, fees, premiums paid)
    credits = sum(float(t.gross_amount) for t in trades if t.trade_type == "TRD" and float(t.gross_amount) > 0)
    debits = sum(abs(float(t.gross_amount)) for t in trades if t.trade_type == "TRD" and float(t.gross_amount) < 0)
    fees = sum(float(t.commissions or 0) + float(t.misc_fees or 0) for t in trades)
    net_pnl = credits - debits + fees
    tickers = len(set(t.ticker for t in trades))

    # Prior month balance
    prior = Statement.query.filter_by(user_id=user_id)
    if account_id:
        prior = prior.filter_by(account_id=account_id)
    prior = prior.filter(Statement.statement_end < latest_stmt.statement_start).order_by(
        Statement.statement_end.desc()
    ).first()
    prior_balance = float(prior.ending_balance) if prior and prior.ending_balance else None
    current_balance = float(latest_stmt.ending_balance) if latest_stmt.ending_balance else None
    balance_delta = (current_balance - prior_balance) if (current_balance and prior_balance) else None

    return jsonify({
        "summary": {
            "cash_balance": current_balance,
            "opening_cash_balance": prior_balance,
            "balance_delta": balance_delta,
            "net_pnl": net_pnl,
            "premium_collected": premium,
            "total_fees": fees,
            "fee_pct_of_premium": round(fees / premium * 100, 2) if premium else 0,
            "tickers_traded": tickers,
            "period_start": latest_stmt.statement_start.isoformat(),
            "period_end": latest_stmt.statement_end.isoformat(),
            "account_id": latest_stmt.account_id,
            "buying_power_total": float(latest_stmt.buying_power_total) if latest_stmt.buying_power_total else None,
            "buying_power_remaining": float(latest_stmt.buying_power_remaining) if latest_stmt.buying_power_remaining else None,
        }
    }), 200


@dashboard_bp.route("/positions", methods=["GET"])
@jwt_required()
def get_positions():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 15, type=int)
    today = date.today()

    # Get open positions: trades with future expiration dates
    q = Trade.query.filter_by(user_id=user_id).filter(
        Trade.expiration_date >= today,
        Trade.trade_type == "TRD"
    )
    if statement_id:
        q = q.filter_by(statement_id=statement_id)
    elif account_id:
        q = q.join(Statement).filter(Statement.account_id == account_id)

    pagination = q.order_by(Trade.expiration_date.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    trades = pagination.items

    positions = []
    for t in trades:
        dte = (t.expiration_date - today).days if t.expiration_date else None
        risk = "High" if dte is not None and dte < 7 else ("Medium" if dte is not None and dte <= 21 else "Low")
        positions.append({
            **t.to_dict(),
            "dte": dte,
            "risk_level": risk,
        })

    return jsonify({
        "positions": positions,
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages
    }), 200


@dashboard_bp.route("/alerts", methods=["GET"])
@jwt_required()
def get_alerts():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")

    q = Trade.query.filter_by(user_id=user_id)
    if statement_id:
        q = q.filter_by(statement_id=statement_id)
    elif account_id:
        q = q.join(Statement).filter(Statement.account_id == account_id)

    trades = q.all()
    alerts = generate_alerts(trades)
    return jsonify({"alerts": alerts}), 200


@dashboard_bp.route("/mom", methods=["GET"])
@jwt_required()
def get_mom():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")
    from_date = request.args.get("from")
    to_date = request.args.get("to")

    if statement_id:
        # Dynamically aggregate from Trade
        trades = Trade.query.filter_by(statement_id=statement_id, user_id=user_id).all()
        monthly = defaultdict(lambda: {
            "premium_collected": 0.0, "losses_realized": 0.0, "assignment_costs": 0.0,
            "total_fees": 0.0, "net_pnl": 0.0, "total_fills": 0, "ending_balance": None, "assignment_count": 0,
            "total_options_placed": 0, "total_active_orders": 0, "total_cancelled_orders": 0, "total_closed_orders": 0,
            "commissions_paid": 0.0
        })
        for t in trades:
            key = date(t.trade_date.year, t.trade_date.month, 1)
            if from_date and key.isoformat() < from_date: continue
            if to_date and key.isoformat() > to_date: continue
            m = monthly[key]
            amount = float(t.gross_amount)
            comm = float(t.commissions or 0)
            fees = comm + float(t.misc_fees or 0)
            if t.trade_type == "EXP":
                m["assignment_costs"] += amount
                m["assignment_count"] += 1
            elif amount > 0:
                # Premium collected = Premium amount * quantity
                premium_amount = float(t.premium_per_contract or 0) * abs(float(t.contracts or 0))
                m["premium_collected"] += premium_amount
            else:
                m["losses_realized"] += amount
            m["total_fees"] += fees
            m["commissions_paid"] += comm
            m["total_fills"] += 1
            if t.running_balance is not None:
                m["ending_balance"] = float(t.running_balance)
        
        # Aggregated orders for this statement
        from app.models import Order
        orders = Order.query.filter_by(statement_id=statement_id, user_id=user_id).all()
        for o in orders:
            if not o.order_date: continue
            key = date(o.order_date.year, o.order_date.month, 1)
            if from_date and key.isoformat() < from_date: continue
            if to_date and key.isoformat() > to_date: continue
            m = monthly[key]
            m["total_options_placed"] += 1
            status = (o.status or "").upper()
            if "CANCEL" in status:
                m["total_cancelled_orders"] += 1
            elif "FILL" in status:
                m["total_closed_orders"] += 1
            else:
                m["total_active_orders"] += 1
        
        result = []
        for key in sorted(monthly.keys()):
            m = monthly[key]
            # Net P&L = credits - debits - fees (already calculated correctly above)
            # losses_realized already contains negative values (debits)
            # assignment_costs are also negative values
            m["net_pnl"] = m["premium_collected"] + m["losses_realized"] + m["assignment_costs"] +m["total_fees"]
            result.append({
                "summary_id": "dynamic",
                "account_id": account_id or "UNKNOWN",
                "month_year": key.isoformat(),
                **m
            })
        return jsonify({"mom": result}), 200

    q = MonthlySummary.query.filter_by(user_id=user_id)
    if account_id:
        q = q.filter_by(account_id=account_id)
    if from_date:
        q = q.filter(MonthlySummary.month_year >= from_date)
    if to_date:
        q = q.filter(MonthlySummary.month_year <= to_date)

    summaries = q.order_by(MonthlySummary.month_year.asc()).all()
    return jsonify({"mom": [s.to_dict() for s in summaries]}), 200


@dashboard_bp.route("/ticker-pnl", methods=["GET"])
@jwt_required()
def get_ticker_pnl():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")

    q = Trade.query.filter_by(user_id=user_id, trade_type="TRD")
    if statement_id:
        q = q.filter_by(statement_id=statement_id)
    elif account_id:
        q = q.join(Statement).filter(Statement.account_id == account_id)

    trades = q.all()
    ticker_map: dict = defaultdict(float)
    for t in trades:
        ticker_map[t.ticker] += float(t.gross_amount)

    result = [{"ticker": k, "pnl": round(v, 2)} for k, v in ticker_map.items()]
    result.sort(key=lambda x: x["pnl"], reverse=True)
    return jsonify({"ticker_pnl": result}), 200


@dashboard_bp.route("/strategy-pnl", methods=["GET"])
@jwt_required()
def get_strategy_pnl():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id")
    statement_id = request.args.get("statement_id")

    q = Trade.query.filter_by(user_id=user_id, trade_type="TRD")
    if statement_id:
        q = q.filter_by(statement_id=statement_id)
    elif account_id:
        q = q.join(Statement).filter(Statement.account_id == account_id)

    trades = q.all()
    strategy_map: dict = defaultdict(float)
    for t in trades:
        key = t.strategy or "Other"
        strategy_map[key] += float(t.gross_amount)

    result = [{"strategy": k, "pnl": round(v, 2)} for k, v in strategy_map.items()]
    result.sort(key=lambda x: x["pnl"], reverse=True)
    return jsonify({"strategy_pnl": result}), 200
