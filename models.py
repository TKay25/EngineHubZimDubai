"""Data model for a pre-order engine sourcing business.

There is deliberately no stock/inventory field: every engine is sourced to order.
The catalog describes engine *types we can obtain*, and an order line records the
sourcing state of that specific unit.
"""
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


def iso(value):
    return value.isoformat() if value else None


ORDER_STATUSES = [
    "quote_requested",
    "quoted",
    "deposit_paid",
    "sourcing",
    "purchased",
    "shipped",
    "customs_clearing",
    "delivered",
    "cancelled",
]

STATUS_LABELS = {
    "quote_requested": "Quote requested",
    "quoted": "Quoted / awaiting deposit",
    "deposit_paid": "Deposit received",
    "sourcing": "Sourcing in Dubai",
    "purchased": "Purchased from supplier",
    "shipped": "In transit",
    "customs_clearing": "Customs clearing",
    "delivered": "Delivered",
    "cancelled": "Cancelled",
}

SOURCING_STATE_LABELS = {
    "requested": "Checking Dubai availability",
    "available": "Available — quote ready",
    "garage_search": "Searching Dubai garages",
    "reserved": "Reserved for you",
    "sourcing": "Sourcing in Dubai",
    "purchased": "Purchased from supplier",
    "shipped": "In transit",
    "customs_clearing": "Customs clearing",
    "delivered": "Delivered",
}

PAYMENT_METHODS = ["paynow", "bank_transfer", "cash_on_delivery"]
PAYMENT_METHOD_LABELS = {
    "paynow": "Paynow (EcoCash, OneMoney, ZIPIT, Visa/MC)",
    "bank_transfer": "Bank transfer / RTGS",
    "cash_on_delivery": "Cash on delivery",
}
PAYMENT_STATUSES = ["pending", "proof_submitted", "confirmed", "rejected"]


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(32), index=True)
    name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    orders = db.relationship("Order", back_populates="customer", lazy="dynamic")

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "phone": self.phone,
            "name": self.name,
            "is_admin": self.is_admin,
        }


