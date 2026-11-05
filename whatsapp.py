"""Meta WhatsApp Cloud API client.

Outbound sends are best-effort: failures are logged and never break the web
request that triggered them. When credentials are absent (local dev) messages
are simply written to the chat log so the flow stays observable.
"""
import logging

import requests
from flask import current_app

from models import STATUS_LABELS, ChatMessage, db

log = logging.getLogger(__name__)

GRAPH_URL = "https://graph.facebook.com/{version}/{phone_id}/messages"


def _configured():
    cfg = current_app.config
    return bool(cfg["WHATSAPP_ACCESS_TOKEN"] and cfg["WHATSAPP_PHONE_NUMBER_ID"])


def _post(payload):
    cfg = current_app.config
    if not _configured():
        log.info("WhatsApp not configured; outbound skipped: %s", payload.get("type"))
        return False
    url = GRAPH_URL.format(
        version=cfg["WHATSAPP_API_VERSION"], phone_id=cfg["WHATSAPP_PHONE_NUMBER_ID"]
    )
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"Authorization": "Bearer " + str(cfg["WHATSAPP_ACCESS_TOKEN"])},
            timeout=15,
        )
        if resp.status_code >= 400:
            log.warning("WhatsApp send failed %s: %s", resp.status_code, resp.text[:500])
            return False
        return True
    except requests.RequestException:
        log.exception("WhatsApp send raised")
        return False


def log_message(wa_id, direction, body, order_id=None, user_id=None):
    db.session.add(
        ChatMessage(
            channel="whatsapp",
            wa_id=wa_id,
            direction=direction,
            body=(body or "")[:4000],
            order_id=order_id,
            user_id=user_id,
        )
    )
    db.session.commit()


def send_text(wa_id, body, order_id=None, user_id=None, preview_url=False):
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": wa_id,
        "type": "text",
        "text": {"preview_url": preview_url, "body": body[:4096]},
    }
    sent = _post(payload)
    log_message(wa_id, "out", body, order_id=order_id, user_id=user_id)
    return sent


def send_buttons(wa_id, body, buttons):
    """buttons: list of (id, title) max 3, title max 20 chars."""
    payload = {
        "messaging_product": "whatsapp",
        "to": wa_id,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": body[:1024]},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": bid, "title": title[:20]}}
                    for bid, title in buttons[:3]
                ]
            },
        },
    }
    sent = _post(payload)
    log_message(wa_id, "out", body, user_id=None)
    return sent


def send_list(wa_id, body, button_text, rows):
    """rows: list of (id, title, description)."""
    payload = {
        "messaging_product": "whatsapp",
        "to": wa_id,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": body[:1024]},
            "action": {
                "button": button_text[:20],
                "sections": [
                    {
                        "title": "Engine types",
                        "rows": [
                            {"id": rid, "title": title[:24], "description": (desc or "")[:72]}
                            for rid, title, desc in rows[:10]
                        ],
                    }
                ],
            },
        },
    }
    sent = _post(payload)
    log_message(wa_id, "out", body, user_id=None)
    return sent


def notify_customer(order, status, extra=None):
    """Push an order status change to the customer's WhatsApp number."""
    if not current_app.config.get("WHATSAPP_NOTIFY_ON_STATUS"):
        return False
    customer = order.customer
    if not customer or not customer.phone:
        return False
    label = STATUS_LABELS.get(status, status.replace("_", " ").title())
    lines = [
        f"*{order.reference}* - {label}",
        f"Engines: {', '.join(i.to_dict()['title'] for i in order.items)}",
    ]
    if status == "quoted":
        lines.append(f"Total: USD {order.total:,.2f}")
        lines.append(f"Deposit due: USD {order.deposit_due:,.2f}")
    elif status in ("deposit_paid", "sourcing", "purchased", "shipped", "customs_clearing"):
        lines.append(f"Balance due: USD {order.balance_due:,.2f}")
    if extra:
        lines.append("")
        lines.append(extra)
    lines.append("")
    lines.append("Reply TRACK to see progress.")
    return send_text(customer.phone, "\n".join(lines), order_id=order.id)
