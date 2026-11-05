"""Authentication + account API."""
import re

from flask import Blueprint, current_app, jsonify, request, session

from auth_utils import (
    EMAIL_RE,
    api_error,
    current_user,
    login_required,
    login_user,
    logout_user,
    normalise_phone,
    valid_phone,
)
from config import get_settings
from models import User, db

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _payload():
    return request.get_json(silent=True) or {}


@bp.get("/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"user": None})
    return jsonify({"user": user.to_dict()})


@bp.post("/register")
def register():
    data = _payload()
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not EMAIL_RE.match(email):
        return api_error("Enter a valid email address.")
    if len(name) < 2:
        return api_error("Please enter your full name.")
    if not valid_phone(phone):
        return api_error("Enter a valid mobile number (e.g. 0771 234 567).")
    if len(password) < 8:
        return api_error("Password must be at least 8 characters.")

    if User.query.filter_by(email=email).first():
        return api_error("An account with that email already exists.")

    user = User(email=email, name=name, phone=normalise_phone(phone))
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return jsonify({"user": user.to_dict()}), 201


@bp.post("/login")
def login():
    data = _payload()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return api_error("Invalid email or password.", 401)
    login_user(user)
    return jsonify({"user": user.to_dict()})


@bp.post("/logout")
def logout():
    logout_user()
    return jsonify({"ok": True})


@bp.patch("/profile")
@login_required
def update_profile():
    data = _payload()
    user = current_user()
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    if len(name) < 2:
        return api_error("Please enter your full name.")
    if phone and not valid_phone(phone):
        return api_error("Enter a valid mobile number.")
    user.name = name
    if phone:
        user.phone = normalise_phone(phone)
    if data.get("password"):
        if len(data["password"]) < 8:
            return api_error("Password must be at least 8 characters.")
        user.set_password(data["password"])
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@bp.get("/session-info")
def session_info():
    """Non-sensitive brand/support config for the React app."""
    settings = get_settings()
    return jsonify(
        {
            "company_name": settings.company_name,
            "tagline": settings.tagline,
            "phone": settings.phone,
            "email": settings.email,
            "address": settings.address,
            "office_hours": settings.office_hours,
            "whatsapp": settings.whatsapp,
            "whatsapp_configured": bool(
                current_app.config["WHATSAPP_ACCESS_TOKEN"]
                and current_app.config["WHATSAPP_PHONE_NUMBER_ID"]
            ),
            "paynow_configured": bool(
                current_app.config["PAYNOW_INTEGRATION_ID"]
                and current_app.config["PAYNOW_INTEGRATION_KEY"]
            ),
        }
    )
