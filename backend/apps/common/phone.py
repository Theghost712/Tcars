"""Tanzanian phone number normalisation to the international +255 format."""

import re

from django.core.exceptions import ValidationError


def normalize_tz_phone(raw: str) -> str:
    """Accept 07xx, 06xx, 2557xx, +2557xx and return +2557xxxxxxxx.

    Raises ValidationError when the number cannot be recognised.
    """
    if raw is None or raw.strip() == "":
        return ""
    digits = re.sub(r"[\s\-()]", "", raw)
    if digits.startswith("+"):
        digits = digits[1:]
    if digits.startswith("0") and len(digits) == 10:
        digits = "255" + digits[1:]
    if re.fullmatch(r"255[67]\d{8}", digits) is None:
        raise ValidationError("Enter a valid Tanzanian mobile number, e.g. 0712 345 678.")
    return "+" + digits


def whatsapp_link(phone: str, message: str = "") -> str:
    from urllib.parse import quote

    number = re.sub(r"\D", "", phone or "")
    if not number:
        return ""
    url = f"https://wa.me/{number}"
    if message:
        url += f"?text={quote(message)}"
    return url
