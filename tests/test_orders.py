import io


def test_catalog_is_available_to_the_public(client):
    res = client.get("/api/engines")
    assert res.status_code == 200
    engines = res.get_json()["engines"]
    assert len(engines) >= 10
    assert all("guide_price_usd" in e for e in engines)
    # Pre-order model: no stock fields anywhere
    assert all("stock" not in key for e in engines for key in e)


def test_catalog_filters_and_search(client):
    assert client.get("/api/engines?make=Toyota").get_json()["engines"]
    res = client.get("/api/engines?q=J08E").get_json()["engines"]
    assert len(res) == 1 and res[0]["make"] == "Hino"
    facets = client.get("/api/engines/facets").get_json()
    assert "Toyota" in facets["makes"]


def test_landed_cost_estimate(client):
    res = client.post("/api/quote-estimate", json={"goods_total": 1000})
    assert res.status_code == 200
    est = res.get_json()["estimate"]
    # freight floor 600, insurance 1.5% = 15 -> CIF 1615
    assert est["freight"] == 600
    assert est["cif"] == 1615
    assert est["duty"] == 323  # 20%
    assert est["vat"] == round((1615 + 323) * 0.15, 2)
    assert est["total"] == round(1615 + 323 + est["vat"] + est["surtax"] + 450 + 350, 2)


def test_quote_estimate_rejects_bad_input(client):
    assert client.post("/api/quote-estimate", json={"goods_total": 0}).status_code == 400
    assert client.post("/api/quote-estimate", json={"goods_total": "abc"}).status_code == 400


def test_lead_capture(client):
    res = client.post(
        "/api/leads",
        json={"name": "Rudo", "phone": "0771 000 111", "make": "Isuzu", "details": "4HK1 needed"},
    )
    assert res.status_code == 201
    lead = res.get_json()["lead"]
    assert lead["phone"] == "263771000111"


def test_lead_rejects_bad_phone(client):
    res = client.post("/api/leads", json={"name": "X", "phone": "12"})
    assert res.status_code == 400


def test_order_requires_login(client, engine):
    res = client.post("/api/orders", json={"items": [{"engine_id": engine["id"]}]})
    assert res.status_code == 401


def test_order_flow_to_delivery(app, client, admin_client, customer, engine):
    created = client.post(
        "/api/orders",
        json={
            "items": [{"engine_id": engine["id"], "quantity": 2}],
            "fulfillment": "delivered_zimbabwe",
            "destination_city": "Bulawayo",
            "notes": "Need ECU",
        },
    )
    assert created.status_code == 201, created.get_json()
    order = created.get_json()["order"]
    ref = order["reference"]

    assert order["status"] == "quote_requested"
    assert order["breakdown"]["goods_total"] == engine["guide_price_usd"] * 2
    assert order["breakdown"]["freight"] >= 600
    assert order["breakdown"]["total"] > order["breakdown"]["goods_total"]

    listed = client.get("/api/orders").get_json()["orders"]
    assert [o["reference"] for o in listed] == [ref]

    item_id = order["items"][0]["id"]
    searching = admin_client.patch(
        f"/api/admin/orders/{ref}/availability",
        json={"items": [{"id": item_id, "sourcing_state": "garage_search"}]},
    )
    assert searching.status_code == 200
    assert searching.get_json()["order"]["items"][0]["sourcing_state"] == "garage_search"
    blocked_quote = admin_client.patch(
        f"/api/admin/orders/{ref}/quote",
        json={"items": [{"id": item_id, "unit_price_usd": 4000}]},
    )
    assert blocked_quote.status_code == 400

    available = admin_client.patch(
        f"/api/admin/orders/{ref}/availability",
        json={"items": [{"id": item_id, "sourcing_state": "available"}]},
    )
    assert available.status_code == 200

    # Admin prices the proforma
    quoted = admin_client.patch(
        f"/api/admin/orders/{ref}/quote",
        json={
            "items": [{"id": item_id, "unit_price_usd": 4000, "sourcing_state": "available"}],
            "freight": 900,
            "insurance": 80,
            "clearing": 450,
            "inland": 350,
            "duty_rate": 0.2,
            "vat_rate": 0.15,
            "surtax_rate": 0.05,
        },
    )
    assert quoted.status_code == 200, quoted.get_json()
    quoted_order = quoted.get_json()["order"]
    assert quoted_order["status"] == "quoted"
    assert quoted_order["items"][0]["sourcing_state"] == "available"
    assert quoted_order["breakdown"]["goods_total"] == 8000
    assert quoted_order["breakdown"]["deposit_due"] == round(quoted_order["breakdown"]["total"] * 0.5, 2)

    # Bank transfer, then admin confirms
    pay = client.post(
        f"/api/orders/{ref}/payments",
        json={"method": "bank_transfer", "amount_usd": quoted_order["breakdown"]["deposit_due"]},
    )
    assert pay.status_code == 201, pay.get_json()
    payment_id = pay.get_json()["payment"]["id"]

    proof = client.post(
        f"/api/orders/{ref}/payments/{payment_id}/proof",
        data={"proof": (io.BytesIO(b"%PDF-1.4 test"), "proof.pdf")},
        content_type="multipart/form-data",
    )
    assert proof.status_code == 200, proof.get_json()
    assert proof.get_json()["payment"]["status"] == "proof_submitted"

    confirmed = admin_client.post(f"/api/admin/payments/{payment_id}/confirm", json={"confirm": True})
    assert confirmed.status_code == 200
    settled = confirmed.get_json()["order"]
    assert settled["status"] == "deposit_paid"
    assert settled["items"][0]["sourcing_state"] == "reserved"
    assert settled["breakdown"]["paid_total"] == quoted_order["breakdown"]["deposit_due"]

    # Cannot close while balance outstanding
    blocked = admin_client.patch(
        f"/api/admin/orders/{ref}/status", json={"status": "delivered"}
    )
    assert blocked.status_code == 400

    # Pay the balance then deliver
    balance = settled["breakdown"]["balance_due"]
    pay2 = client.post(
        f"/api/orders/{ref}/payments",
        json={"method": "cash_on_delivery", "amount_usd": balance},
    )
    assert pay2.status_code == 201
    admin_client.post(
        f"/api/admin/payments/{pay2.get_json()['payment']['id']}/confirm", json={"confirm": True}
    )
    delivered = admin_client.patch(
        f"/api/admin/orders/{ref}/status", json={"status": "delivered", "note": "Handed over"}
    )
    assert delivered.status_code == 200
    assert delivered.get_json()["order"]["status"] == "delivered"

    # Status history reflects each transition
    statuses = [e["status"] for e in delivered.get_json()["order"]["events"]]
    assert statuses[0] == "quote_requested"
    assert "quoted" in statuses and statuses[-1] == "delivered"


