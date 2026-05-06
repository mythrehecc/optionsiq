import os
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app import db
from app.models import Statement, Trade, MonthlySummary, Order
from app.services.csv_parser import parse_thinkorswim_csv

statements_bp = Blueprint("statements", __name__)

ALLOWED_EXTENSIONS = {"csv"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@statements_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_statement():
    user_id = get_jwt_identity()

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Only .csv files are accepted"}), 400

    filename = secure_filename(file.filename)
    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, f"{user_id}_{filename}")
    file.save(file_path)

    # Parse CSV
    try:
        parse_result = parse_thinkorswim_csv(file_path)
    except Exception as e:
        return jsonify({"error": f"Parse error: {str(e)}"}), 422

    account_id = parse_result.get("account_id", "UNKNOWN")
    start_date = parse_result.get("start_date")
    end_date = parse_result.get("end_date")

    # Duplicate detection
    existing = Statement.query.filter_by(
        user_id=user_id, account_id=account_id,
        statement_start=start_date, statement_end=end_date
    ).first()

    replace = request.form.get("replace", "false").lower() == "true"
    if existing and not replace:
        return jsonify({
            "duplicate": True,
            "statement_id": existing.statement_id,
            "message": "Statement for this period already exists. Replace it?",
        }), 409

    if existing and replace:
        # Delete old data
        Trade.query.filter_by(statement_id=existing.statement_id).delete()
        MonthlySummary.query.filter_by(user_id=user_id, account_id=account_id).delete()
        db.session.delete(existing)
        db.session.flush()

    # Create statement record
    stmt = Statement(
        user_id=user_id,
        account_id=account_id,
        account_type=parse_result.get("account_type"),
        statement_start=start_date,
        statement_end=end_date,
        ending_balance=parse_result.get("ending_balance"),
        parse_status="complete",
        file_path=file_path,
        filename=filename,
        trade_count=len(parse_result.get("trades", [])),
        buying_power_total=parse_result.get("buying_power_total"),
        buying_power_remaining=parse_result.get("buying_power_remaining"),
    )
    db.session.add(stmt)
    db.session.flush()

    # Insert trades
    for t in parse_result.get("trades", []):
        trade = Trade(
            statement_id=stmt.statement_id,
            user_id=user_id,
            **t,
        )
        db.session.add(trade)
    
    # Insert orders
    order_stats = parse_result.get("order_stats", {})
    for o in order_stats.get("orders", []):
        order = Order(
            statement_id=stmt.statement_id,
            user_id=user_id,
            order_date=o["date"],
            status=o["status"]
        )
        db.session.add(order)

    # Rebuild monthly summary for this account
    _rebuild_monthly_summary(user_id, account_id)

    db.session.commit()

    return jsonify({
        "statement_id": stmt.statement_id,
        "account_id": account_id,
        "trade_count": stmt.trade_count,
        "statement_start": start_date.isoformat() if start_date else None,
        "statement_end": end_date.isoformat() if end_date else None,
        "parse_status": "complete",
    }), 201


@statements_bp.route("/", methods=["GET"])
@jwt_required()
def list_statements():
    user_id = get_jwt_identity()
    stmts = Statement.query.filter_by(user_id=user_id).order_by(Statement.statement_end.desc()).all()
    return jsonify({"statements": [s.to_dict() for s in stmts]}), 200


@statements_bp.route("/<statement_id>/trades", methods=["GET"])
@jwt_required()
def get_trades(statement_id):
    user_id = get_jwt_identity()
    trades = Trade.query.filter_by(statement_id=statement_id, user_id=user_id).order_by(Trade.trade_date.desc()).all()
    return jsonify({"trades": [t.to_dict() for t in trades]}), 200


@statements_bp.route("/<statement_id>", methods=["DELETE"])
@jwt_required()
def delete_statement(statement_id):
    user_id = get_jwt_identity()
    stmt = Statement.query.filter_by(statement_id=statement_id, user_id=user_id).first()
    if not stmt:
        return jsonify({"error": "Statement not found"}), 404

    account_id = stmt.account_id
    db.session.delete(stmt)
    db.session.flush()

    # Rebuild MoM for this account
    MonthlySummary.query.filter_by(user_id=user_id, account_id=account_id).delete()
    _rebuild_monthly_summary(user_id, account_id)

    db.session.commit()
    return jsonify({"message": "Statement deleted"}), 200


def _rebuild_monthly_summary(user_id: str, account_id: str):
    """Aggregate trades into monthly_summaries for all statements of this account."""
    from sqlalchemy import func, extract
    from datetime import date

    # Get all trades for this user+account
    trades = Trade.query.filter_by(user_id=user_id).join(Statement).filter(
        Statement.account_id == account_id
    ).all()

    from collections import defaultdict
    monthly: dict = defaultdict(lambda: {
        "premium_collected": 0.0,
        "losses_realized": 0.0,
        "assignment_costs": 0.0,
        "total_fees": 0.0,
        "net_pnl": 0.0,
        "total_fills": 0,
        "ending_balance": None,
        "assignment_count": 0,
        "total_options_placed": 0,
        "total_active_orders": 0,
        "total_cancelled_orders": 0,
        "total_closed_orders": 0,
        "commissions_paid": 0.0,
    })

    for t in trades:
        key = date(t.trade_date.year, t.trade_date.month, 1)
        m = monthly[key]
        amount = float(t.gross_amount)
        comm = float(t.commissions or 0)
        fees = comm + float(t.misc_fees or 0)
        if t.trade_type == "EXP":
            m["assignment_costs"] += amount
            m["assignment_count"] += 1
        elif amount > 0:
            m["premium_collected"] += amount
        else:
            m["losses_realized"] += amount
        m["total_fees"] += fees
        m["commissions_paid"] += comm
        m["total_fills"] += 1
        if t.running_balance is not None:
            m["ending_balance"] = float(t.running_balance)

    # Aggregated orders for this account
    orders = Order.query.filter_by(user_id=user_id).join(Statement).filter(
        Statement.account_id == account_id
    ).all()
    for o in orders:
        if not o.order_date: continue
        key = date(o.order_date.year, o.order_date.month, 1)
        m = monthly[key]
        m["total_options_placed"] += 1
        status = (o.status or "").upper()
        if "CANCEL" in status:
            m["total_cancelled_orders"] += 1
        elif "FILL" in status:
            m["total_closed_orders"] += 1
        else:
            m["total_active_orders"] += 1

    for key, m in monthly.items():
        m["net_pnl"] = m["premium_collected"] + m["losses_realized"] + m["assignment_costs"] - m["total_fees"]
        summary = MonthlySummary(
            user_id=user_id,
            account_id=account_id,
            month_year=key,
            **m,
        )
        db.session.add(summary)