class Engine(db.Model):
    """An engine type we can source on order. Not a stock item."""

    __tablename__ = "engines"

    id = db.Column(db.Integer, primary_key=True)
    make = db.Column(db.String(60), nullable=False, index=True)
    model_code = db.Column(db.String(80), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    displacement_cc = db.Column(db.Integer)
    fuel = db.Column(db.String(20), nullable=False, default="diesel")
    cylinders = db.Column(db.Integer)
    transmission = db.Column(db.String(30))
    condition = db.Column(db.String(30), nullable=False, default="used_jdm")
    condition_grade = db.Column(db.String(8))
    warranty_days = db.Column(db.Integer, default=90)
    warranty_note = db.Column(db.String(255))
    typical_lead_days = db.Column(db.Integer, default=35)
    guide_price_usd = db.Column(db.Numeric(12, 2), nullable=False)
    description = db.Column(db.Text)
    includes = db.Column(db.Text)  # comma separated: gearbox, ECU, harness...
    # Compatibility: comma separated vehicle models, e.g. "Hilux,Fortuner,Hiace"
    fits_vehicles = db.Column(db.Text)
    image_url = db.Column(db.String(500))
    sourcing_available = db.Column(db.Boolean, default=True, nullable=False)
    featured = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    def includes_list(self):
        return [item.strip() for item in (self.includes or "").split(",") if item.strip()]

    def fits_list(self):
        return [item.strip() for item in (self.fits_vehicles or "").split(",") if item.strip()]

    def to_dict(self):
        return {
            "id": self.id,
            "make": self.make,
            "model_code": self.model_code,
            "title": self.title,
            "displacement_cc": self.displacement_cc,
            "fuel": self.fuel,
            "cylinders": self.cylinders,
            "transmission": self.transmission,
            "condition": self.condition,
            "condition_label": (self.condition or "").replace("_", " ").title(),
            "condition_grade": self.condition_grade,
            "warranty_days": self.warranty_days,
            "warranty_note": self.warranty_note,
            "typical_lead_days": self.typical_lead_days,
            "guide_price_usd": float(self.guide_price_usd or 0),
            "description": self.description,
            "includes": self.includes_list(),
            "fits": self.fits_list(),
            "image_url": self.image_url,
            "sourcing_available": self.sourcing_available,
            "featured": self.featured,
        }



class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(24), unique=True, nullable=False, index=True)
    invoice_number = db.Column(db.String(24), unique=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    status = db.Column(db.String(32), nullable=False, default="quote_requested", index=True)
    fulfillment = db.Column(db.String(20), nullable=False, default="delivered_zimbabwe")
    destination_city = db.Column(db.String(80))
    notes = db.Column(db.Text)

    # Landed-cost inputs, snapshotted at quote time so old quotes stay stable.
    freight_usd = db.Column(db.Numeric(12, 2), default=0)
    insurance_usd = db.Column(db.Numeric(12, 2), default=0)
    clearing_usd = db.Column(db.Numeric(12, 2), default=0)
    inland_usd = db.Column(db.Numeric(12, 2), default=0)
    duty_rate = db.Column(db.Numeric(6, 4), default=0)
    vat_rate = db.Column(db.Numeric(6, 4), default=0)
    surtax_rate = db.Column(db.Numeric(6, 4), default=0)

    deposit_pct = db.Column(db.Numeric(5, 2), default=50)
    status_note = db.Column(db.String(255))

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    quoted_at = db.Column(db.DateTime(timezone=True))

    customer = db.relationship("User", back_populates="orders")
    items = db.relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )
    payments = db.relationship(
        "Payment", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )
    events = db.relationship(
        "OrderEvent",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderEvent.created_at",
        lazy="selectin",
    )
    messages = db.relationship(
        "ChatMessage", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )

    # --- money ---
    @property
    def goods_total(self):
        return round(sum(i.line_total for i in self.items), 2)

    @property
    def sourcing_fee(self):
        return 0.0

    @property
    def insurance(self):
        return round(float(self.insurance_usd or 0), 2)

    @property
    def freight(self):
        return round(float(self.freight_usd or 0), 2)

    @property
    def cif(self):
        return round(self.goods_total + self.freight + self.insurance, 2)

    @property
    def duty(self):
        return round(self.cif * float(self.duty_rate or 0), 2)

    @property
    def vat(self):
        return round((self.cif + self.duty) * float(self.vat_rate or 0), 2)

    @property
    def surtax(self):
        return round((self.cif + self.duty) * float(self.surtax_rate or 0), 2)

    @property
    def clearing(self):
        return round(float(self.clearing_usd or 0), 2)

    @property
    def inland(self):
        return round(float(self.inland_usd or 0), 2)

    @property
    def total(self):
        return round(
            self.goods_total
            + self.sourcing_fee
            + self.freight
            + self.insurance
            + self.duty
            + self.vat
            + self.surtax
            + self.clearing
            + self.inland,
            2,
        )

    @property
    def deposit_due(self):
        return round(self.total * float(self.deposit_pct or 0) / 100.0, 2)

    @property
    def paid_total(self):
        return round(
            sum(float(p.amount_usd or 0) for p in self.payments if p.status == "confirmed"), 2
        )

    @property
    def balance_due(self):
        return round(max(self.total - self.paid_total, 0), 2)

    def reserve_available_items(self):
        """Lock in located units once the customer has paid the deposit."""
        for item in self.items:
            if item.sourcing_state == "available":
                item.sourcing_state = "reserved"

    def to_dict(self, include_customer=False):
        data = {
            "id": self.id,
            "reference": self.reference,
            "invoice_number": self.invoice_number,
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, self.status),
            "status_note": self.status_note,
            "fulfillment": self.fulfillment,
            "destination_city": self.destination_city,
            "notes": self.notes,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
            "deposit_pct": float(self.deposit_pct or 0),
            "items": [i.to_dict() for i in self.items],
            "breakdown": {
                "goods_total": self.goods_total,
                "sourcing_fee": self.sourcing_fee,
                "freight": self.freight,
                "insurance": self.insurance,
                "cif": self.cif,
                "duty": self.duty,
                "duty_rate": float(self.duty_rate or 0),
                "vat": self.vat,
                "vat_rate": float(self.vat_rate or 0),
                "surtax": self.surtax,
                "surtax_rate": float(self.surtax_rate or 0),
                "clearing": self.clearing,
                "inland": self.inland,
                "total": self.total,
                "deposit_due": self.deposit_due,
                "paid_total": self.paid_total,
                "balance_due": self.balance_due,
            },
            "payments": [p.to_dict() for p in self.payments],
            "events": [e.to_dict() for e in self.events],
        }
        if include_customer:
            data["customer"] = self.customer.to_dict() if self.customer else None
        return data


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False, index=True)
    engine_id = db.Column(db.Integer, db.ForeignKey("engines.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price_usd = db.Column(db.Numeric(12, 2), nullable=False)
    sourcing_state = db.Column(db.String(32), default="requested")
    # Supplier tracking, recorded once the unit is bought (proof of sourcing)
    supplier = db.Column(db.String(120))
    supplier_ref = db.Column(db.String(80))
    lot_number = db.Column(db.String(60))
    serial_number = db.Column(db.String(80))
    inspection_note = db.Column(db.String(255))

    order = db.relationship("Order", back_populates="items")
    engine = db.relationship("Engine")

    @property
    def line_total(self):
        return round(float(self.unit_price_usd or 0) * (self.quantity or 0), 2)

    def to_dict(self):
        engine = self.engine
        return {
            "id": self.id,
            "engine_id": self.engine_id,
            "title": engine.title if engine else "Engine",
            "make": engine.make if engine else "",
            "model_code": engine.model_code if engine else "",
            "condition": engine.condition if engine else "",
            "quantity": self.quantity,
            "unit_price_usd": float(self.unit_price_usd or 0),
            "line_total": self.line_total,
            "sourcing_state": self.sourcing_state,
            "sourcing_state_label": SOURCING_STATE_LABELS.get(
                self.sourcing_state,
                (self.sourcing_state or "requested").replace("_", " ").title(),
            ),
            "supplier": self.supplier,
            "supplier_ref": self.supplier_ref,
            "lot_number": self.lot_number,
            "serial_number": self.serial_number,
            "inspection_note": self.inspection_note,
        }


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False, index=True)
    method = db.Column(db.String(32), nullable=False)
    amount_usd = db.Column(db.Numeric(12, 2), nullable=False)
    status = db.Column(db.String(24), nullable=False, default="pending")
    merchant_reference = db.Column(db.String(80), unique=True, index=True)
    reference = db.Column(db.String(80))
    proof_filename = db.Column(db.String(255))
    admin_note = db.Column(db.String(255))
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    confirmed_at = db.Column(db.DateTime(timezone=True))

    order = db.relationship("Order", back_populates="payments")

    def to_dict(self):
        return {
            "id": self.id,
            "method": self.method,
            "method_label": PAYMENT_METHOD_LABELS.get(self.method, self.method),
            "amount_usd": float(self.amount_usd or 0),
            "status": self.status,
            "reference": self.reference,
            "has_proof": bool(self.proof_filename),
            "admin_note": self.admin_note,
            "created_at": iso(self.created_at),
            "confirmed_at": iso(self.confirmed_at),
        }


class OrderEvent(db.Model):
    __tablename__ = "order_events"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False, index=True)
    status = db.Column(db.String(32), nullable=False)
    note = db.Column(db.String(255))
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    order = db.relationship("Order", back_populates="events")

    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, self.status),
            "note": self.note,
            "created_at": iso(self.created_at),
        }


