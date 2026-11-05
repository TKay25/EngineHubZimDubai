"""Resolve built Vite asset filenames from the Vite manifest."""
import json
import os

from config import BASE_DIR

MANIFEST_PATH = os.path.join(BASE_DIR, "static", "assets", ".vite", "manifest.json")
FALLBACK = {
    "js": "assets/app.js",
    "css": "assets/app.css",
}


def _manifest():
    if not os.path.exists(MANIFEST_PATH):
        return {}
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def asset_urls(entry="src/main.jsx"):
    """Filenames relative to Flask's static folder, for url_for('static', ...)."""
    manifest = _manifest()
    chunk = manifest.get(entry)
    if not chunk:
        return FALLBACK
    js = "assets/" + chunk["file"]
    css = next(("assets/" + f for f in chunk.get("css", [])), FALLBACK["css"])
    return {"js": js, "css": css}


def vite_dev():
    return os.getenv("VITE_DEV", "0") == "1"
