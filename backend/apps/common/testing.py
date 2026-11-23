"""Helpers shared by the test suites."""

from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.accounts.models import Role, User

PASSWORD = "StrongPass123!"


def make_user(email, role=Role.BUYER, **extra):
    return User.objects.create_user(email=email, password=PASSWORD, full_name=email.split("@")[0].title(),
                                    role=role, **extra)


def image_file(name="car.jpg", fmt="JPEG", size=(1200, 900), color=(180, 40, 40)):
    buffer = BytesIO()
    Image.new("RGB", size, color).save(buffer, format=fmt)
    content_type = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}[fmt]
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


def listing_payload(**overrides):
    payload = {
        "title": "Toyota Land Cruiser Prado",
        "make": "Toyota",
        "model": "Land Cruiser Prado",
        "year": 2016,
        "price_tzs": 85_000_000,
        "mileage_km": 98000,
        "fuel_type": "diesel",
        "transmission": "automatic",
        "engine_cc": 2982,
        "body_type": "suv",
        "condition": "used",
        "color": "White",
        "region": "Dar es Salaam",
        "city": "Masaki",
        "description": "Clean interior, full service history, one owner.",
        "contact_phone": "0712345678",
        "whatsapp_number": "0712345678",
    }
    payload.update(overrides)
    return payload
