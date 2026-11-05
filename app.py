"""Flask application factory."""
import os

from flask import Flask, jsonify, render_template, send_from_directory

from config import BASE_DIR, Config, resolve_database_uri
from manifest_utils import asset_urls, vite_dev
from models import db


def create_app(test_config=None):
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    uri = resolve_database_uri(app.config.get("SQLALCHEMY_DATABASE_URI"))
    if not uri:
        uri = "sqlite:///" + os.path.join(BASE_DIR, "zimosaka.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = uri

    db.init_app(app)

    from api_auth import bp as auth_bp
    from api_catalog import bp as catalog_bp
    from api_orders import bp as orders_bp
    from api_payments import bp as payments_bp
    from api_settings import bp as settings_bp
    from api_webhooks import bp as webhooks_bp
    from api_webhooks import chat_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(catalog_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(webhooks_bp)
    app.register_blueprint(chat_bp)

    @app.get("/")
    def index():
        return render_template("index.html", assets=asset_urls(), vite_dev=vite_dev())

    @app.context_processor
    def _inject_asset_helpers():
        return {"asset_urls": asset_urls, "vite_dev": vite_dev}

    @app.get("/healthz")
    def healthz():
        db.session.execute(db.text("SELECT 1"))
        return jsonify({"status": "ok"})

    @app.get("/<path:path>")
    def spa(path):
        """Client-side routes (e.g. /engines/3) are resolved by React Router."""
        if path.startswith(("api/", "webhook/")):
            return jsonify({"error": "Not found"}), 404
        return render_template("index.html", assets=asset_urls(), vite_dev=vite_dev())

    @app.get("/robots.txt")
    def robots():
        return send_from_directory(app.static_folder, "robots.txt")

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify({"error": "File is too large (max 5MB)."}), 413

    @app.errorhandler(404)
    def not_found(error):
        from flask import request

        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found"}), 404
        return render_template("index.html", assets=asset_urls(), vite_dev=vite_dev()), 404

    @app.errorhandler(500)
    def server_error(error):
        from flask import request

        db.session.rollback()
        if request.path.startswith("/api/"):
            return jsonify({"error": "Server error"}), 500
        return render_template("index.html", assets=asset_urls(), vite_dev=vite_dev()), 500

    with app.app_context():
        import seed

        db.create_all()
        seed.seed_if_empty()

    return app


# Gunicorn/Flask entry point. Importing bootstrap creates tables and seeds data.
import bootstrap  # noqa: E402

app = bootstrap.upgrade()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
