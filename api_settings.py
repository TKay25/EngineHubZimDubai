"""Public site settings + admin management of catalog and company settings."""
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request

from auth_utils import admin_required, api_error
from config import get_settings
from models import Engine, db

bp = Blueprint("settings_api", __name__, url_prefix="/api")

ENGINE_FIELDS = {
    "make": str,
    "model_code": str,
    "title": str,
    "displacement_cc": int,
    "fuel": str,
    "cylinders": int,
    "transmission": str,
    "condition": str,
    "condition_grade": str,
    "warranty_days": int,
    "warranty_note": str,
    "typical_lead_days": int,
    "guide_price_usd": "decimal",
    "description": str,
    "includes": str,
    "fits_vehicles": str,
    "image_url": str,
    "sourcing_available": bool,
    "featured": bool,
}

SETTINGS_TEXT_FIELDS = [
    "company_name",
    "tagline",
    "phone",
    "whatsapp",
    "email",
    "address",
    "office_hours",
    "bank_details",
    "paynow_note",
    "registration_number",
    "warranty_summary",
    "inspection_process",
]
SETTINGS_RATE_FIELDS = [
    "duty_rate",
    "vat_rate",
    "surtax_rate",
    "default_freight_pct",
    "insurance_pct",
]
SETTINGS_AMOUNT_FIELDS = [
    "default_freight_min",
    "default_clearing",
    "default_inland",
    "default_deposit_pct",
]


@bp.get("/site")
def site():
    """Business identity/contact block used by the public website and widget."""
    settings = get_settings()
    data = settings.to_dict()
    data["payment_methods"] = [
        {"value": "paynow", "label": "Paynow (EcoCash, OneMoney, ZIPIT, Visa/MC)"},
        {"value": "bank_transfer", "label": "Bank transfer / RTGS"},
        {"value": "cash_on_delivery", "label": "Cash on delivery"},
    ]
    data["whatsapp_link"] = (
        f"https://wa.me/{settings.whatsapp}" if settings.whatsapp else None
    )
    data["catalog_size"] = Engine.query.filter_by(sourcing_available=True).count()
    return jsonify({"site": data})


@bp.get("/admin/settings")
@admin_required
def read_settings():
    return jsonify({"settings": get_settings().to_dict()})


@bp.patch("/admin/settings")
@admin_required
def update_settings():
    data = request.get_json(silent=True) or {}
    settings = get_settings()
    for field in SETTINGS_TEXT_FIELDS:
        if field in data:
            value = (data.get(field) or "").strip()
            setattr(settings, field, value or None)
    if not settings.company_name:
        return api_error("Company name is required.")
    try:
        for field in SETTINGS_RATE_FIELDS + SETTINGS_AMOUNT_FIELDS:
            if field in data and data[field] not in (None, ""):
                setattr(settings, field, Decimal(str(data[field])))
        for field in ("orders_fulfilled", "established_year"):
            if field in data and data[field] not in (None, ""):
                setattr(settings, field, int(data[field]))
    except (InvalidOperation, ValueError):
        return api_error("Rates and amounts must be numbers.")
    if float(settings.default_freight_pct or 0) > 5:
        return api_error("Freight percentage looks wrong (0.12 means 12%).")
    if not 0 <= float(settings.default_deposit_pct or 0) <= 100:
        return api_error("Deposit percentage must be between 0 and 100.")
    db.session.commit()
    return jsonify({"settings": settings.to_dict()})


def _clean_engine(payload, engine=None):
    engine = engine or Engine()
    for field, kind in ENGINE_FIELDS.items():
        if field not in payload:
            continue
        raw = payload[field]
        try:
            if kind == bool:
                value = raw in (True, "true", "on", 1, "1")
            elif kind == int:
                value = int(raw) if raw not in (None, "") else None
            elif kind == "decimal":
                value = Decimal(str(raw))
            else:
                value = (str(raw).strip() or None)
        except (TypeError, ValueError, InvalidOperation):
            raise ValueError(field)
        setattr(engine, field, value)
    return engine


@bp.get("/admin/engines")
@admin_required
def list_all_engines():
    engines = Engine.query.order_by(Engine.make.asc(), Engine.model_code.asc()).all()
    return jsonify({"engines": [e.to_dict() for e in engines]})


@bp.post("/admin/engines")
@admin_required
def create_engine():
    payload = request.get_json(silent=True) or {}
    for required in ("make", "model_code", "title", "guide_price_usd"):
        if payload.get(required) in (None, ""):
            return api_error(f"{required.replace('_', ' ').title()} is required.")
    try:
        engine = _clean_engine(payload)
    except ValueError as exc:
        return api_error(f"Invalid value for {exc}.")
    if engine.guide_price_usd is None or engine.guide_price_usd <= 0:
        return api_error("Guide price must be greater than zero.")
    if Engine.query.filter_by(make=engine.make, model_code=engine.model_code).first():
        return api_error("That make and model code already exists in the catalog.")
    db.session.add(engine)
    db.session.commit()
    return jsonify({"engine": engine.to_dict()}), 201


@bp.patch("/admin/engines/<int:engine_id>")
@admin_required
def update_engine(engine_id):
    engine = db.session.get(Engine, engine_id)
    if not engine:
        return api_error("Engine not found.", 404)
    try:
        _clean_engine(request.get_json(silent=True) or {}, engine)
    except ValueError as exc:
        return api_error(f"Invalid value for {exc}.")
    if engine.guide_price_usd is None or engine.guide_price_usd <= 0:
        return api_error("Guide price must be greater than zero.")
    db.session.commit()
    return jsonify({"engine": engine.to_dict()})


@bp.delete("/admin/engines/<int:engine_id>")
@admin_required
def delete_engine(engine_id):
    engine = db.session.get(Engine, engine_id)
    if not engine:
        return api_error("Engine not found.", 404)
    from models import OrderItem

    in_use = OrderItem.query.filter_by(engine_id=engine.id).count()
    if in_use:
        return api_error(
            "This engine appears on existing orders. Pause it from sourcing instead of "
            "deleting so order history stays intact."
        )
    db.session.delete(engine)
    db.session.commit()
    return jsonify({"ok": True})
