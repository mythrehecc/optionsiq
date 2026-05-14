import os
import re
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app import db
from app.models import Statement, Trade, MonthlySummary, Order
from app.services.csv_parser import parse_thinkorswim_csv, _extract_expiry_date
from datetime import date
from collections import defaultdict

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
            "message": "Statement already exists. Replace it?",
        }), 409

    if existing and replace:
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
        buying_power_total=parse_result.get("buying_power_total", 0.0),
        buying_power_remaining=parse_result.get("buying_power_remaining", 0.0)
    )
    db.session.add(stmt)
    db.session.flush()

    # Insert trades
    for t in parse_result.get("trades", []):
        db.session.add(Trade(statement_id=stmt.statement_id, user_id=user_id, **t))
    
    # Rebuild monthly summary
    _rebuild_monthly_summary(user_id, account_id)
    db.session.commit()

    return jsonify({
        "message": "Upload successful", 
        "account_id": account_id,
        "statement_id": stmt.statement_id,
        "trade_count": len(parse_result.get("trades", []))
    }), 201

def _rebuild_monthly_summary(user_id: str, account_id: str):
    """Summing Premium strictly by the FIRST Expiry Date found in description."""
    
    # 1. Clear old data for this account
    MonthlySummary.query.filter_by(user_id=user_id, account_id=account_id).delete()
    db.session.flush()

    # 2. Get all trades
    trades = Trade.query.filter_by(user_id=user_id).join(Statement).filter(
        Statement.account_id == account_id
    ).all()

    # 3. Create buckets for Premium
    monthly_premium = defaultdict(float)

    for t in trades:
        # AUTHORITY RULE: Group by the FIRST expiry date found in the description text
        first_expiry = _extract_expiry_date(t.description)
        
        if not first_expiry:
            continue
            
        # Group by the 1st of the month (e.g., May 15 and May 20 both go to May 1)
        bucket_date = date(first_expiry.year, first_expiry.month, 1)

        # STRICT MATH: Use parsed gross_amount (only sum positive credits)
        val = float(t.gross_amount or 0.0)
        if val > 0:
            monthly_premium[bucket_date] += val

    # 4. Save to Database (Wiping out P&L words)
    for key_date, total_val in monthly_premium.items():
        summary = MonthlySummary(
            user_id=user_id,
            account_id=account_id,
            month_year=key_date,
            premium_collected=total_val,  # This is your main number
            net_pnl=0.0,                  # Set to 0 to remove the word P&L from logic
            losses_realized=0.0,
            assignment_costs=0.0,
            total_fees=0.0
        )
        db.session.add(summary)

@statements_bp.route("/", methods=["GET"])
@jwt_required()
def list_statements():
    user_id = get_jwt_identity()
    statements = Statement.query.filter_by(user_id=user_id).order_by(Statement.uploaded_at.desc()).all()
    return jsonify({"statements": [s.to_dict() for s in statements]}), 200

@statements_bp.route("/<statement_id>/trades", methods=["GET"])
@jwt_required()
def get_statement_trades(statement_id):
    user_id = get_jwt_identity()
    stmt = Statement.query.filter_by(statement_id=statement_id, user_id=user_id).first()
    if not stmt:
        return jsonify({"error": "Statement not found"}), 404
    
    trades = Trade.query.filter_by(statement_id=statement_id, user_id=user_id).order_by(Trade.trade_date).all()
    return jsonify({"trades": [t.to_dict() for t in trades]}), 200

@statements_bp.route("/<statement_id>", methods=["DELETE"])
@jwt_required()
def delete_statement(statement_id):
    user_id = get_jwt_identity()
    stmt = Statement.query.filter_by(statement_id=statement_id, user_id=user_id).first()
    if not stmt:
        return jsonify({"error": "Statement not found"}), 404
    
    account_id = stmt.account_id
    
    Trade.query.filter_by(statement_id=statement_id).delete()
    db.session.delete(stmt)
    db.session.flush()
    
    # Rebuild monthly summary
    _rebuild_monthly_summary(user_id, account_id)
    db.session.commit()
    
    return jsonify({"message": "Statement deleted successfully"}), 200