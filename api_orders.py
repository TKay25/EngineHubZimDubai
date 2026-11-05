"""Order lifecycle: cart -> quote request -> admin quote -> deposit -> sourcing.

Engines are pre-ordered. Nothing here tracks stock; each line carries a sourcing
state that the sourcing team updates as the unit is located and bought.
"""
import secrets
from datetime import datetime, timezone
from decimal import Decimal

from flask import Blueprint, current_app, jsonify, request

from auth_utils import admin_required, api_error, current_user, login_required
from models import (
    ORDER_STATUSES,
    STATUS_LABELS,
    Engine,
    Order,
    OrderEvent,
    OrderItem,
    User,
    db,
)
from whatsapp import notify_customer
from config import get_settings

bp = Blueprint("orders", __name__, url_prefix="/api")

FULFILLMENT_OPTIONS = {"collected_dubai", "delivered_zimbabwe"}


def new_reference():
    return "ZOA-" + secrets.token_hex(3).upper()


def _apply_defaults(order, goods_total, freight=None, insurance=None):
    settings = get_settings()
    if freight is None or freight == "":
        order.freight_usd = Decimal(
            str(
                round(
                    max(
                        float(settings.default_freight_min),
                        goods_total * float(settings.default_freight_pct),
                    ),
                    2,
                )
            )
        )
    else:
        order.freight_usd = Decimal(str(freight))
    if insurance is None or insurance == "":
        order.insurance_usd = Decimal(str(round(goods_total * float(settings.insurance_pct), 2)))
    else:
        order.insurance_usd = Decimal(str(insurance))


@bp.post("/orders")
@login_required
def create_order():
    data = request.get_json(silent=True) or {}
    raw_items = data.get("items") or []
    if not isinstance(raw_items, list) or not raw_items:
        return api_error("Add at least one engine to your request.")

    fulfillment = data.get("fulfillment") or "delivered_zimbabwe"
    if fulfillment not in FULFILLMENT_OPTIONS:
        return api_error("Choose a valid delivery option.")

    settings = get_settings()
    order = Order(
        reference=new_reference(),
        customer_id=current_user().id,
        status="quote_requested",
        fulfillment=fulfillment,
        destination_city=(data.get("destination_city") or "").strip() or None,
        notes=(data.get("notes") or "").strip() or None,
        duty_rate=settings.duty_rate,
        vat_rate=settings.vat_rate,
        surtax_rate=settings.surtax_rate,
        deposit_pct=settings.default_deposit_pct,
        clearing_usd=0,
        inland_usd=0,
    )

    seen = {}
    for raw in raw_items:
        try:
            engine_id = int(raw.get("engine_id"))
            quantity = max(1, min(int(raw.get("quantity") or 1), 20))
        except (TypeError, ValueError, AttributeError):
            return api_error("Invalid engine selection.")
        seen[engine_id] = min(seen.get(engine_id, 0) + quantity, 20)

    engines = {e.id: e for e in Engine.query.filter(Engine.id.in_(seen.keys())).all()}
    missing = [str(i) for i in seen if i not in engines]
    if missing:
        return api_error("Some engines are no longer available: " + ", ".join(missing))

    for engine_id, quantity in seen.items():
        engine = engines[engine_id]
        if not engine.sourcing_available:
            return api_error(f"{engine.title} is temporarily unavailable for sourcing.")
        order.items.append(
            OrderItem(
                engine_id=engine.id,
                quantity=quantity,
                unit_price_usd=engine.guide_price_usd,
                sourcing_state="requested",
            )
        )

    goods_total = sum(
        float(engines[engine_id].guide_price_usd) * qty for engine_id, qty in seen.items()
    )
    _apply_defaults(order, goods_total, data.get("freight"), data.get("insurance"))
    order.clearing_usd = Decimal(str(data.get("clearing") or 0))
    order.inland_usd = Decimal(str(data.get("inland") or 0))

    db.session.add(order)
    db.session.flush()
    order.events.append(
        OrderEvent(status="quote_requested", note="Sourcing request submitted.")
    )
    db.session.commit()

    notify_customer(
        order,
        "quote_requested",
        extra=f"Your sourcing request {order.reference} was received. "
        "Our Dubai desk will confirm availability and send a proforma quote.",
    )
    return jsonify({"order": order.to_dict()}), 201


@bp.get("/orders")
@login_required
def my_orders():
    user = current_user()
    orders = (
        Order.query.filter_by(customer_id=user.id).order_by(Order.created_at.desc()).all()
    )
    return jsonify({"orders": [o.to_dict() for o in orders]})


@bp.get("/orders/<reference>")
@login_required
def get_order(reference):
    order = Order.query.filter_by(reference=reference).first()
    if not order:
        return api_error("Order not found.", 404)
    user = current_user()
    if order.customer_id != user.id and not user.is_admin:
        return api_error("You do not have access to this order.", 403)
    return jsonify({"order": order.to_dict(include_customer=user.is_admin)})


@bp.post("/orders/<reference>/cancel")
@login_required
def cancel_order(reference):
    order = Order.query.filter_by(reference=reference).first()
    if not order:
        return api_error("Order not found.", 404)
    user = current_user()
    if order.customer_id != user.id and not user.is_admin:
        return api_error("You do not have access to this order.", 403)
    if order.status not in ("quote_requested", "quoted"):
        return api_error("This order has progressed too far to cancel. Contact support.")
    order.status = "cancelled"
    order.events.append(OrderEvent(status="cancelled", note="Cancelled by customer."))
    db.session.commit()
    notify_customer(order, "cancelled")
    return jsonify({"order": order.to_dict()})


# ---------------- admin ----------------


