"""Schema creation / migration helpers shared by CLI and deployment."""
import logging

from models import db

log = logging.getLogger(__name__)


def upgrade():
    """Create tables if missing and run lightweight column migrations.

    Safe to run repeatedly. Additive only: existing rows are preserved.
    Returns the configured Flask app.
    """
    from app import create_app

    app = create_app()
    with app.app_context():
        _rename_legacy_tables()
        db.create_all()
        _add_missing_columns()
        from config import get_settings

        _ensure_default_row(get_settings)
        from seed import seed_if_empty

        seed_if_empty()
        log.info("Database schema is up to date")
    return app


def _rename_legacy_tables():
    """Older deployments used an ``enginehub_*`` prefix; keep their data."""
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    existing = set(inspector.get_table_names())
    for old, new in (("enginehub_users", "users"), ("enginehub_orders", "orders")):
        if old in existing and new not in existing:
            with db.engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {old} RENAME TO {new}"))


def _ensure_default_row(getter):
    """Create the settings row directly so ORM column additions never break boot."""
    from sqlalchemy import text

    with db.engine.begin() as conn:
        existing = conn.execute(text("SELECT id FROM company_settings LIMIT 1")).first()
    if existing:
        return
    getter()


def _add_missing_columns():
    """Add columns introduced after the first deployment (additive only)."""
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())

    def add(table, columns):
        if table not in tables:
            return
        existing = {col["name"] for col in inspector.get_columns(table)}
        with db.engine.begin() as conn:
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))

    add(
        "orders",
        {
            "freight_usd": "NUMERIC(12,2) DEFAULT 0",
            "insurance_usd": "NUMERIC(12,2) DEFAULT 0",
            "clearing_usd": "NUMERIC(12,2) DEFAULT 0",
            "inland_usd": "NUMERIC(12,2) DEFAULT 0",
            "duty_rate": "NUMERIC(6,4) DEFAULT 0",
            "vat_rate": "NUMERIC(6,4) DEFAULT 0",
            "surtax_rate": "NUMERIC(6,4) DEFAULT 0",
            "deposit_pct": "NUMERIC(5,2) DEFAULT 50",
            "status_note": "VARCHAR(255)",
            "quoted_at": "TIMESTAMP WITH TIME ZONE",
            "invoice_number": "VARCHAR(24)",
        },
    )
    add(
        "engines",
        {
            "condition_grade": "VARCHAR(8)",
            "warranty_days": "INTEGER DEFAULT 90",
            "warranty_note": "VARCHAR(255)",
            "fits_vehicles": "TEXT",
            "image_url": "VARCHAR(500)",
            "updated_at": "TIMESTAMP WITH TIME ZONE",
        },
    )
    add(
        "order_items",
        {
            "supplier": "VARCHAR(120)",
            "supplier_ref": "VARCHAR(80)",
            "lot_number": "VARCHAR(60)",
            "serial_number": "VARCHAR(80)",
            "inspection_note": "VARCHAR(255)",
        },
    )
    add(
        "company_settings",
        {
            "registration_number": "VARCHAR(80)",
            "established_year": "INTEGER",
            "warranty_summary": "VARCHAR(255)",
            "inspection_process": "TEXT",
            "orders_fulfilled": "INTEGER DEFAULT 0",
        },
    )
    add(
        "payments",
        {
            "merchant_reference": "VARCHAR(80)",
        },
    )

    from sqlalchemy import Index
    from models import Payment

    Index(
        "ix_payments_merchant_reference",
        Payment.merchant_reference,
        unique=True,
    ).create(db.engine, checkfirst=True)


if __name__ == "__main__":
    upgrade()
