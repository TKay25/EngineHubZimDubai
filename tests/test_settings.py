"""Company settings and admin catalog management."""
import io


def test_public_site_settings_expose_brand(client):
    site = client.get("/api/site").get_json()["site"]
    assert site["company_name"] == "ZimOsaka AutoSpares"
    assert site["whatsapp_link"].startswith("https://wa.me/")
    assert site["payment_methods"]
    assert "catalog_size" in site


def test_admin_settings_update_changes_public_site(app, admin_client, client):
    res = admin_client.patch(
        "/api/admin/settings",
        json={"phone": "+263 78 123 4567", "default_deposit_pct": 40},
    )
    assert res.status_code == 200, res.get_json()
    site = client.get("/api/site").get_json()["site"]
    assert site["phone"] == "+263 78 123 4567"
    assert site["default_deposit_pct"] == 40


def test_settings_validation(app, admin_client):
    assert admin_client.patch("/api/admin/settings", json={"company_name": ""}).status_code == 400
    assert admin_client.patch("/api/admin/settings", json={"default_deposit_pct": 160}).status_code == 400
    assert admin_client.patch("/api/admin/settings", json={"duty_rate": "abc"}).status_code == 400


def test_new_order_uses_settings_rates(app, admin_client, engine):
    admin_client.patch("/api/admin/settings", json={"default_deposit_pct": 30, "duty_rate": 0.25})
    client = app.test_client()
    client.post(
        "/api/auth/register",
        json={
            "name": "Rate Tester",
            "email": "rates@example.com",
            "phone": "0775000111",
            "password": "Password123",
        },
    )
    res = client.post("/api/orders", json={"items": [{"engine_id": engine["id"], "quantity": 1}]})
    assert res.status_code == 201, res.get_json()
    order = res.get_json()["order"]
    assert order["deposit_pct"] == 30
    assert order["breakdown"]["duty_rate"] == 0.25


def test_admin_catalog_crud(app, admin_client, client):
    created = admin_client.post(
        "/api/admin/engines",
        json={
            "make": "Volvo",
            "model_code": "D7E",
            "title": "Volvo D7E 7.1L Diesel",
            "displacement_cc": 7140,
            "fuel": "diesel",
            "cylinders": 6,
            "transmission": "automatic",
            "condition": "used_jdm",
            "typical_lead_days": 42,
            "guide_price_usd": "7100.00",
            "includes": "Turbo, injectors",
            "sourcing_available": True,
            "featured": False,
        },
    )
    assert created.status_code == 201, created.get_json()
    engine_id = created.get_json()["engine"]["id"]

    public = client.get("/api/engines?q=D7E").get_json()["engines"]
    assert len(public) == 1 and public[0]["make"] == "Volvo"

    updated = admin_client.patch(
        f"/api/admin/engines/{engine_id}",
        json={"guide_price_usd": "7500.00", "sourcing_available": False},
    )
    assert updated.status_code == 200
    assert updated.get_json()["engine"]["guide_price_usd"] == 7500
    assert updated.get_json()["engine"]["sourcing_available"] is False

    duplicate = admin_client.post(
        "/api/admin/engines",
        json={"make": "Volvo", "model_code": "D7E", "title": "Dup", "guide_price_usd": 10},
    )
    assert duplicate.status_code == 400

    deleted = admin_client.delete(f"/api/admin/engines/{engine_id}")
    assert deleted.status_code == 200
    assert client.get(f"/api/engines/{engine_id}").status_code == 404


def test_admin_can_upload_engine_photo(app, admin_client, client, tmp_path, monkeypatch):
    photo_dir = tmp_path / "engine-photos"
    monkeypatch.setitem(app.config, "ENGINE_IMAGE_DIR", str(photo_dir))
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0bIDAT\x08\xd7"
        b"c\xf8\x0f\x00\x01\x01\x01\x00\x1c\xdd\x8d\xb4\x00\x00\x00\x00"
        b"IEND\xaeB`\x82"
    )

    created = admin_client.post(
        "/api/admin/engines",
        data={
            "make": "Volvo",
            "model_code": "D8K",
            "title": "Volvo D8K Diesel",
            "guide_price_usd": "7700",
            "image": (io.BytesIO(png), "engine.png"),
        },
        content_type="multipart/form-data",
    )
    assert created.status_code == 201, created.get_json()
    image_url = created.get_json()["engine"]["image_url"]
    assert image_url.startswith("/uploads/engines/")
    served = client.get(image_url)
    assert served.status_code == 200
    assert served.data == png
    assert list(photo_dir.iterdir())


def test_engine_photo_upload_rejects_non_image_files(admin_client):
    response = admin_client.post(
        "/api/admin/engines",
        data={
            "make": "Volvo",
            "model_code": "D9A",
            "title": "Volvo D9A Diesel",
            "guide_price_usd": "7800",
            "image": (io.BytesIO(b"<svg></svg>"), "engine.svg"),
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "JPEG, PNG or WebP" in response.get_json()["error"]


def test_catalog_endpoints_are_admin_only(client):
    assert client.get("/api/admin/engines").status_code == 401
    assert client.post("/api/admin/engines", json={}).status_code == 401
    assert client.patch("/api/admin/settings", json={}).status_code == 401
