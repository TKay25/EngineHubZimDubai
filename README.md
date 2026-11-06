# ZimOsaka AutoSpares

Web system + WhatsApp chatbot for **pre-ordering engines from Dubai**, landed in Zimbabwe.

Nothing is held in stock: the catalog lists engine *types we can source*, and every order is
sourced to order with a full landed-cost quote (supplier price + sea freight + insurance +
ZIMRA duty/VAT/surtax + clearing + inland delivery).

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Vite + React Router (built into `static/assets`, shell is `templates/index.html`) |
| API | Python Flask (application factory in `app.py`) |
| DB | PostgreSQL in production (`DATABASE_URL`), SQLite fallback for local dev |
| Chatbot | Meta WhatsApp Cloud API webhook + state-machine bot (`chatbot.py`, `whatsapp.py`) |
| Payments | Paynow Zimbabwe (EcoCash/OneMoney/ZIPIT/Visa/MC), bank transfer with proof upload, cash on delivery |

## Layout

```
app.py              Flask app factory / entry point (gunicorn app:app)
config.py           Environment-driven configuration
models.py           User, Engine (catalog type), Order, OrderItem, Payment, OrderEvent, Chat*, Lead
pricing.py          Landed-cost engine
api_auth.py         /api/auth/*       register, login, profile
api_catalog.py      /api/engines, /api/quote-estimate, /api/leads
api_orders.py       /api/orders, /api/admin/*
api_payments.py     /api/orders/<ref>/payments, /api/paynow/result, admin confirm
api_webhooks.py     /webhook/whatsapp (Meta), /api/chat/web (site widget sandbox)
chatbot.py          WhatsApp conversation flow
whatsapp.py         Cloud API client + order notifications
bootstrap.py        Create tables / additive migrations / seed (used by release step)
seed.py             Demo catalog + admin bootstrap
templates/index.html  Flask template for the React app
src/                React source (pages, components, lib)
tests/              pytest suite
```

## Local development

```powershell
# backend
python -m pip install -r requirements.txt
Copy-Item .env.example .env      # then edit values
python app.py                    # http://127.0.0.1:5000

# frontend (hot reload, proxies /api to Flask)
npm install
npm run dev                      # http://localhost:5173
```

For a production-style run, build once and let Flask serve it:

```powershell
npm run build
python app.py
```

`npm run build` writes hashed assets + Vite manifest into `static/assets`; Flask reads the
manifest to inject the right `<script>`/`<link>` tags.

## Tests

```powershell
python -m pytest tests -q     # 29 tests: catalog, pricing, ordering, payments, access control, bot
npm run lint                  # ESLint on src/
```

Tests use an isolated SQLite database, so they never touch your dev or seeded data.

## Real data, not demo data

Everything customers see is stored in the database and editable from **Admin ? Brand & settings**
and **Admin ? Catalog**:

| Stored in the database | Table |
|---|---|
| Company name, tagline, contacts, address, office hours, bank/Paynow notes | `company_settings` |
| Duty/VAT/surtax rates, freight %, insurance %, clearing, inland, deposit % | `company_settings` |
| Engine types we source (make, model code, cc, fuel, condition, lead time, guide price) | `engines` |
| Customers, orders, line items, payments, proof-of-payment files, status history | `users`, `orders`, `order_items`, `payments`, `order_events` |
| Chat conversations and bot state | `chat_messages`, `chat_sessions` |
| Quote requests captured before an account exists | `leads` |

`SEED_DEMO_DATA=false` (the production default) starts with an **empty catalog** ? you add
your real engine types in the admin console, and the site/bot pick them up immediately.
No company details, prices or rates are hard-coded in the Python or React sources.

## Configuration

