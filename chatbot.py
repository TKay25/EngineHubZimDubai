"""WhatsApp conversational ordering bot.

Everything is catalogue-driven and driven by native WhatsApp buttons / list rows
(the web widget receives the same option IDs), so nothing depends on customers
remembering numbered replies. Typed numbers and keywords still work as a
fallback.
"""
import json
import logging
import secrets

from flask import current_app

from auth_utils import normalise_phone
from config import get_settings
from models import (
    ORDER_STATUSES,
    STATUS_LABELS,
    ChatSession,
    Engine,
    Lead,
    Order,
    OrderEvent,
    OrderItem,
    User,
    db,
)
from pricing import landed_cost_estimate
from whatsapp import send_buttons, send_list, send_text

log = logging.getLogger(__name__)

PAGE_SIZE = 10
TRACK_STEPS = [s for s in ORDER_STATUSES if s != "cancelled"]

MENU_WORDS = {"menu", "hi", "hello", "hey", "start", "restart", "main menu"}

# Option IDs used by both the Cloud API buttons and the web widget.
ACTIONS = {
    "MENU_BROWSE": "browse",
    "MENU_TRACK": "track",
    "MENU_QUOTE": "quote",
    "MENU_CART": "cart",
    "MENU_ORDER": "order",
    "MENU_CLEAR": "clear",
    "MENU_REGISTER": "register",
    "ADD_ENGINE": "add",
}

KEYWORDS = {
    "browse": "browse",
    "engines": "browse",
    "catalog": "browse",
    "catalogue": "browse",
    "track": "track",
    "status": "track",
    "quote": "quote",
    "custom": "quote",
    "cart": "cart",
    "basket": "cart",
    "request": "cart",
    "order": "order",
    "place": "order",
    "submit": "order",
    "clear": "clear",
    "register": "register",
    "sign up": "register",
    "add": "add",
    "engine": "add",
}


def new_reference():
    """Short order reference such as ZOA-1A2B3C."""
    return "ZOA-" + secrets.token_hex(3).upper()


def money(value):
    return f"{float(value or 0):,.2f}"


# ---------------------------------------------------------------- state


def get_session(wa_id):
    session = ChatSession.query.filter_by(wa_id=wa_id).first()
    if session is None:
        session = ChatSession(wa_id=wa_id, state="menu", cart="[]")
        db.session.add(session)
        db.session.commit()
    return session


def load_cart(session):
    try:
        data = json.loads(session.cart or "[]")
        return data if isinstance(data, list) else []
    except (ValueError, TypeError):
        return []


def save_cart(session, cart):
    session.cart = json.dumps(cart)
    db.session.commit()


def user_for(wa_id):
    return User.query.filter(User.phone == wa_id).first()


def catalog_engines():
    return (
        Engine.query.filter_by(sourcing_available=True)
        .order_by(Engine.featured.desc(), Engine.make.asc())
        .all()
    )


def _home_buttons(session):
    buttons = [("MENU_BROWSE", "Browse engines")]
    if load_cart(session):
        buttons.append(("MENU_CART", "My request"))
        buttons.append(("MENU_ORDER", "Request quote"))
    else:
        buttons.append(("MENU_TRACK", "Track order"))
        buttons.append(("MENU_QUOTE", "Get a quote"))
    return buttons


# ---------------------------------------------------------------- screens


def welcome(wa_id, name=None, session=None):
    greeting = f"Hi {name}! " if name else ""
    settings = get_settings()
    buttons = [
        ("MENU_BROWSE", "Browse engines"),
        ("MENU_TRACK", "Track my order"),
        ("MENU_QUOTE", "Get a quote"),
    ]
    if session and load_cart(session):
        buttons[2] = ("MENU_CART", "Review request")
    send_buttons(
        wa_id,
        f"{greeting}Welcome to *{settings.company_name}*.\n"
        "We source engines from Dubai to order, then quote the full landed cost "
        "delivered to Zimbabwe. What would you like to do?",
        buttons,
    )


