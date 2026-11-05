"""WhatsApp bot and webhook behaviour."""
import hashlib
import hmac
import json


def chat(client, message, phone="263771234567", name="Tendai"):
    res = client.post("/api/chat/web", json={"phone": phone, "message": message, "name": name})
    assert res.status_code == 200, res.get_json()
    return "\n".join(r["text"] for r in res.get_json()["replies"])


def options(client, message, phone="263771234567"):
    res = client.post("/api/chat/web", json={"phone": phone, "message": message, "name": "Tendai"})
    assert res.status_code == 200, res.get_json()
    return res.get_json()["replies"]


def test_webhook_verify_token(app, client):
    assert client.get("/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc").data == b"abc"
    assert client.get("/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=nope").status_code == 403


def test_webhook_rejects_unsigned_payload(client):
    res = client.post("/webhook/whatsapp", json={"entry": []})
    assert res.status_code == 403


def test_webhook_accepts_signed_payload(app, client):
    body = json.dumps(
        {
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "contacts": [{"wa_id": "263770001111", "profile": {"name": "Rudo"}}],
                                "messages": [{"from": "263770001111", "type": "text", "text": {"body": "hi"}}],
                            }
                        }
                    ]
                }
            ]
        }
    ).encode()
    signature = "sha256=" + hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
    res = client.post(
        "/webhook/whatsapp",
        data=body,
        headers={"X-Hub-Signature-256": signature, "Content-Type": "application/json"},
    )
    assert res.status_code == 200
    assert res.get_json()["status"] == "received"


def test_bot_menu_and_catalogue(client):
    phone = "263770000101"
    reply = chat(client, "hi", phone=phone)
    assert "ZimOsaka" in reply

    listing = options(client, "MENU_BROWSE", phone=phone)[-1]
    assert "*types we can source to order*" in listing["text"]
    assert "held in stock" in listing["text"].lower()
    assert listing["options"][0] == {"id": listing["options"][0]["id"], "label": "Hino J08E", "primary": True}


def test_bot_tracks_status_without_account(client):
    reply = chat(client, "MENU_TRACK", phone="263779999999")
    assert "could not find an account" in reply


def test_bot_custom_quote_becomes_lead(app, client):
    chat(client, "MENU_QUOTE", phone="263778888888")
    reply = chat(client, "Need a 2KD-FTV for a 2015 Hilux", phone="263778888888")
    assert "sourcing desk" in reply
    with app.app_context():
        from models import Lead

        lead = Lead.query.filter_by(phone="263778888888").first()
        assert lead and "2KD-FTV" in lead.details


def test_web_chat_returns_tap_buttons(client):
    replies = options(client, "hi", phone="263771112223")
    menu = replies[-1]
    labels = [o["label"] for o in menu["options"]]
    assert labels == ["Browse engines", "Track my order", "Get a quote"]
    assert menu["options"][0]["primary"] is True

    catalogue = options(client, "MENU_BROWSE", phone="263771112223")[-1]
    row_ids = [o["id"] for o in catalogue["options"]]
    assert all(rid.startswith("engine_") for rid in row_ids)
    assert len(row_ids) >= 5


def test_bot_orders_then_tracks(app, client):
    phone = "263770000103"
    chat(client, "hi", phone=phone)
    listing = chat(client, "MENU_BROWSE", phone=phone)
    assert "held in stock" in listing.lower()
    reply = options(client, "MENU_BROWSE", phone=phone)[-1]
    assert reply["options"][0]["label"] == "Hino J08E"
    detail = chat(client, "1", phone=phone)
    assert "Hino J08E" in detail
    add = chat(client, "ADD_ENGINE", phone=phone)
    assert "Added" in add

    cart = chat(client, "MENU_CART", phone=phone)
    assert "sourcing request" in cart.lower()

    link = chat(client, "MENU_ORDER", phone=phone)
    assert "What name should I use" in link
    confirm = chat(client, "Tendai Moyo", phone=phone)
    assert "account is ready" in confirm

    placed = chat(client, "MENU_ORDER", phone=phone)
    assert "created" in placed
    assert "ZOA-" in placed

    tracking = chat(client, "TRACK", phone=phone)
    assert "Quote requested" in tracking
