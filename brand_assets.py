"""Render the ZimOsaka AutoSpares logo as standalone SVG files.

The mark is a stylised engine turbine inside a rounded shield, with a spark
accent that reads as "Japanese precision, sourced for Zimbabwe".
"""
import os

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "brand")
os.makedirs(BASE, exist_ok=True)

FONTS = "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"


def mark(size=64, bg="#15243d", fg="#ffffff", accent="#d4af57", ring="#d4af57"):
    """Square app icon: shield + turbine + spark."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}" role="img" aria-label="ZimOsaka AutoSpares">
  <defs>
    <linearGradient id="shield" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c3150"/>
      <stop offset="1" stop-color="{bg}"/>
    </linearGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{ring}"/>
      <stop offset="1" stop-color="#8b6814"/>
    </linearGradient>
  </defs>
  <path d="M32 3 8 11v21c0 14 10 24 24 29 14-5 24-15 24-29V11L32 3Z" fill="url(#shield)"/>
  <circle cx="32" cy="32" r="15" fill="none" stroke="{fg}" stroke-opacity=".22" stroke-width="2"/>
  <g fill="url(#blade)">
    <path d="M32 32c0-7 3-11 8-13 3 7 1 12-4 15l-4-2Z"/>
    <path d="M32 32c6 3 8 8 7 13-8 0-12-4-11-10l4-3Z"/>
    <path d="M32 32c-3 6-8 8-13 7 0-8 4-12 10-11l3 4Z"/>
  </g>
  <circle cx="32" cy="32" r="4.2" fill="{fg}"/>
  <path d="M44 9l-3 8 8-3-5 5 8 3-9 1" fill="none" stroke="{accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""


def wordmark(width=460):
    """Horizontal lockup built on the ZO monogram."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 84" width="{width}" height="84" role="img" aria-label="ZimOsaka AutoSpares">
  <g transform="translate(4 14)">
    <rect width="56" height="56" rx="15" fill="#15243d"/>
    <path d="M15 17h17l-13 17h15" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="38.5" cy="36.5" r="7.6" fill="none" stroke="#8b6814" stroke-width="3.2"/>
    <path d="M33 9l2.2 4.4 4.4-2.2-2.2 4.4 4.4 2.2" fill="none" stroke="#d4af57" stroke-width="2.4" stroke-linecap="round"/>
  </g>
  <text x="76" y="41" font-family="{FONTS}" font-size="29" font-weight="800" letter-spacing="-0.8" fill="#15243d">Zim<tspan fill="#8b6814">Osaka</tspan></text>
  <text x="76" y="64" font-family="{FONTS}" font-size="12" font-weight="700" letter-spacing="3.2" fill="#8b6814">AUTOSPARES</text>
  <text x="330" y="64" font-family="{FONTS}" font-size="11.5" font-weight="500" letter-spacing=".4" fill="#65748a">Dubai ? Zimbabwe</text>
</svg>
"""


def monogram(size=56):
    """ZO monogram ? the primary brand mark."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="{size}" height="{size}" role="img" aria-label="ZimOsaka AutoSpares">
  <rect width="56" height="56" rx="15" fill="#15243d"/>
  <path d="M15 17h17l-13 17h15" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="38.5" cy="36.5" r="7.6" fill="none" stroke="#8b6814" stroke-width="3.2"/>
  <path d="M33 9l2.2 4.4 4.4-2.2-2.2 4.4 4.4 2.2" fill="none" stroke="#d4af57" stroke-width="2.4" stroke-linecap="round"/>
</svg>
"""


if __name__ == "__main__":
    files = {
        "logo.svg": wordmark(),
        "mark.svg": monogram(),
        "monogram.svg": monogram(),
        "favicon.svg": monogram(size=32),
    }
    for name, svg in files.items():
        with open(os.path.join(BASE, name), "w", encoding="utf-8") as fh:
            fh.write(svg)
        print("wrote", os.path.join(BASE, name))