def show_catalog(wa_id):
    engines = catalog_engines()[:PAGE_SIZE]
    if not engines:
        send_buttons(
            wa_id,
            "Our catalog is being updated right now. You can still send us the engine "
            "you need and we will source it.",
            [("MENU_QUOTE", "Send a request")],
        )
        return
    rows = [
        (
            f"engine_{e.id}",
            f"{e.make} {e.model_code}",
            f"{e.displacement_cc or '-'}cc | from USD {money(e.guide_price_usd)}",
        )
        for e in engines
    ]
    send_list(
        wa_id,
        "These are engine *types we can source to order* - nothing is held in stock. "
        "Choose one for the landed-cost guide.",
        "View engines",
        rows,
    )


def show_search(wa_id, engines, session=None):
    lines = ["*Matches in our catalog:*", ""]
    for idx, e in enumerate(engines, start=1):
        lines.append(
            f"{idx}. {e.title} - from USD {money(e.guide_price_usd)} "
            f"({e.typical_lead_days} days)"
        )
    lines += ["", "Tap *Browse engines* to choose one."]
    buttons = [("MENU_BROWSE", "Browse engines")]
    buttons.append(
        ("MENU_CART", "View request") if session and load_cart(session) else ("MENU_QUOTE", "Get a quote")
    )
    send_buttons(wa_id, "\n".join(lines), buttons)


def show_engine(wa_id, session, engine):
    est = landed_cost_estimate(engine.guide_price_usd)
    includes = ", ".join(engine.includes_list()) or "engine only"
    send_text(
        wa_id,
        f"*{engine.title}*\n"
        f"{engine.displacement_cc or '-'}cc {engine.fuel}, "
        f"{engine.condition.replace('_', ' ')}\n"
        f"Includes: {includes}\n"
        f"Typical lead time: {engine.typical_lead_days} days\n\n"
        f"*Guide supplier price:* USD {money(engine.guide_price_usd)}\n"
        f"Freight (est.): USD {money(est['freight'])}\n"
        f"Duty (est.): USD {money(est['duty'])}\n"
        f"VAT (est.): USD {money(est['vat'])}\n"
        f"Clearing + delivery (est.): USD {money(est['clearing'] + est['inland'])}\n"
        f"*Estimated landed total:* USD {money(est['total'])}",
    )
    send_buttons(
        wa_id,
        f"Estimated landed total USD {money(est['total'])}. Add it to your request?",
        [
            ("ADD_ENGINE", "Add to request"),
            ("MENU_BROWSE", "Keep browsing"),
            ("MENU_CART", "View request"),
        ],
    )
    session.state = f"viewing:{engine.id}"
    db.session.commit()


def show_cart(wa_id, session):
    cart = load_cart(session)
    if not cart:
        send_buttons(
            wa_id,
            "Your sourcing request is empty. Pick an engine type to get started.",
            [("MENU_BROWSE", "Browse engines"), ("MENU_QUOTE", "Get a quote")],
        )
        return
    lines = ["*Your sourcing request:*", ""]
    total = 0.0
    for row in cart:
        engine = db.session.get(Engine, row.get("engine_id"))
        if not engine:
            continue
        line = float(engine.guide_price_usd) * int(row.get("quantity", 1))
        total += line
        lines.append(f"- {engine.title} x{row['quantity']} = USD {money(line)}")
    lines += ["", f"Guide total (excl. duty/freight): USD {money(total)}"]
    send_buttons(
        wa_id,
        "\n".join(lines),
        [
            ("MENU_ORDER", "Request quote"),
            ("MENU_BROWSE", "Add another"),
            ("MENU_CLEAR", "Clear request"),
        ],
    )