class ChatMessage(db.Model):
    """Audit trail of WhatsApp / web-chat turns tied to a customer or order."""

    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    channel = db.Column(db.String(16), nullable=False, default="whatsapp")
    wa_id = db.Column(db.String(32), index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"))
    direction = db.Column(db.String(8), nullable=False)  # in / out
    body = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, index=True)

    order = db.relationship("Order", back_populates="messages")


class ChatSession(db.Model):
    """Conversational state for the WhatsApp bot, keyed by wa_id."""

    __tablename__ = "chat_sessions"

    id = db.Column(db.Integer, primary_key=True)
    wa_id = db.Column(db.String(32), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    state = db.Column(db.String(32), default="menu")
    cart = db.Column(db.Text, default="[]")  # JSON list of {engine_id, quantity}
    active_order_id = db.Column(db.Integer, db.ForeignKey("orders.id"))
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CompanySettings(db.Model):
    """Single-row table holding business identity, contacts and defaults.

    Nothing about the company is hard-coded in the UI or the bot: both read this
    row. Admins edit it from the console.
    """

    __tablename__ = "company_settings"

    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(120), nullable=False, default="ZimOsaka AutoSpares")
    tagline = db.Column(
        db.String(200),
        default=(
            "Engines sourced from Dubai, delivered across Zimbabwe, with optional fitting "
            "by our Zimbabwe mechanics"
        ),
    )
    phone = db.Column(db.String(40))
    whatsapp = db.Column(db.String(32))
    email = db.Column(db.String(255))
    address = db.Column(db.String(255))
    office_hours = db.Column(db.String(255))
    bank_details = db.Column(db.Text)
    paynow_note = db.Column(db.String(255))
    duty_rate = db.Column(db.Numeric(6, 4), default=0.20)
    vat_rate = db.Column(db.Numeric(6, 4), default=0.15)
    surtax_rate = db.Column(db.Numeric(6, 4), default=0.05)
    default_freight_min = db.Column(db.Numeric(12, 2), default=600)
    default_freight_pct = db.Column(db.Numeric(6, 4), default=0.12)
    insurance_pct = db.Column(db.Numeric(6, 4), default=0.015)
    default_clearing = db.Column(db.Numeric(12, 2), default=450)
    default_inland = db.Column(db.Numeric(12, 2), default=350)
    default_deposit_pct = db.Column(db.Numeric(5, 2), default=50)
    # Trust & credibility (shown in the footer / trust blocks)
    registration_number = db.Column(db.String(80))
    established_year = db.Column(db.Integer)
    warranty_summary = db.Column(db.String(255))
    inspection_process = db.Column(db.Text)
    orders_fulfilled = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    def to_dict(self):
        return {
            "company_name": self.company_name,
            "tagline": self.tagline,
            "phone": self.phone,
            "whatsapp": self.whatsapp,
            "email": self.email,
            "address": self.address,
            "office_hours": self.office_hours,
            "bank_details": self.bank_details,
            "paynow_note": self.paynow_note,
            "registration_number": self.registration_number,
            "established_year": self.established_year,
            "warranty_summary": self.warranty_summary,
            "inspection_process": self.inspection_process,
            "orders_fulfilled": self.orders_fulfilled,
            "duty_rate": float(self.duty_rate or 0),
            "vat_rate": float(self.vat_rate or 0),
            "surtax_rate": float(self.surtax_rate or 0),
            "default_freight_min": float(self.default_freight_min or 0),
            "default_freight_pct": float(self.default_freight_pct or 0),
            "insurance_pct": float(self.insurance_pct or 0),
            "default_clearing": float(self.default_clearing or 0),
            "default_inland": float(self.default_inland or 0),
            "default_deposit_pct": float(self.default_deposit_pct or 0),
            "updated_at": iso(self.updated_at),
        }


class Lead(db.Model):
    """Quote/build requests captured before a customer account exists."""

    __tablename__ = "leads"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(32), nullable=False)
    email = db.Column(db.String(255))
    make = db.Column(db.String(80))
    details = db.Column(db.Text)
    channel = db.Column(db.String(16), default="web")
    handled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "make": self.make,
            "details": self.details,
            "channel": self.channel,
            "handled": self.handled,
            "created_at": iso(self.created_at),
        }
