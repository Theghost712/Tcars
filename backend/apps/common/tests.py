from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient


class HealthCheckTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_health_reports_ok_with_database(self):
        response = self.api.get(reverse("health"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "database": "ok"})

    def test_health_is_public_without_token(self):
        response = self.api.get("/api/health/")
        self.assertNotIn(response.status_code, (401, 403))