All settings come from environment variables (see `.env.example`). Never commit `.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Render/Postgres connection string (`postgres://` is auto-normalised) |
| `SECRET_KEY` | Session signing key |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Creates the first admin on boot if absent |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token you set in the Meta app |
| `WHATSAPP_APP_SECRET` | Verifies `X-Hub-Signature-256`; webhook refuses unsigned calls |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Outbound sends |
| `WHATSAPP_NOTIFY_ON_STATUS` | Push status changes to the customer |
| `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY` | Paynow transactions + result hash check |
| `PAYNOW_RESULT_URL`, `PAYNOW_RETURN_URL` | Paynow callbacks (point at your deployed domain) |
| `SEED_DEMO_DATA` | `false` in production. `true` seeds a sample catalog for local testing only |
| `SESSION_COOKIE_SECURE` | Set `true` when serving over HTTPS |

## Brand assets

Generated SVGs live in `static/brand/` (`logo.svg`, `mark.svg`, `monogram.svg`, `favicon.svg`) and
are produced by `python brand_assets.py`. The primary mark is the **ZO monogram** (Z + accelerator
ring + spark).

Design system: **navy, white and gold**

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f7f9fc` | page ground |
| `--ink` | `#15243d` | text, rules, primary buttons |
| `--accent` | `#8b6814` | accessible gold accent for CTAs, active states and emphasis |
| `--hair` / `--hair-strong` | `#d8e0eb` / `#b7c3d3` | hairlines and card borders |

Typography: **Archivo** (display, uppercase micro-labels), **Inter Tight** (body),
**Instrument Serif** italic (editorial emphasis). Numbers are tabular via `.mono`.

## Advertising posters

Twenty print-ready, 4:5 SVG posters and an A4 print sheet are in [`marketing/posters/`](./marketing/posters/).
Open `index.html` to preview and download individual posters; image credits and licenses are listed in
[`CREDITS.md`](./marketing/posters/CREDITS.md).

## Order lifecycle

`quote_requested -> quoted -> deposit_paid -> sourcing -> purchased -> shipped -> customs_clearing -> delivered`
(with `cancelled` before payment).

- Customer submits a sourcing request (web cart or WhatsApp) - no payment is taken yet.
- Admin sets supplier pricing, freight/insurance/clearing/inland, duty/VAT/surtax and deposit %; the status becomes `quoted` and the customer is notified on WhatsApp.
- Customer pays the deposit via Paynow, bank transfer (uploads proof for admin confirmation) or records cash on delivery.
- Admin advances status; each change is timestamped in the order timeline and pushed to WhatsApp.
- Delivery is blocked while a balance remains outstanding.

## WhatsApp bot

The bot is catalog-driven and works for numbers without an account:

The bot is **button-driven**, not numbered menus:

- Welcome: **Browse engines ? Track my order ? Get a quote**
- Catalogue: a native WhatsApp list of engine types; each engine shows the landed-cost guide with
  **Add to request ? Keep browsing ? View request**
- Request: **Request quote ? Add another ? Clear request**
- Progress: totals, deposit and balance with a progress bar; **Check my order** and **Browse engines**
- **Get a quote** asks for the engine details and stores them as a lead

Typed keywords (`hi`, `menu`, `track`, `cart`, `order`) and digits still work as a fallback, and
the same options render as tappable buttons in the website chat widget.

Webhook URL to register in Meta: `https://<your-domain>/webhook/whatsapp`
(verify token = `WHATSAPP_VERIFY_TOKEN`).

## Deploy to Render

`render.yaml` is included:

- Blueprint provisions the web service + a Postgres database named `topclass`.
- Build: `pip install -r requirements.txt && npm ci && npm run build`
- Start: `gunicorn app:app --workers 2 --threads 4 --timeout 60`
- Release: `python release.py` (creates tables/migrations and seeds)
- Health check: `/healthz`

Add the WhatsApp and Paynow secrets under the service Environment tab.

## Known limitations

- Paynow integration follows the documented web-initiation/hash contract but has not been exercised against live Paynow credentials.
- Proof-of-payment files are stored on the web instance local disk (`uploads/proofs`); use object storage if you scale to multiple instances or redeploy often.
- `bootstrap.py` does additive `ALTER TABLE` migrations only; introduce Alembic/Flask-Migrate before making destructive schema changes.
