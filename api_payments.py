"""Payments: Paynow (Zimbabwe), bank transfer proof, cash on delivery.

Paynow is the primary driver and also reaches EcoCash/OneMoney/ZIPIT/Visa/MC.
Bank transfers wait for admin confirmation of a proof-of-payment upload.
"""
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import requests
from flask import Blueprint, current_app, jsonify, request, session, send_from_directory
from werkzeug.utils import secure_filename

from auth_utils import admin_required, api_error, current_user, login_required
from models import PAYMENT_METHODS, PAYMENT_METHOD_LABELS, Order, Payment, db
from whatsapp import notify_customer

bp = Blueprint("payments", __name__, url_prefix="/api")

PROOF_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "proofs")
ALLOWED_PROOF_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


def _paynow_ready():
    cfg = current_app.config
    return bool(cfg["PAYNOW_INTEGRATION_ID"] and cfg["PAYNOW_INTEGRATION_KEY"])


def paynow_hash(fields, integration_key):
    """SHA512 over concatenated values with the integration key appended."""
    concatenated = "".join(str(fields.get(key, "") or "") for key in fields)
    return hashlib.sha512((concatenated + integration_key).encode("utf-8")).hexdigest().upper()


def init_paynow_payment(payment, order):
    """Create a Paynow web transaction and return the redirect/browser URL."""
    cfg = current_app.config
    payload = {
        "id": cfg["PAYNOW_INTEGRATION_ID"],
        "reference": payment.merchant_reference,
        "amount": f"{float(payment.amount_usd):.2f}",
        "additionalinfo": f"EngineHub order {order.reference}",
        "returnurl": cfg["PAYNOW_RETURN_URL"] or request.host_url.rstrip("/") + "/orders",
        "resulturl": cfg["PAYNOW_RESULT_URL"],
        "status": "Message",
    }
    payload["hash"] = paynow_hash(payload, cfg["PAYNOW_INTEGRATION_KEY"])
    resp = requests.post(
        "https://www.paynow.co.zw/interface/initiatetransaction",
        data=payload,
        timeout=20,
    )
    resp.raise_for_status()
    parsed = dict(
        line.split("=", 1) for line in resp.text.strip().splitlines() if "=" in line
    )
    if parsed.get("status", "").lower() != "ok":
        raise RuntimeError(parsed.get("error", "Paynow rejected the transaction"))
    payment.reference = parsed.get("pollurl") or parsed.get("browserurl")
    db.session.commit()
    return parsed.get("browserurl")


@bp.get("/payment-methods")
def payment_methods():
    return jsonify(
        {
            "methods": [
                {
                    "value": method,
                    "label": PAYMENT_METHOD_LABELS[method],
                    "ready": _paynow_ready() if method == "paynow" else True,
                }
                for method in PAYMENT_METHODS
            ]
        }
    )


@bp.post("/orders/<reference>/payments")
@login_required
def create_payment(reference):
    order = Order.query.filter_by(reference=reference).with_for_update().first()
    if not order:
        return api_error("Order not found.", 404)
    user = current_user()
    if order.customer_id != user.id and not user.is_admin:
        return api_error("You do not have access to this order.", 403)
    if order.status in ("quote_requested", "cancelled", "delivered"):
        return api_error("This order is not ready for payment yet.")

    data = request.get_json(silent=True) or {}
    method = data.get("method")
    if method not in PAYMENT_METHODS:
        return api_error("Choose a valid payment method.")
    committed = sum(
        (
            Decimal(str(payment.amount_usd or 0))
            for payment in order.payments
            if payment.status in ("pending", "proof_submitted")
        ),
        Decimal("0"),
    )
    balance_due = Decimal(str(order.balance_due))
    available = max(balance_due - committed, Decimal("0")).quantize(Decimal("0.01"))
    deposit_remaining = max(
        Decimal(str(order.deposit_due)) - Decimal(str(order.paid_total)) - committed,
        Decimal("0"),
    ).quantize(Decimal("0.01"))
    default_amount = deposit_remaining if deposit_remaining > 0 else available
    try:
        amount = Decimal(str(data.get("amount_usd") or default_amount)).quantize(
            Decimal("0.01")
        )
    except (InvalidOperation, ValueError):
        return api_error("Payment amount must be a number.")
    if not amount.is_finite() or amount <= 0:
        return api_error("Payment amount must be greater than zero.")
    if amount > available:
        return api_error("Payment amount exceeds the remaining amount available to pay.")

    payment = Payment(order_id=order.id, method=method, amount_usd=amount, status="pending")
    db.session.add(payment)
    db.session.flush()
    if method == "paynow":
        payment.merchant_reference = f"{order.reference}-{payment.id}"

    redirect_url = None
    if method == "paynow":
        if not _paynow_ready():
            db.session.rollback()
            return api_error(
                "Paynow is not enabled yet. Choose bank transfer or contact support.", 503
            )
        try:
            redirect_url = init_paynow_payment(payment, order)
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Paynow initialisation failed")
            return api_error("We could not reach Paynow. Please try again.", 502)

    db.session.commit()
    return jsonify({"payment": payment.to_dict(), "redirect_url": redirect_url}), 201