def place_order(wa_id, session, user):
    if not user:
        session.state = "awaiting_name"
        db.session.commit()
        send_text(
            wa_id,
            "I need to link this WhatsApp number to an account before raising a request.\n"
            "What name should I use?",
        )
        return
    cart = load_cart(session)
    if not cart:
        send_buttons(
            wa_id,
            "Your sourcing request is empty.",
            [("MENU_BROWSE", "Browse engines")],
        )
        return

    settings = get_settings()
    order = Order(
        reference=new_reference(),
        customer_id=user.id,
        status="quote_requested",
        fulfillment="delivered_zimbabwe",
        duty_rate=settings.duty_rate,
        vat_rate=settings.vat_rate,
        surtax_rate=settings.surtax_rate,
        deposit_pct=settings.default_deposit_pct,
        clearing_usd=0,
        inland_usd=0,
        notes="Placed via WhatsApp",
    )
    goods = 0.0
    for row in cart:
        engine = db.session.get(Engine, row.get("engine_id"))
        if not engine:
            continue
        qty = max(1, min(int(row.get("quantity", 1)), 20))
        order.items.append(
            OrderItem(
                engine_id=engine.id,
                quantity=qty,
                unit_price_usd=engine.guide_price_usd,
                sourcing_state="requested",
            )
        )
        goods += float(engine.guide_price_usd) * qty
    if not order.items:
        send_buttons(wa_id, "Those engines are no longer listed.", [("MENU_BROWSE", "Browse engines")])
        return

    order.freight_usd = round(max(float(settings.default_freight_min), goods * float(settings.default_freight_pct)), 2)
    order.insurance_usd = round(goods * float(settings.insurance_pct), 2)
    db.session.add(order)
    db.session.flush()
    order.events.append(OrderEvent(status="quote_requested", note="Received via WhatsApp."))
    session.cart = "[]"
    session.state = "menu"
    session.active_order_id = order.id
    db.session.commit()

    send_buttons(
        wa_id,
        f"Sourcing request *{order.reference}* created.\n"
        "Our Dubai desk will confirm pricing and send a proforma with the full landed "
        "cost (freight, duty, VAT, clearing, delivery).",
        [("MENU_TRACK", "Track my order"), ("MENU_BROWSE", "Browse engines")],
    )


def show_tracking(wa_id, user):
    if not user:
        send_buttons(
            wa_id,
            "I could not find an account linked to this number yet.",
            [("MENU_BROWSE", "Browse engines"), ("MENU_QUOTE", "Get a quote")],
        )
        return
    order = Order.query.filter_by(customer_id=user.id).order_by(Order.created_at.desc()).first()
    if not order:
        send_buttons(
            wa_id,
            "You have no sourcing requests yet.",
            [("MENU_BROWSE", "Browse engines")],
        )
        return
    try:
        position = TRACK_STEPS.index(order.status) + 1
    except ValueError:
        position = 0
    bar = "".join("●" if i < position else "○" for i in range(len(TRACK_STEPS)))
    lines = [
        f"*{order.reference}* - {STATUS_LABELS.get(order.status, order.status)}",
        f"{bar} ({position}/{len(TRACK_STEPS)})",
        "",
        f"Total: USD {money(order.total)}",
        f"Deposit due: USD {money(order.deposit_due)}",
        f"Paid: USD {money(order.paid_total)}",
        f"Balance: USD {money(order.balance_due)}",
    ]
    if order.status_note:
        lines += ["", f"Update: {order.status_note}"]
    send_buttons(
        wa_id,
        "\n".join(lines),
        [("MENU_BROWSE", "Browse engines"), ("MENU_QUOTE", "Get a quote")],
    )


def _register(wa_id, session, user_name):
    from werkzeug.security import generate_password_hash

    name = (user_name or "").strip()[:80] or "WhatsApp customer"
    digits = wa_id[-7:] if len(wa_id) >= 7 else wa_id
    user = User(
        email=f"{wa_id}@whatsapp.local",
        name=name,
        phone=wa_id,
        # Random password: the customer can set their own on the website later.
        password_hash=generate_password_hash(secrets.token_urlsafe(24) + digits),
    )
    db.session.add(user)
    db.session.commit()
    session.user_id = user.id
    session.state = "menu"
    db.session.commit()
    send_buttons(
        wa_id,
        f"Thanks {name} - your account is ready.\n"
        "You can set an email and password on the website any time to see your orders there.",
        [
            ("MENU_BROWSE", "Browse engines"),
            ("MENU_CART", "Review request"),
            ("MENU_QUOTE", "Get a quote"),
        ],
    )
    return user


# ---------------------------------------------------------------- engine pick


def show_engine_index(wa_id, session, idx):
    engines = catalog_engines()[:PAGE_SIZE]
    if not (0 <= idx < len(engines)):
        show_catalog(wa_id)
        session.state = "browsing"
        db.session.commit()
        return None
    engine = engines[idx]
    show_engine(wa_id, session, engine)
    return engine


# ---------------------------------------------------------------- router


