from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from app import db, bcrypt
from app.models import User
import re

auth_bp = Blueprint("auth", __name__)

# Blocklist for signed-out tokens (in-memory for dev; use Redis in prod)
token_blocklist = set()


def validate_password(password: str) -> bool:
    """Min 8 chars, 1 uppercase, 1 number."""
    return (
        len(password) >= 8
        and any(c.isupper() for c in password)
        and any(c.isdigit() for c in password)
    )


@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email = data.get("email", "").strip().lower()
    full_name = data.get("full_name", "").strip()
    password = data.get("password", "")

    # Validations
    if not email or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email address"}), 422
    if not full_name:
        return jsonify({"error": "Full name is required"}), 422
    if not validate_password(password):
        return jsonify({
            "error": "Password must be at least 8 characters with 1 uppercase letter and 1 number"
        }), 422

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Account already exists — sign in instead."}), 409

    hashed = bcrypt.generate_password_hash(password, rounds=12).decode("utf-8")
    user = User(email=email, full_name=full_name, password_hash=hashed)
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=user.user_id)
    refresh_token = create_refresh_token(identity=user.user_id)

    return jsonify({
        "user": user.to_dict(),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 201


@auth_bp.route("/signin", methods=["POST"])
def signin():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email, is_active=True).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    access_token = create_access_token(identity=user.user_id)
    refresh_token = create_refresh_token(identity=user.user_id)

    return jsonify({
        "user": user.to_dict(),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    # Rotate: block the old refresh token
    jti = get_jwt()["jti"]
    token_blocklist.add(jti)
    access_token = create_access_token(identity=identity)
    new_refresh = create_refresh_token(identity=identity)
    return jsonify({"access_token": access_token, "refresh_token": new_refresh}), 200


@auth_bp.route("/signout", methods=["POST"])
@jwt_required()
def signout():
    jti = get_jwt()["jti"]
    token_blocklist.add(jti)
    return jsonify({"message": "Signed out successfully"}), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    # Always return 200 to prevent email enumeration
    return jsonify({"message": "If that email exists, a reset link has been sent."}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200
