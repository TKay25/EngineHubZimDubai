"""Application configuration, loaded from environment variables."""
import os
from datetime import timedelta

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def _bool(name, default=False):
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _int(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def get_settings():
    """Return the singleton company/settings row, creating defaults if absent."""
    from models import CompanySettings, db

    settings = db.session.get(CompanySettings, 1)
    if settings is None:
        settings = CompanySettings(
            id=1,
            company_name="ZimOsaka AutoSpares",
            tagline=(
                "Engines sourced from Dubai, delivered across Zimbabwe, with optional fitting "
                "by our Zimbabwe mechanics"
            ),
            phone="+263 77 000 0000",
            whatsapp="263770000000",
            email="sales@zimosaka.co.zw",
            address="Harare, Zimbabwe · Sourcing desk: Dubai, UAE",
            office_hours="Mon–Fri 08:00–17:00 · Sat 08:00–13:00",
            bank_details=(
                "Bank transfer / RTGS details are issued on your proforma invoice. "
                "Always quote your order reference."
            ),
            paynow_note="Paynow accepts EcoCash, OneMoney, ZIPIT and Visa/Mastercard.",
            registration_number="Company registration pending",
            established_year=2024,
            warranty_summary=(
                "90-day start-up warranty on complete used engines. Every unit is compression "
                "tested and inspected in Dubai before export."
            ),
            inspection_process=(
                "Compression test, oil-pressure check, leak inspection and a video walk-around "
                "are recorded for each unit before it leaves Dubai."
            ),
            orders_fulfilled=0,
            duty_rate=0.20,
            vat_rate=0.15,
            surtax_rate=0.05,
            default_freight_min=600,
            default_freight_pct=0.12,
            insurance_pct=0.015,
            default_clearing=450,
            default_inland=350,
            default_deposit_pct=50,
        )
        db.session.add(settings)
        db.session.commit()
    return settings


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-key-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = _bool("SESSION_COOKIE_SECURE", False)
    PERMANENT_SESSION_LIFETIME = timedelta(days=_int("SESSION_DAYS", 30))
    MAX_CONTENT_LENGTH = _int("MAX_UPLOAD_BYTES", 5 * 1024 * 1024)
    ENGINE_IMAGE_DIR = os.getenv(
        "ENGINE_IMAGE_DIR", os.path.join(BASE_DIR, "uploads", "engines")
    )

    DEFAULT_CURRENCY = "USD"

    # WhatsApp Cloud API (Meta)
    WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")
    WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v21.0")
    WHATSAPP_NOTIFY_ON_STATUS = _bool("WHATSAPP_NOTIFY_ON_STATUS", True)

    # Paynow Zimbabwe
    PAYNOW_INTEGRATION_ID = os.getenv("PAYNOW_INTEGRATION_ID", "")
    PAYNOW_INTEGRATION_KEY = os.getenv("PAYNOW_INTEGRATION_KEY", "")
    PAYNOW_RESULT_URL = os.getenv("PAYNOW_RESULT_URL", "")
    PAYNOW_RETURN_URL = os.getenv("PAYNOW_RETURN_URL", "")

    # Landing-cost assumptions (percentages unless noted). Real duty depends on
    # engine HS code / cc bands, which admins can override per quote.
    DUTY_RATE = float(os.getenv("DUTY_RATE", "0.20"))
    VAT_RATE = float(os.getenv("VAT_RATE", "0.15"))
    SURTAX_RATE = float(os.getenv("SURTAX_RATE", "0.05"))
    DUTY_BASE_ON_CIF = _bool("DUTY_BASE_ON_CIF", True)

    SEED_DEMO_DATA = _bool("SEED_DEMO_DATA", True)
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")


def resolve_database_uri(uri):
    """Render gives postgres:// which SQLAlchemy 2 rejects as a dialect alias."""
    if not uri:
        return None
    if uri.startswith("postgres://"):
        uri = uri.replace("postgres://", "postgresql+psycopg2://", 1)
    elif uri.startswith("postgresql://"):
        uri = uri.replace("postgresql://", "postgresql+psycopg2://", 1)
    return uri
