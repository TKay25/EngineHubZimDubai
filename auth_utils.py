"""Session-based authentication helpers for the JSON API."""
import re
from functools import wraps

from flask import jsonify, session

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalise_phone(raw):
    """Return digits only, matching WhatsApp wa_id style (country code first)."""
    if not raw:
        return None
    digits = re.sub(r"[^\d]", "", str(raw))
    if not digits:
        return None
    if digits.startswith("0") and len(digits) >= 9:
        digits = "263" + digits[1:]
    return digits


def valid_phone(raw):
    phone = normalise_phone(raw)
    return bool(phone and 9 <= len(phone) <= 15)


def login_user(user):
    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["is_admin"] = user.is_admin


def logout_user():
    session.clear()


def current_user():
    from models import User, db

    uid = session.get("user_id")
    if not uid:
        return None
    return db.session.get(User, uid)


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Please sign in to continue."}), 401
        return view(*args, **kwargs)

    return wrapper


def admin_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Please sign in to continue."}), 401
        if not session.get("is_admin"):
            return jsonify({"error": "Administrator access required."}), 403
        return view(*args, **kwargs)

    return wrapper


def api_error(message, status=400):
    return jsonify({"error": message}), status
