"""Secure vehicle photo handling.

Each upload is checked for size, verified as a real image with Pillow,
limited in pixel count, re-encoded as JPEG (which strips metadata and any
embedded payloads) and resized to a sensible maximum.
"""

from io import BytesIO
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 40_000_000
MAX_DIMENSION = 1600


def process_image_upload(uploaded) -> ContentFile:
    if uploaded.size > settings.MAX_IMAGE_UPLOAD_BYTES:
        raise ValidationError(
            f"Each photo must be {settings.MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)} MB or smaller."
        )

    uploaded.seek(0)
    try:
        with Image.open(uploaded) as probe:
            probe.verify()
    except Exception as exc:  # noqa: BLE001 - any parse failure means "not an image"
        raise ValidationError("One of the files is not a valid image.") from exc

    uploaded.seek(0)
    try:
        with Image.open(uploaded) as img:
            if img.format not in ALLOWED_FORMATS:
                raise ValidationError("Photos must be JPEG, PNG or WebP.")
            if img.width * img.height > MAX_PIXELS:
                raise ValidationError("That image is too large in pixel dimensions.")
            img = ImageOps.exif_transpose(img)
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            if img.mode != "RGB":
                background = Image.new("RGB", img.size, (255, 255, 255))
                alpha = img.convert("RGBA").split()[-1]
                background.paste(img.convert("RGBA"), mask=alpha)
                img = background
            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=85, optimize=True)
    except ValidationError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ValidationError("One of the files could not be processed as an image.") from exc

    return ContentFile(buffer.getvalue(), name=f"{uuid4().hex}.jpg")
