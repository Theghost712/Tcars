from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.common.testing import make_user
from apps.dealers.models import Dealer, Verification, VerificationStatus
from apps.vehicles import services
from apps.vehicles.models import Vehicle
from apps.common.testing import listing_payload


class AdminApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.admin = make_user("admin@example.com", Role.ADMIN)
        self.seller = make_user("seller@example.com", Role.SELLER)
        self.dealer_user = make_user("dealer@example.com", Role.DEALER)

    def test_stats_for_admin(self):
        self.api.force_authenticate(self.admin)
        body = self.api.get("/api/admin/stats/").json()
        self.assertEqual(body["users"]["by_role"]["seller"], 1)
        self.assertIn("pending", body["listings"])

    def test_pending_queue(self):
        vehicle = Vehicle.objects.create(
            seller=self.seller, title="Queued", make="Toyota", model="Vitz", year=2012, price_tzs=12_000_000,
            fuel_type="petrol", transmission="manual", body_type="hatchback", region="Dar es Salaam",
            description="x", contact_phone="+255712345678",
        )
        self.api.force_authenticate(self.admin)
        body = self.api.get("/api/admin/vehicles/").json()
        self.assertEqual([item["id"] for item in body["results"]], [vehicle.pk])

    def test_verification_approval_marks_dealer_and_profile(self):
        dealer = Dealer.objects.create(owner=self.dealer_user, business_name="Motors", phone="+255712000222", region="Arusha")
        verification = Verification.objects.create(user=self.dealer_user, dealer=dealer, kind="dealer", reference_number="TIN-1")
        self.api.force_authenticate(self.admin)
        response = self.api.post(f"/api/admin/verifications/{verification.pk}/decide/", {"decision": "approve"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        dealer.refresh_from_db()
        self.dealer_user.profile.refresh_from_db()
        self.assertEqual(dealer.verification_status, VerificationStatus.VERIFIED)
        self.assertTrue(self.dealer_user.profile.is_verified)

    def test_verification_rejection_requires_note(self):
        verification = Verification.objects.create(user=self.seller, kind="seller", reference_number="NIDA-1")
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.post(f"/api/admin/verifications/{verification.pk}/decide/", {"decision": "reject"}, format="json").status_code, 400)
        ok = self.api.post(f"/api/admin/verifications/{verification.pk}/decide/", {"decision": "reject", "note": "Number unreadable"}, format="json")
        self.assertEqual(ok.status_code, 200)

    def test_suspend_user_and_block_self_suspension(self):
        self.api.force_authenticate(self.admin)
        response = self.api.patch(f"/api/admin/users/{self.seller.pk}/", {"is_active": False, "suspension_reason": "Spam"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.seller.refresh_from_db()
        self.assertFalse(self.seller.is_active)
        self.assertEqual(self.seller.suspension_reason, "Spam")
        own = self.api.patch(f"/api/admin/users/{self.admin.pk}/", {"is_active": False}, format="json")
        self.assertEqual(own.status_code, 400)

    def test_user_search_and_log(self):
        self.api.force_authenticate(self.admin)
        found = self.api.get("/api/admin/users/", {"q": "seller@"}).json()
        self.assertEqual(found["count"], 1)
        self.assertEqual(self.api.get("/api/admin/log/").status_code, 200)

    def test_pending_verification_queue_for_non_admin_forbidden(self):
        self.api.force_authenticate(self.seller)
        self.assertEqual(self.api.get("/api/admin/verifications/").status_code, 403)