def test_partial_deposit_does_not_reserve_engine(app, client, admin_client, customer, engine):
    created = client.post(
        "/api/orders", json={"items": [{"engine_id": engine["id"], "quantity": 1}]}
    )
    order = created.get_json()["order"]
    reference = order["reference"]
    item_id = order["items"][0]["id"]

    admin_client.patch(
        f"/api/admin/orders/{reference}/quote",
        json={"items": [{"id": item_id, "unit_price_usd": engine["guide_price_usd"]}]},
    )
    partial = client.post(
        f"/api/orders/{reference}/payments",
        json={"method": "cash_on_delivery", "amount_usd": 1},
    )
    admin_client.post(
        f"/api/admin/payments/{partial.get_json()['payment']['id']}/confirm",
        json={"confirm": True},
    )
    after_partial = client.get(f"/api/orders/{reference}").get_json()["order"]
    assert after_partial["status"] == "quoted"
    assert after_partial["items"][0]["sourcing_state"] == "available"

    remaining = after_partial["breakdown"]["deposit_due"] - after_partial["breakdown"]["paid_total"]
    final_deposit = client.post(
        f"/api/orders/{reference}/payments",
        json={"method": "cash_on_delivery", "amount_usd": remaining},
    )
    admin_client.post(
        f"/api/admin/payments/{final_deposit.get_json()['payment']['id']}/confirm",
        json={"confirm": True},
    )
    after_deposit = client.get(f"/api/orders/{reference}").get_json()["order"]
    assert after_deposit["status"] == "deposit_paid"
    assert after_deposit["items"][0]["sourcing_state"] == "reserved"


def test_customers_cannot_read_other_orders(app, engine):
    client = app.test_client()
    client.post(
        "/api/auth/register",
        json={
            "name": "Owner",
            "email": "owner@example.com",
            "phone": "0771111111",
            "password": "Password123",
        },
    )
    res = client.post(
        "/api/orders", json={"items": [{"engine_id": engine["id"], "quantity": 1}]}
    )
    ref = res.get_json()["order"]["reference"]
    client.post("/api/auth/logout")

    client.post(
        "/api/auth/register",
        json={
            "name": "Third",
            "email": "third@example.com",
            "phone": "0773333333",
            "password": "Password123",
        },
    )
    assert client.get(f"/api/orders/{ref}").status_code == 403


def test_cancel_allowed_only_before_payment(app, customer, engine):
    client = app.test_client()
    client.post(
        "/api/auth/login", json={"email": customer["email"], "password": "Password123"}
    )
    res = client.post(
        "/api/orders", json={"items": [{"engine_id": engine["id"], "quantity": 1}]}
    )
    ref = res.get_json()["order"]["reference"]
    cancel = client.post(f"/api/orders/{ref}/cancel")
    assert cancel.status_code == 200
    assert cancel.get_json()["order"]["status"] == "cancelled"
    assert client.post(f"/api/orders/{ref}/cancel").status_code == 400


def test_admin_endpoints_require_admin(app, customer):
    client = app.test_client()
    client.post(
        "/api/auth/login", json={"email": customer["email"], "password": "Password123"}
    )
    for path in ("/api/admin/orders", "/api/admin/stats", "/api/admin/leads", "/api/admin/customers"):
        assert client.get(path).status_code == 403
    assert app.test_client().get("/api/admin/orders").status_code == 401


def test_paynow_unconfigured_is_rejected(app, admin_client, engine):
    res = admin_client.post(
        "/api/orders", json={"items": [{"engine_id": engine["id"], "quantity": 1}]}
    )
    ref = res.get_json()["order"]["reference"]
    admin_client.patch(
        f"/api/admin/orders/{ref}/quote",
        json={"items": [{"id": res.get_json()["order"]["items"][0]["id"], "unit_price_usd": 4200}]},
    )
    pay = admin_client.post(f"/api/orders/{ref}/payments", json={"method": "paynow"})
    assert pay.status_code == 503


def test_payment_methods_endpoint(client):
    methods = client.get("/api/payment-methods").get_json()["methods"]
    names = {m["value"] for m in methods}
    assert {"paynow", "bank_transfer", "cash_on_delivery"} <= names
