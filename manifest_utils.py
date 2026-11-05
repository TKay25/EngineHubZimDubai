"""Resolve built Vite asset filenames from the Vite manifest."""
import json
import os

from config import BASE_DIR

MANIFEST_PATH = os.path.join(BASE_DIR, "static", "assets", ".vite", "manifest.json")
FALLBACK = None


def _manifest():
    if not os.path.exists(MANIFEST_PATH):
        return {}
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def asset_urls(entry="src/main.jsx"):
    """Filenames relative to Flask's static folder, for url_for('static', ...)."""
    manifest = _manifest()
    chunk = manifest.get(entry)
    if not chunk or not chunk.get("file"):
        return FALLBACK
    js = "assets/" + chunk["file"]
    static_dir = os.path.join(BASE_DIR, "static")
    if not os.path.isfile(os.path.join(static_dir, js)):
        return FALLBACK
    css = next(("assets/" + f for f in chunk.get("css", [])), None)
    if css and not os.path.isfile(os.path.join(static_dir, css)):
        return FALLBACK
    return {"js": js, "css": css}


def vite_dev():
    return os.getenv("VITE_DEV", "0") == "1"
