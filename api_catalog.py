"""Catalog, quote estimation and lead capture API."""
from decimal import Decimal, InvalidOperation

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_

from auth_utils import api_error
from models import db

from auth_utils import api_error, normalise_phone, valid_phone
from models import Engine, Lead, db
from pricing import landed_cost_estimate

bp = Blueprint("catalog", __name__, url_prefix="/api")


@bp.get("/engines")
def list_engines():
    make = (request.args.get("make") or "").strip()
    fuel = (request.args.get("fuel") or "").strip()
    condition = (request.args.get("condition") or "").strip()
    search = (request.args.get("q") or "").strip()
    sort = request.args.get("sort") or "featured"

    query = Engine.query
    if make:
        query = query.filter(Engine.make == make)
    if fuel:
        query = query.filter(Engine.fuel == fuel)
    if condition:
        query = query.filter(Engine.condition == condition)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Engine.title.ilike(like),
                Engine.make.ilike(like),
                Engine.model_code.ilike(like),
                Engine.description.ilike(like),
            )
        )

    if sort == "price_asc":
        query = query.order_by(Engine.guide_price_usd.asc())
    elif sort == "price_desc":
        query = query.order_by(Engine.guide_price_usd.desc())
    elif sort == "lead_time":
        query = query.order_by(Engine.typical_lead_days.asc())
    else:
        query = query.order_by(Engine.featured.desc(), Engine.make.asc())

    return jsonify({"engines": [e.to_dict() for e in query.all()]})


@bp.get("/engines/<int:engine_id>")
def get_engine(engine_id):
    engine = db.session.get(Engine, engine_id)
    if not engine:
        return api_error("That engine is not in our sourcing catalog.", 404)
    return jsonify({"engine": engine.to_dict()})


@bp.get("/engines/facets")
def facets():
    makes = [row[0] for row in db.session.query(Engine.make).distinct().order_by(Engine.make)]
    fuels = [row[0] for row in db.session.query(Engine.fuel).distinct().order_by(Engine.fuel)]
    conditions = [
        row[0] for row in db.session.query(Engine.condition).distinct().order_by(Engine.condition)
    ]
    models = sorted(
        {
            model
            for engine in Engine.query.all()
            for model in engine.fits_list()
        }
    )
    return jsonify({"makes": makes, "fuels": fuels, "conditions": conditions, "models": models})


@bp.get("/fitment")
def fitment():
    """Answer "what engine fits my vehicle?" from the catalog's compatibility data."""
    vehicle = (request.args.get("vehicle") or "").strip()
    make = (request.args.get("make") or "").strip()
    query = Engine.query.filter(Engine.sourcing_available.is_(True))
    if make:
        query = query.filter(Engine.make == make)

    engines = query.all()
    if vehicle:
        needle = vehicle.lower()
        matches = [
            e
            for e in engines
            if needle in (e.fits_vehicles or "").lower()
            or needle in (e.title or "").lower()
            or needle in (e.model_code or "").lower()
        ]
    else:
        matches = engines

    return jsonify(
        {
            "vehicle": vehicle or None,
            "count": len(matches),
            "engines": [e.to_dict() for e in matches],
            "alternatives": [e.to_dict() for e in engines if e not in matches][:6],
        }
    )


@bp.post("/quote-estimate")
def quote_estimate():
    """Public landed-cost calculator. No order is created."""
    data = request.get_json(silent=True) or {}

    def amount(key):
        """Return an amount, or None when the client omitted it (use defaults)."""
        raw = data.get(key)
        if raw in (None, ""):
            return None
        return Decimal(str(raw))

    try:
        goods = amount("goods_total") or Decimal("0")
        freight = amount("freight")
        insurance = amount("insurance")
        clearing = amount("clearing")
        inland = amount("inland")
        if goods <= 0:
            return api_error("Select an engine or enter a supplier price to estimate.")
    except (InvalidOperation, ValueError):
        return api_error("Quote amounts must be numbers.")

    cfg = current_app.config
    estimator = landed_cost_estimate(
        goods,
        freight=freight,
        insurance=insurance,
        clearing=clearing,
        inland=inland,
        duty_rate=data.get("duty_rate"),
        vat_rate=data.get("vat_rate"),
        surtax_rate=data.get("surtax_rate"),
    )
    estimator["currency"] = cfg["DEFAULT_CURRENCY"]
    return jsonify({"estimate": estimator})


@bp.post("/leads")
def create_lead():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    if len(name) < 2:
        return api_error("Please tell us your name.")
    if not valid_phone(phone):
        return api_error("Enter a valid mobile/WhatsApp number.")

    lead = Lead(
        name=name,
        phone=normalise_phone(phone),
        email=(data.get("email") or "").strip().lower() or None,
        make=(data.get("make") or "").strip() or None,
        details=(data.get("details") or "").strip() or None,
        channel="web",
    )
    db.session.add(lead)
    db.session.commit()
    return jsonify({"lead": lead.to_dict()}), 201