def handle_message(wa_id, body, name=None):
    wa_id = normalise_phone(wa_id) or wa_id
    raw = (body or "").strip()
    text = raw.lower()
    session = get_session(wa_id)
    user = user_for(wa_id) or (db.session.get(User, session.user_id) if session.user_id else None)

    action = ACTIONS.get(raw.upper()) or KEYWORDS.get(text)
    # Bare digits are list selections while browsing/searching, otherwise menu shortcuts.
    if text in {"1", "2", "3"} and session.state in ("browsing", "search_results"):
        action = None

    if text in MENU_WORDS:
        session.state = "menu"
        db.session.commit()
        welcome(wa_id, user.name.split()[0] if user else name, session=session)
        return

    if action == "browse":
        session.state = "browsing"
        db.session.commit()
        show_catalog(wa_id)
        return

    if action == "track":
        show_tracking(wa_id, user)
        return

    if action == "quote":
        session.state = "awaiting_question"
        db.session.commit()
        send_text(
            wa_id,
            "Send me the engine you need: make, model code, year, and whether new or used. "
            "Our Dubai sourcing desk will come back with options and a landed-cost quote.",
        )
        return

    if action == "cart":
        show_cart(wa_id, session)
        return

    if action == "clear":
        save_cart(session, [])
        send_buttons(
            wa_id,
            "Your sourcing request has been cleared.",
            [("MENU_BROWSE", "Browse engines"), ("MENU_QUOTE", "Get a quote")],
        )
        return

    if action == "order":
        place_order(wa_id, session, user)
        return

    if action == "register":
        session.state = "awaiting_name"
        db.session.commit()
        send_text(wa_id, "What name should I use for your account?")
        return

    if action == "add" and str(session.state).startswith("viewing:"):
        engine = db.session.get(Engine, int(str(session.state).split(":", 1)[1]))
        if not engine:
            send_buttons(wa_id, "That engine is no longer listed.", [("MENU_BROWSE", "Browse engines")])
            return
        cart = load_cart(session)
        for row in cart:
            if row.get("engine_id") == engine.id:
                row["quantity"] = min(int(row.get("quantity", 1)) + 1, 20)
                break
        else:
            cart.append({"engine_id": engine.id, "quantity": 1})
        save_cart(session, cart)
        session.state = "browsing"
        db.session.commit()
        send_buttons(
            wa_id,
            f"Added *{engine.title}* to your request.",
            [
                ("MENU_BROWSE", "Add another"),
                ("MENU_CART", "Review request"),
                ("MENU_ORDER", "Request quote"),
            ],
        )
        return

    if session.state == "awaiting_name" and raw:
        _register(wa_id, session, raw)
        return

    if session.state == "awaiting_registration":
        session.state = "awaiting_name"
        db.session.commit()
        send_text(wa_id, "What name should I use for your account?")
        return

    if session.state == "browsing" and text.isdigit():
        return show_engine_index(wa_id, session, int(text) - 1)

    if text.startswith("engine_") and text[7:].isdigit():
        engine = db.session.get(Engine, int(text.split("_", 1)[1]))
        if engine:
            show_engine(wa_id, session, engine)
            return

    if session.state == "awaiting_question" and raw:
        db.session.add(
            Lead(
                name=user.name if user else (name or "WhatsApp customer"),
                phone=wa_id,
                details=raw[:2000],
                channel="whatsapp",
            )
        )
        session.state = "menu"
        db.session.commit()
        send_buttons(
            wa_id,
            "Got it - our sourcing desk will come back with options and a landed-cost quote.",
            [("MENU_BROWSE", "Browse engines"), ("MENU_TRACK", "Track my order")],
        )
        return

    if session.state == "search_results" and text.isdigit():
        return show_engine_index(wa_id, session, int(text) - 1)

    matches = []
    if len(raw) >= 3:
        like = f"%{raw}%"
        matches = (
            Engine.query.filter(
                Engine.title.ilike(like)
                | Engine.make.ilike(like)
                | Engine.model_code.ilike(like)
            )
            .limit(PAGE_SIZE)
            .all()
        )
    if matches:
        session.state = "search_results"
        db.session.commit()
        show_search(wa_id, matches, session)
        return

    session.state = "menu"
    db.session.commit()
    welcome(wa_id, user.name.split(" ")[0] if user else name, session=session)
