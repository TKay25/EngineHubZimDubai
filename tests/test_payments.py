import hashlib
import uuid

from api_payments import paynow_hash


def test_paynow_hash_matches_sha512_contract():
    fields = {"id": "1234", "reference": "EHD-ABC123", "amount": "100.00"}
    expected = hashlib.sha512(
        ("1234" + "EHD-ABC123" + "100.00" + "secret-key").encode()
    ).hexdigest().upper()
    assert paynow_hash(fields, "secret-key") == expected


def test_phone_normalisation():
    from auth_utils import normalise_phone, valid_phone

    assert normalise_phone("0771 234 567") == "263771234567"
    assert normalise_phone("+263 771 234 567") == "263771234567"
    assert valid_phone("0771234567")
    assert not valid_phone("123")
    assert not valid_phone("")


def _create_quoted_order(client, admin_client, engine):
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Payment Test",
            "email": f"payment-{uuid.uuid4().hex}@example.com",
            "phone": "0771234567",
            "password": "Password123",
        },
    )
    assert registration.status_code == 201
    created = client.post(
        "/api/orders",
        json={"items": [{"engine_id": engine["id"], "quantity": 1}]},
    )
    assert created.status_code == 201
    order = created.get_json()["order"]
    quoted = admin_client.patch(
        f"/api/admin/orders/{order['reference']}/quote",
        json={
            "items": [
                {
                    "id": order["items"][0]["id"],
                    "unit_price_usd": engine["guide_price_usd"],
                }
            ]
        },
    )
    assert quoted.status_code == 200
    return quoted.get_json()["order"]


def _paynow_callback(client, fields, key):
    data = dict(fields)
    data["hash"] = paynow_hash(fields, key)
    return client.post("/api/paynow/result", data=data)


def test_payment_amount_cannot_exceed_uncommitted_balance(
    app, client, admin_client, engine
):
    order = _create_quoted_order(client, admin_client, engine)
    first = client.post(
        f"/api/orders/{order['reference']}/payments",
        json={"method": "bank_transfer", "amount_usd": "100.00"},
    )
    assert first.status_code == 201

    overpayment = client.post(
        f"/api/orders/{order['reference']}/payments",
        json={"method": "bank_transfer", "amount_usd": order["breakdown"]["total"]},
    )
    assert overpayment.status_code == 400
    assert "remaining amount" in overpayment.get_json()["error"]


def test_payment_amount_must_be_finite(app, client, admin_client, engine):
    order = _create_quoted_order(client, admin_client, engine)
    for amount in ("NaN", "Infinity"):
        response = client.post(
            f"/api/orders/{order['reference']}/payments",
            json={"method": "bank_transfer", "amount_usd": amount},
        )
        assert response.status_code == 400


def test_paynow_callback_matches_its_payment_and_is_idempotent(
    app, client, admin_client, engine, monkeypatch
):
    app.config.update(
        PAYNOW_INTEGRATION_ID="test-id",
        PAYNOW_INTEGRATION_KEY="test-key",
    )
    monkeypatch.setattr(
        "api_payments.init_paynow_payment",
        lambda payment, order: "https://paynow.example/checkout",
    )
    order = _create_quoted_order(client, admin_client, engine)
    first = client.post(
        f"/api/orders/{order['reference']}/payments",
        json={"method": "paynow", "amount_usd": "100.00"},
    )
    second = client.post(
        f"/api/orders/{order['reference']}/payments",
        json={"method": "paynow", "amount_usd": "200.00"},
    )
    assert first.status_code == 201
    assert second.status_code == 201

    with app.app_context():
        from models import Payment, db

        first_payment = db.session.get(Payment, first.get_json()["payment"]["id"])
        first_reference = first_payment.merchant_reference
        assert first_reference and first_reference != order["reference"]

    fields = {
        "id": "test-id",
        "reference": first_reference,
        "amount": "100.00",
        "paynowreference": "PN-100",
        "status": "Paid",
    }
    callback = _paynow_callback(client, fields, "test-key")
    assert callback.status_code == 200

    with app.app_context():
        first_payment = db.session.get(Payment, first.get_json()["payment"]["id"])
        second_payment = db.session.get(Payment, second.get_json()["payment"]["id"])
        assert first_payment.status == "confirmed"
        assert second_payment.status == "pending"
        event_count = len(first_payment.order.events)

    replay = _paynow_callback(client, fields, "test-key")
    assert replay.status_code == 200
    with app.app_context():
        first_payment = db.session.get(Payment, first.get_json()["payment"]["id"])
        assert len(first_payment.order.events) == event_count


def test_paynow_callback_rejects_amount_mismatch(
    app, client, admin_client, engine, monkeypatch
):
    app.config.update(
        PAYNOW_INTEGRATION_ID="test-id",
        PAYNOW_INTEGRATION_KEY="test-key",
    )
    monkeypatch.setattr(
        "api_payments.init_paynow_payment",
        lambda payment, order: "https://paynow.example/checkout",
    )
    order = _create_quoted_order(client, admin_client, engine)
    response = client.post(
        f"/api/orders/{order['reference']}/payments",
        json={"method": "paynow", "amount_usd": "100.00"},
    )
    assert response.status_code == 201

    with app.app_context():
        from models import Payment, db

        payment = db.session.get(Payment, response.get_json()["payment"]["id"])
        merchant_reference = payment.merchant_reference

    fields = {
        "id": "test-id",
        "reference": merchant_reference,
        "amount": "101.00",
        "paynowreference": "PN-MISMATCH",
        "status": "Paid",
    }
    callback = _paynow_callback(client, fields, "test-key")
    assert callback.status_code == 400
    with app.app_context():
        payment = db.session.get(Payment, response.get_json()["payment"]["id"])
        assert payment.status == "pending"


def test_legacy_paynow_callback_matches_only_unambiguous_payment(
    app, client, admin_client, engine, monkeypatch
):
    app.config.update(
        PAYNOW_INTEGRATION_ID="test-id",
        PAYNOW_INTEGRATION_KEY="test-key",
    )
    monkeypatch.setattr(
        "api_payments.init_paynow_payment",
        lambda payment, order: "https://paynow.example/checkout",
    )
    order = _create_quoted_order(client, admin_client, engine)
    response = client.post(
        f"/api/orders/{order['reference']}/payments",
        json={"method": "paynow", "amount_usd": "100.00"},
    )
    assert response.status_code == 201

    with app.app_context():
        from models import Payment, db

        payment = db.session.get(Payment, response.get_json()["payment"]["id"])
        payment.merchant_reference = None
        db.session.commit()

    fields = {
        "id": "test-id",
        "reference": order["reference"],
        "amount": "100.00",
        "paynowreference": "PN-LEGACY",
        "status": "Paid",
    }
    callback = _paynow_callback(client, fields, "test-key")
    assert callback.status_code == 200
    with app.app_context():
        payment = db.session.get(Payment, response.get_json()["payment"]["id"])
        assert payment.status == "confirmed"
