"""Shared pytest fixtures: isolated SQLite database per test session."""
import os
import pathlib
import sys
import tempfile

import uuid

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_TMP = pathlib.Path(tempfile.mkdtemp(prefix="enginehub-test-"))
DB_FILE = _TMP / "test.db"
os.environ["DATABASE_URL"] = "sqlite:///" + str(DB_FILE).replace("\\", "/")
os.environ["SEED_DEMO_DATA"] = "true"
os.environ["ADMIN_EMAIL"] = "admin@enginehub.local"
os.environ["ADMIN_PASSWORD"] = "Admin12345!"
os.environ["WHATSAPP_APP_SECRET"] = "test-secret"
os.environ["WHATSAPP_VERIFY_TOKEN"] = "verify-me"
os.environ["SESSION_COOKIE_SECURE"] = "false"


@pytest.fixture(scope="session")
def app():
    from app import create_app

    application = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False})
    yield application


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def customer(client):
    email = f"tendai-{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Tendai Customer",
            "email": email,
            "phone": "0771234567",
            "password": "Password123",
        },
    )
    assert res.status_code == 201, res.get_json()
    return res.get_json()["user"]


@pytest.fixture()
def admin_client(app):
    client = app.test_client()
    res = client.post(
        "/api/auth/login",
        json={"email": "admin@enginehub.local", "password": "Admin12345!"},
    )
    assert res.status_code == 200, res.get_json()
    return client


@pytest.fixture()
def engine(app):
    from models import Engine

    with app.app_context():
        return Engine.query.filter_by(model_code="1HZ").first().to_dict()