@bp.get("/admin/orders")
@admin_required
def admin_orders():
    status = request.args.get("status")
    query = Order.query
    if status and status in ORDER_STATUSES:
        query = query.filter(Order.status == status)
    orders = query.order_by(Order.created_at.desc()).limit(200).all()
    return jsonify(
        {
            "orders": [o.to_dict(include_customer=True) for o in orders],
            "statuses": [{"value": s, "label": STATUS_LABELS[s]} for s in ORDER_STATUSES],
        }
    )


@bp.patch("/admin/orders/<reference>/quote")
@admin_required
def set_quote(reference):
    """Confirm supplier pricing and logistics for a quote request."""
    order = Order.query.filter_by(reference=reference).first()
    if not order:
        return api_error("Order not found.", 404)
    data = request.get_json(silent=True) or {}

    for item in order.items:
        raw_item = next(
            (i for i in data.get("items", []) if int(i.get("id", 0)) == item.id), None
        )
        if not raw_item:
            continue
        try:
            price = Decimal(str(raw_item.get("unit_price_usd"))).quantize(Decimal("0.01"))
        except Exception:
            return api_error("Engine prices must be numbers.")
        if price <= 0:
            return api_error("Engine prices must be greater than zero.")
        item.unit_price_usd = price
        if raw_item.get("sourcing_state"):
            item.sourcing_state = str(raw_item["sourcing_state"])[:32]

    try:
        if data.get("freight") is not None:
            order.freight_usd = Decimal(str(data["freight"]))
        if data.get("insurance") is not None:
            order.insurance_usd = Decimal(str(data["insurance"]))
        if data.get("clearing") is not None:
            order.clearing_usd = Decimal(str(data["clearing"]))
        if data.get("inland") is not None:
            order.inland_usd = Decimal(str(data["inland"]))
        if data.get("duty_rate") is not None:
            order.duty_rate = Decimal(str(data["duty_rate"]))
        if data.get("vat_rate") is not None:
            order.vat_rate = Decimal(str(data["vat_rate"]))
        if data.get("surtax_rate") is not None:
            order.surtax_rate = Decimal(str(data["surtax_rate"]))
        if data.get("deposit_pct") is not None:
            pct = Decimal(str(data["deposit_pct"]))
            if pct < 0 or pct > 100:
                return api_error("Deposit percentage must be between 0 and 100.")
            order.deposit_pct = pct
    except Exception:
        return api_error("Quote amounts must be numbers.")

    note = (data.get("note") or "").strip() or "Proforma quote issued."
    order.status = "quoted"
    order.quoted_at = datetime.now(timezone.utc)
    order.events.append(OrderEvent(status="quoted", note=note))
    db.session.commit()

    notify_customer(
        order,
        "quoted",
        extra=f"Proforma {order.reference}: total USD {order.total:,.2f}. "
        f"Deposit of USD {order.deposit_due:,.2f} secures sourcing.",
    )
    return jsonify({"order": order.to_dict(include_customer=True)})


@bp.patch("/admin/orders/<reference>/status")
@admin_required
def set_status(reference):
    order = Order.query.filter_by(reference=reference).first()
    if not order:
        return api_error("Order not found.", 404)
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in ORDER_STATUSES:
        return api_error("Unknown status.")

    if status == "delivered" and order.balance_due > 0:
        return api_error(
            f"USD {order.balance_due:,.2f} is still outstanding. Confirm payment first."
        )

    note = (data.get("note") or "").strip() or None
    order.status = status
    order.status_note = note
    order.events.append(OrderEvent(status=status, note=note))
    if status in ("sourcing", "purchased"):
        for item in order.items:
            item.sourcing_state = status
    db.session.commit()

    notify_customer(order, status, extra=note)
    return jsonify({"order": order.to_dict(include_customer=True)})


@bp.get("/admin/leads")
@admin_required
def admin_leads():
    from models import Lead

    leads = Lead.query.order_by(Lead.created_at.desc()).limit(200).all()
    return jsonify({"leads": [lead.to_dict() for lead in leads]})


@bp.patch("/admin/leads/<int:lead_id>")
@admin_required
def update_lead(lead_id):
    from models import Lead

    lead = db.session.get(Lead, lead_id)
    if not lead:
        return api_error("Lead not found.", 404)
    data = request.get_json(silent=True) or {}
    lead.handled = bool(data.get("handled", lead.handled))
    db.session.commit()
    return jsonify({"lead": lead.to_dict()})


@bp.get("/admin/customers")
@admin_required
def admin_customers():
    users = User.query.filter_by(is_admin=False).order_by(User.created_at.desc()).limit(200).all()
    return jsonify(
        {
            "customers": [
                {**u.to_dict(), "order_count": u.orders.count()} for u in users
            ]
        }
    )


@bp.get("/admin/stats")
@admin_required
def admin_stats():
    from sqlalchemy import func

    from models import Lead, Payment

    pipeline = dict(
        db.session.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    )
    freight_booked = (
        db.session.query(func.coalesce(func.sum(Order.freight_usd), 0))
        .filter(Order.status.notin_(["cancelled", "quote_requested"]))
        .scalar()
        or 0
    )
    confirmed = (
        db.session.query(func.coalesce(func.sum(Payment.amount_usd), 0))
        .filter(Payment.status == "confirmed")
        .scalar()
        or 0
    )
    return jsonify(
        {
            "pipeline": pipeline,
            "open_orders": sum(
                v for k, v in pipeline.items() if k not in ("delivered", "cancelled")
            ),
            "confirmed_payments_usd": float(confirmed),
            "unhandled_leads": Lead.query.filter_by(handled=False).count(),
            "customers": User.query.filter_by(is_admin=False).count(),
            "freight_booked_usd": float(freight_booked),
        }
    )