@bp.post("/orders/<reference>/payments/<int:payment_id>/proof")
@login_required
def upload_proof(reference, payment_id):
    order = Order.query.filter_by(reference=reference).first()
    payment = db.session.get(Payment, payment_id)
    if not order or not payment or payment.order_id != order.id:
        return api_error("Payment not found.", 404)
    user = current_user()
    if order.customer_id != user.id and not user.is_admin:
        return api_error("You do not have access to this order.", 403)
    if payment.status == "confirmed":
        return api_error("This payment is already confirmed.")

    upload = request.files.get("proof")
    if not upload or not upload.filename:
        return api_error("Attach a proof of payment file.")
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_PROOF_EXT:
        return api_error("Proof must be a PDF or image file.")

    os.makedirs(PROOF_DIR, exist_ok=True)
    safe_stem = secure_filename(os.path.splitext(upload.filename)[0])[:60] or "proof"
    filename = f"{order.reference}-{uuid.uuid4().hex[:8]}-{safe_stem}{ext}"
    upload.save(os.path.join(PROOF_DIR, filename))

    payment.proof_filename = filename
    payment.status = "proof_submitted"
    payment.reference = (request.form.get("reference") or payment.reference or "").strip()[:80] or None
    db.session.commit()
    return jsonify({"payment": payment.to_dict()})


@bp.get("/orders/<reference>/payments/<int:payment_id>/proof")
@login_required
def download_proof(reference, payment_id):
    order = Order.query.filter_by(reference=reference).first()
    payment = db.session.get(Payment, payment_id)
    if not order or not payment or payment.order_id != order.id or not payment.proof_filename:
        return api_error("Proof not found.", 404)
    user = current_user()
    if order.customer_id != user.id and not user.is_admin:
        return api_error("You do not have access to this file.", 403)
    return send_from_directory(PROOF_DIR, payment.proof_filename, as_attachment=True)


@bp.post("/admin/payments/<int:payment_id>/confirm")
@admin_required
def confirm_payment(payment_id):
    payment = db.session.get(Payment, payment_id)
    if not payment:
        return api_error("Payment not found.", 404)
    data = request.get_json(silent=True) or {}
    confirm = bool(data.get("confirm", True))
    payment.status = "confirmed" if confirm else "rejected"
    payment.admin_note = (data.get("note") or "")[:255] or None
    payment.confirmed_at = datetime.now(timezone.utc) if confirm else None

    order = payment.order
    if confirm and order.status in ("quoted", "quote_requested") and order.paid_total > 0:
        order.status = "deposit_paid"
        from models import OrderEvent

        order.events.append(
            OrderEvent(
                status="deposit_paid",
                note=f"Payment of USD {float(payment.amount_usd):,.2f} confirmed.",
            )
        )
    db.session.commit()

    document = order.reference
    if confirm:
        notify_customer(
            order,
            order.status,
            extra=f"Payment of USD {float(payment.amount_usd):,.2f} received for {document}.",
        )
    return jsonify({"payment": payment.to_dict(), "order": order.to_dict(include_customer=True)})


@bp.post("/paynow/result")
def paynow_result():
    """Paynow result callback (server-to-server)."""
    cfg = current_app.config
    data = request.form.to_dict()
    if not _paynow_ready():
        return "Paynow not configured", 503
    received = data.pop("hash", "").upper()
    expected = paynow_hash(data, cfg["PAYNOW_INTEGRATION_KEY"])
    if not hmac.compare_digest(received, expected):
        current_app.logger.warning("Paynow hash mismatch for %s", data.get("reference"))
        return "Invalid hash", 400

    merchant_reference = data.get("reference", "")
    payment = Payment.query.filter_by(
        merchant_reference=merchant_reference
    ).first()
    if not payment:
        legacy_order = Order.query.filter_by(reference=merchant_reference).first()
        if legacy_order:
            legacy_payments = Payment.query.filter_by(
                order_id=legacy_order.id,
                method="paynow",
                merchant_reference=None,
                status="pending",
            ).all()
            if len(legacy_payments) == 1:
                payment = legacy_payments[0]
        if not payment:
            return "Unknown payment", 404
    order = payment.order

    status = (data.get("status") or "").strip().lower()
    if status == "paid":
        try:
            paid_amount = Decimal(str(data.get("amount", ""))).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            return "Invalid amount", 400
        if paid_amount != Decimal(str(payment.amount_usd)).quantize(Decimal("0.01")):
            current_app.logger.warning(
                "Paynow amount mismatch for payment %s", payment.id
            )
            return "Invalid amount", 400
        if payment.status == "confirmed":
            return "ok", 200
        payment.status = "confirmed"
        payment.confirmed_at = datetime.now(timezone.utc)
        payment.reference = data.get("paynowreference") or payment.reference
        from models import OrderEvent

        if order.status in ("quoted", "quote_requested"):
            order.status = "deposit_paid"
            order.events.append(
                OrderEvent(
                    status="deposit_paid",
                    note=f"Paynow {data.get('paynowreference', '')} confirmed.",
                )
            )
        db.session.commit()
        notify_customer(order, order.status, extra="Paynow payment confirmed.")
    else:
        payment.status = "pending"
        payment.admin_note = f"Paynow status: {status}"[:255]
        db.session.commit()
    return "ok", 200


@bp.post("/dev/orders/<reference>/simulate-payment")
def simulate_payment(reference):
    """Local testing only: marks the latest payment paid without going through Paynow."""
    if not current_app.config.get("SEED_DEMO_DATA") or not session.get("is_admin"):
        return api_error("Not available.", 404)
    order = Order.query.filter_by(reference=reference).first()
    if not order:
        return api_error("Order not found.", 404)
    payment = (
        Payment.query.filter_by(order_id=order.id).order_by(Payment.created_at.desc()).first()
    )
    if not payment:
        return api_error("No payment to confirm.", 404)
    payment.status = "confirmed"
    payment.confirmed_at = datetime.now(timezone.utc)
    if order.status in ("quoted", "quote_requested"):
        from models import OrderEvent

        order.status = "deposit_paid"
        order.events.append(OrderEvent(status="deposit_paid", note="Sandbox payment confirmed."))
    db.session.commit()
    return jsonify({"payment": payment.to_dict(), "order": order.to_dict()})
