"""First-run setup: company settings row + optional demo catalog.

Production runs with SEED_DEMO_DATA=false and starts with an empty catalog that
operations fill in from the admin console. No business data is hard-coded.
"""
import logging

from flask import current_app

from config import get_settings
from models import Engine, User, db

log = logging.getLogger(__name__)


def seed_if_empty():
    """Ensure the settings row exists and bootstrap the first admin account."""
    get_settings()
    _ensure_admin()
    if not current_app.config.get("SEED_DEMO_DATA"):
        return
    if Engine.query.count() > 0:
        return
    _seed_demo_catalog()


ENGINES = [
    # make, model_code, title, cc, fuel, cylinders, transmission, condition,
    # lead_days, guide_price, includes, featured, description
    ("Toyota", "1HZ", "Toyota 1HZ 4.2L Diesel", 4164, "diesel", 6, "manual", "used_jdm", 30,
     4200, "Injection pump, alternator, starter", True,
     "Legendary Land Cruiser 70-series workhorse. Sourced as complete used JDM unit."),
    ("Toyota", "1KD-FTV", "Toyota 1KD-FTV 3.0 D-4D", 2982, "diesel", 4, "manual", "used_jdm", 28,
     2600, "Turbo, injectors, ECU on request", True,
     "Hilux/Fortuner 3.0 D-4D. Commonly replaced in Hilux Vigo and Fortuner."),
    ("Toyota", "2TR-FE", "Toyota 2TR-FE 2.7 Petrol", 2694, "petrol", 4, "manual", "used_jdm", 28,
     1900, "ECU, harness on request", False,
     "Hilux, Fortuner and Hiace petrol unit."),
    ("Toyota", "2KD-FTV", "Toyota 2KD-FTV 2.5 D-4D", 2494, "diesel", 4, "manual", "used_jdm", 30,
     2050, "Turbo, injection pump", False,
     "Hilux 2.5 D-4D diesel."),
    ("Hino", "J08E", "Hino J08E 7.7L Diesel", 7684, "diesel", 6, "manual", "used_jdm", 40,
     6500, "Injection pump, turbo", True,
     "Hino 500-series truck engine, popular for haulage fleets."),
    ("Isuzu", "4HK1", "Isuzu 4HK1 5.2L Diesel", 5193, "diesel", 4, "manual", "used_jdm", 38,
     5400, "Turbo, injectors", False,
     "Isuzu NQR/FVR truck engine."),
    ("Nissan", "YD25", "Nissan YD25DDTi 2.5 Diesel", 2488, "diesel", 4, "manual", "used_jdm", 30,
     2300, "Turbo, injection pump", False,
     "Navara / NP300 diesel unit."),
    ("Nissan", "ZD30", "Nissan ZD30DDTi 3.0 Diesel", 2953, "diesel", 4, "manual", "used_jdm", 32,
     2900, "Turbo, injection pump", False,
     "Patrol / Hardbody 3.0 diesel."),
    ("Mitsubishi", "4D56", "Mitsubishi 4D56 2.5 Diesel", 2477, "diesel", 4, "manual", "used_jdm", 30,
     2100, "Turbo, injection pump", False,
     "L200 / Triton 2.5 diesel."),
    ("Mercedes-Benz", "OM642", "Mercedes OM642 3.0 CDI", 2987, "diesel", 6, "automatic", "used_jdm", 35,
     4800, "Turbo, injectors, ECU on request", False,
     "Sprinter / E-Class V6 diesel."),
    ("Toyota", "1GR-FE", "Toyota 1GR-FE 4.0 V6 Petrol", 3956, "petrol", 6, "automatic", "used_jdm", 33,
     3600, "ECU, harness on request", False,
     "Land Cruiser Prado / Hilux V6 petrol."),
    ("Cummins", "ISDe", "Cummins ISDe 6.7 Diesel", 6690, "diesel", 6, "manual", "reconditioned", 45,
     7900, "Long block, injectors", False,
     "Reconditioned commercial unit with warranty on rebuild."),
]


def _seed_demo_catalog():
    for row in ENGINES:
        (
            make, model_code, title, cc, fuel, cyl, transmission, condition,
            lead_days, price, includes, featured, description,
        ) = row
        db.session.add(
            Engine(
                make=make,
                model_code=model_code,
                title=title,
                displacement_cc=cc,
                fuel=fuel,
                cylinders=cyl,
                transmission=transmission,
                condition=condition,
                typical_lead_days=lead_days,
                guide_price_usd=price,
                includes=includes,
                featured=featured,
                description=description,
            )
        )
    db.session.commit()
    log.info("Seeded %s demo engines (SEED_DEMO_DATA=true)", len(ENGINES))


def _ensure_admin():
    email = (current_app.config.get("ADMIN_EMAIL") or "").strip().lower()
    password = current_app.config.get("ADMIN_PASSWORD") or ""
    if not email or not password:
        log.warning("ADMIN_EMAIL/ADMIN_PASSWORD not set - no admin account created")
        return
    user = User.query.filter_by(email=email).first()
    if user is None:
        user = User(email=email, name="Operations Admin", is_admin=True)
        db.session.add(user)
        log.info("Created admin account %s", email)
    else:
        user.is_admin = True
    user.set_password(password)
    db.session.commit()
