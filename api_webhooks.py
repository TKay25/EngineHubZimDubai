"""WhatsApp webhook receiver; conversation logic lives in chatbot.py."""
import hashlib
import hmac
import logging

from flask import Blueprint, current_app, jsonify, request

import chatbot
from auth_utils import normalise_phone
from models import ChatMessage, db
import whatsapp as wa_module

log = logging.getLogger(__name__)
bp = Blueprint("webhooks", __name__)

# Exposed as /api/chat/web so the built React app (served from /static) can reach it.
chat_bp = Blueprint("chat_web", __name__, url_prefix="/api")


@bp.get("/webhook/whatsapp")
def verify():
    cfg = current_app.config
    if (
        cfg["WHATSAPP_VERIFY_TOKEN"]
        and request.args.get("hub.mode") == "subscribe"
        and request.args.get("hub.verify_token") == cfg["WHATSAPP_VERIFY_TOKEN"]
    ):
        return request.args.get("hub.challenge", ""), 200
    return "Forbidden", 403


@bp.post("/webhook/whatsapp")
def receive():
    raw = request.get_data()
    secret = current_app.config.get("WHATSAPP_APP_SECRET")
    if not secret:
        # Without the app secret, signatures cannot be validated, so refuse
        # rather than trusting an internet-facing hook.
        log.error("WHATSAPP_APP_SECRET not set; rejecting webhook")
        return jsonify({"error": "webhook not configured"}), 503

    signature = request.headers.get("X-Hub-Signature-256", "")
    expected = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        log.warning("Rejected WhatsApp webhook with bad signature")
        return jsonify({"error": "invalid signature"}), 403

    data = request.get_json(silent=True) or {}
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            profiles = {
                c.get("wa_id"): c.get("profile", {}).get("name")
                for c in value.get("contacts", [])
            }
            for message in value.get("messages", []):
                wa_id = message.get("from")
                if not wa_id:
                    continue
                body = extract_body(message)
                if body is None:
                    wa_module.send_text(wa_id, "I can only read text or menu replies. Reply *MENU*.")
                    continue
                db.session.add(
                    ChatMessage(
                        channel="whatsapp", wa_id=wa_id, direction="in", body=body[:4000]
                    )
                )
                db.session.commit()
                try:
                    chatbot.handle_message(wa_id, body, name=profiles.get(wa_id))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    log.exception("WhatsApp handler failed for %s", wa_id)
                    wa_module.send_text(wa_id, "Something went wrong. Reply *MENU* to start again.")
    return jsonify({"status": "received"})


def extract_body(message):
    mtype = message.get("type")
    if mtype == "text":
        return message.get("text", {}).get("body")
    if mtype == "interactive":
        interactive = message.get("interactive", {})
        if interactive.get("type") == "button_reply":
            return interactive["button_reply"].get("id")
        if interactive.get("type") == "list_reply":
            return interactive["list_reply"].get("id")
    if mtype == "button":
        return message.get("button", {}).get("text")
    return None


@chat_bp.post("/chat/web")
def web_chat():
    """Web/chat-widget sandbox for the same bot, returning tap-able options."""
    data = request.get_json(silent=True) or {}
    wa_id = normalise_phone(data.get("phone") or "263770000000")
    if not wa_id:
        return jsonify({"error": "Provide a phone number."}), 400

    replies = []
    original_text = chatbot.send_text
    original_buttons = chatbot.send_buttons
    original_list = chatbot.send_list

    def record(body, options=None):
        replies.append({"text": body or "", "options": options or []})

    def capture_text(recipient, body, order_id=None, user_id=None, preview_url=False):
        if str(recipient) == str(wa_id):
            record(body)
            return True
        return original_text(recipient, body, order_id=order_id, user_id=user_id)

    def capture_buttons(recipient, body, buttons):
        if str(recipient) == str(wa_id):
            record(
                body,
                [
                    {"id": bid, "label": title, "primary": idx == 0}
                    for idx, (bid, title) in enumerate(buttons)
                ],
            )
            return True
        return original_buttons(recipient, body, buttons)

    def capture_list(recipient, body, button_text, rows):
        if str(recipient) == str(wa_id):
            options = [
                {"id": rid, "label": title, "primary": idx == 0}
                for idx, (rid, title, _desc) in enumerate(rows)
            ]
            record(body, options)
            return True
        return original_list(recipient, body, button_text, rows)

    chatbot.send_text = capture_text
    chatbot.send_buttons = capture_buttons
    chatbot.send_list = capture_list
    try:
        chatbot.handle_message(wa_id, data.get("message") or "hi", name=data.get("name"))
        db.session.commit()
    finally:
        chatbot.send_text = original_text
        chatbot.send_buttons = original_buttons
        chatbot.send_list = original_list
    return jsonify({"replies": replies})
