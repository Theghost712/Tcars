from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role, User

from .models import Dealer, Verification, VerificationStatus


class DealerTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.dealer_user = User.objects.create_user(
            email="dealer@example.com", password="StrongPass123!", full_name="Dealer", role=Role.DEALER
        )
        self.seller = User.objects.create_user(
            email="seller@example.com", password="StrongPass123!", full_name="Seller", role=Role.SELLER
        )
        self.profile_payload = {
            "business_name": "Kariakoo Motors", "phone": "0712345678", "region": "Dar es Salaam",
            "city": "Ilala", "description": "Used cars since 2012",
        }

    def test_dealer_creates_profile(self):
        self.api.force_authenticate(self.dealer_user)
        response = self.api.post("/api/dealer/profile/create/", self.profile_payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Dealer.objects.get().phone, "+255712345678")

    def test_seller_cannot_create_dealer_profile(self):
        self.api.force_authenticate(self.seller)
        response = self.api.post("/api/dealer/profile/create/", self.profile_payload, format="json")
        self.assertEqual(response.status_code, 403)

    def test_duplicate_profile_rejected(self):
        self.api.force_authenticate(self.dealer_user)
        self.api.post("/api/dealer/profile/create/", self.profile_payload, format="json")
        again = self.api.post("/api/dealer/profile/create/", self.profile_payload, format="json")
        self.assertEqual(again.status_code, 400)

    def test_dealer_verification_flow(self):
        self.api.force_authenticate(self.dealer_user)
        self.api.post("/api/dealer/profile/create/", self.profile_payload, format="json")
        response = self.api.post(
            "/api/verifications/",
            {"kind": "dealer", "reference_number": "TIN-123456789", "details": "Business licence attached"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Dealer.objects.get().verification_status, VerificationStatus.PENDING)

        second = self.api.post(
            "/api/verifications/", {"kind": "dealer", "reference_number": "X1"}, format="json"
        )
        self.assertEqual(second.status_code, 400)

    def test_seller_cannot_request_dealer_verification(self):
        self.api.force_authenticate(self.seller)
        response = self.api.post(
            "/api/verifications/", {"kind": "dealer", "reference_number": "X1"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_public_dealer_page_is_readable(self):
        dealer = Dealer.objects.create(
            owner=self.dealer_user, business_name="Kariakoo Motors", phone="+255712345678", region="Dar es Salaam"
        )
        response = APIClient().get(f"/api/dealers/{dealer.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["business_name"], "Kariakoo Motors")
