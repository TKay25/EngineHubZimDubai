"""Landed-cost calculation for engines shipped from Dubai to Zimbabwe.

All figures are USD. Rates and default charges come from the company settings
row in the database so operations can tune them without a redeploy.
"""
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def _money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def _rate(value, default):
    if value is None or value == "":
        return Decimal(str(default))
    try:
        rate = Decimal(str(value))
    except Exception:
        return Decimal(str(default))
    if rate < 0:
        return Decimal(str(default))
    if rate > 1:
        rate = rate / 100
    return rate


def freight_default(goods_total, settings=None):
    """Indicative sea-freight + handling for a complete engine, Dubai -> Harare."""
    goods = Decimal(str(goods_total))
    minimum = Decimal(str(settings.default_freight_min if settings else 600))
    pct = Decimal(str(settings.default_freight_pct if settings else 0.12))
    return _money(max(minimum, goods * pct))


def landed_cost_estimate(
    goods_total,
    freight=None,
    insurance=None,
    clearing=None,
    inland=None,
    duty_rate=None,
    vat_rate=None,
    surtax_rate=None,
    settings=None,
):
    if settings is None:
        from config import get_settings

        settings = get_settings()

    goods = Decimal(str(goods_total))
    freight_dec = (
        _money(freight) if freight not in (None, "", 0) else freight_default(goods, settings)
    )
    insurance_dec = (
        _money(insurance)
        if insurance not in (None, "", 0)
        else _money(goods * Decimal(str(settings.insurance_pct)))
    )
    clearing_dec = (
        _money(clearing) if clearing not in (None, "") else _money(settings.default_clearing)
    )
    inland_dec = _money(inland) if inland not in (None, "") else _money(settings.default_inland)

    duty_r = _rate(duty_rate, settings.duty_rate)
    vat_r = _rate(vat_rate, settings.vat_rate)
    surtax_r = _rate(surtax_rate, settings.surtax_rate)

    cif = goods + freight_dec + insurance_dec
    duty = cif * duty_r
    vat = (cif + duty) * vat_r
    surtax = (cif + duty) * surtax_r
    total = cif + duty + vat + surtax + clearing_dec + inland_dec

    return {
        "goods_total": float(_money(goods)),
        "freight": float(_money(freight_dec)),
        "insurance": float(_money(insurance_dec)),
        "cif": float(_money(cif)),
        "duty_rate": float(duty_r),
        "duty": float(_money(duty)),
        "vat_rate": float(vat_r),
        "vat": float(_money(vat)),
        "surtax_rate": float(surtax_r),
        "surtax": float(_money(surtax)),
        "clearing": float(_money(clearing_dec)),
        "inland": float(_money(inland_dec)),
        "total": float(_money(total)),
    }
