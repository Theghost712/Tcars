from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.common.phone import normalize_tz_phone, whatsapp_link
from django.core.exceptions import ValidationError


class HealthCheckTests(TestCase):
    def test_health_reports_ok_with_database(self):
        response = APIClient().get(reverse("health"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "database": "ok"})

    def test_health_is_public(self):
        self.assertEqual(APIClient().get("/api/health/").status_code, 200)


class PhoneTests(TestCase):
    def test_normalises_common_formats(self):
        self.assertEqual(normalize_tz_phone("0712 345 678"), "+255712345678")
        self.assertEqual(normalize_tz_phone("+255 754-000-111"), "+255754000111")
        self.assertEqual(normalize_tz_phone("255687654321"), "+255687654321")
        self.assertEqual(normalize_tz_phone(""), "")

    def test_rejects_invalid_numbers(self):
        with self.assertRaises(ValidationError):
            normalize_tz_phone("12345")

    def test_whatsapp_link(self):
        self.assertEqual(whatsapp_link("+255712345678"), "https://wa.me/255712345678")
        self.assertEqual(whatsapp_link(""), "")
