import shutil
import tempfile
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.common.testing import image_file, listing_payload, make_user
from apps.dealers.models import Dealer
from apps.notifications.models import Notification
from apps.vehicles import services
from apps.vehicles.models import Favorite, Inquiry, Status, Vehicle, VehicleImage
from apps.moderation.models import Report

MEDIA = tempfile.mkdtemp(prefix="tcm-test-media-")


@override_settings(MEDIA_ROOT=MEDIA)
class VehicleTestCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.seller = make_user("seller@example.com", Role.SELLER)
        self.other = make_user("other@example.com", Role.SELLER)
        self.buyer = make_user("buyer@example.com", Role.BUYER)
        self.admin = make_user("admin@example.com", Role.ADMIN)

    def create_listing(self, user=None, **overrides):
        self.api.force_authenticate(user or self.seller)
        response = self.api.post("/api/vehicles/", listing_payload(**overrides), format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return Vehicle.objects.get(pk=response.json()["id"])

    def approved_listing(self, **overrides):
        vehicle = self.create_listing(**overrides)
        services.approve(vehicle, self.admin)
        vehicle.refresh_from_db()
        return vehicle


class CreateListingTests(VehicleTestCase):
    def test_seller_creates_pending_listing_with_photos(self):
        self.api.force_authenticate(self.seller)
        payload = listing_payload()
        payload["images"] = [image_file("a.jpg"), image_file("b.png", fmt="PNG")]
        response = self.api.post("/api/vehicles/", payload, format="multipart")
        self.assertEqual(response.status_code, 201, response.content)
        vehicle = Vehicle.objects.get(pk=response.json()["id"])
        self.assertEqual(vehicle.status, Status.PENDING)
        self.assertEqual(vehicle.images.count(), 2)
        self.assertEqual(vehicle.contact_phone, "+255712345678")

    def test_pending_listing_is_hidden_from_public_search(self):
        vehicle = self.create_listing()
        response = self.api.get("/api/vehicles/")
        self.assertNotIn(vehicle.pk, [item["id"] for item in response.json()["results"]])

    def test_buyer_cannot_publish(self):
        self.api.force_authenticate(self.buyer)
        response = self.api.post("/api/vehicles/", listing_payload(), format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_publish(self):
        response = APIClient().post("/api/vehicles/", listing_payload(), format="json")
        self.assertEqual(response.status_code, 401)

    def test_validation_rules(self):
        self.api.force_authenticate(self.seller)
        bad = self.api.post("/api/vehicles/", listing_payload(year=1800, price_tzs=5, contact_phone="123",
                                                             region="Atlantis"), format="json")
        self.assertEqual(bad.status_code, 400)
        errors = bad.json()
        for field in ("year", "price_tzs", "contact_phone", "region"):
            self.assertIn(field, errors)

    def test_dealer_listing_is_linked_to_dealership(self):
        dealer_user = make_user("dealer@example.com", Role.DEALER)
        dealer = Dealer.objects.create(owner=dealer_user, business_name="Motors", phone="+255712000222", region="Arusha")
        vehicle = self.create_listing(user=dealer_user)
        self.assertEqual(vehicle.dealer, dealer)

    def test_listing_photo_limit(self):
        self.api.force_authenticate(self.seller)
        payload = listing_payload()
        payload["images"] = [image_file(f"{i}.jpg") for i in range(11)]
        response = self.api.post("/api/vehicles/", payload, format="multipart")
        self.assertEqual(response.status_code, 400)


class ImageUploadTests(VehicleTestCase):
    def test_non_image_file_is_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        vehicle = self.create_listing()
        self.api.force_authenticate(self.seller)
        fake = SimpleUploadedFile("evil.jpg", b"<script>alert(1)</script>", content_type="image/jpeg")
        response = self.api.post(f"/api/vehicles/{vehicle.pk}/images/", {"images": fake}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(vehicle.images.count(), 0)

    def test_png_is_reencoded_as_jpeg(self):
        vehicle = self.create_listing()
        self.api.force_authenticate(self.seller)
        response = self.api.post(f"/api/vehicles/{vehicle.pk}/images/", {"images": image_file("p.png", fmt="PNG")},
                                 format="multipart")
        self.assertEqual(response.status_code, 201, response.content)
        stored = VehicleImage.objects.get(vehicle=vehicle)
        self.assertTrue(stored.image.name.endswith(".jpg"))

    def test_oversized_photo_is_rejected(self):
        vehicle = self.create_listing()
        self.api.force_authenticate(self.seller)
        with override_settings(MAX_IMAGE_UPLOAD_BYTES=1000):
            response = self.api.post(f"/api/vehicles/{vehicle.pk}/images/", {"images": image_file()}, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_other_users_cannot_add_photos(self):
        vehicle = self.create_listing()
        self.api.force_authenticate(self.other)
        response = self.api.post(f"/api/vehicles/{vehicle.pk}/images/", {"images": image_file()}, format="multipart")
        self.assertEqual(response.status_code, 404)


class ModerationFlowTests(VehicleTestCase):
    def test_admin_approval_publishes_and_notifies_seller(self):
        vehicle = self.create_listing()
        self.api.force_authenticate(self.admin)
        response = self.api.post(f"/api/admin/vehicles/{vehicle.pk}/approve/")
        self.assertEqual(response.status_code, 200, response.content)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Status.APPROVED)
        self.assertIsNotNone(vehicle.expires_at)
        self.assertTrue(Notification.objects.filter(user=self.seller, title="Your listing is live").exists())
        self.assertEqual(len(mail.outbox), 1)
        public = APIClient().get("/api/vehicles/")
        self.assertIn(vehicle.pk, [item["id"] for item in public.json()["results"]])

    def test_rejection_requires_reason_and_is_logged(self):
        vehicle = self.create_listing()
        self.api.force_authenticate(self.admin)
        missing = self.api.post(f"/api/admin/vehicles/{vehicle.pk}/reject/", {}, format="json")
        self.assertEqual(missing.status_code, 400)
        ok = self.api.post(f"/api/admin/vehicles/{vehicle.pk}/reject/", {"reason": "Photos are blurry"}, format="json")
        self.assertEqual(ok.status_code, 200)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Status.REJECTED)
        self.assertEqual(vehicle.moderation_log.count(), 1)
        self.assertTrue(Notification.objects.filter(user=self.seller, title="Your listing needs changes").exists())

    def test_non_admin_cannot_moderate(self):
        vehicle = self.create_listing()
        self.api.force_authenticate(self.seller)
        self.assertEqual(self.api.post(f"/api/admin/vehicles/{vehicle.pk}/approve/").status_code, 403)
        self.assertEqual(self.api.get("/api/admin/stats/").status_code, 403)

    def test_material_edit_sends_approved_listing_back_to_review(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.seller)
        response = self.api.patch(f"/api/vehicles/{vehicle.pk}/", {"description": "Completely rewritten text here."}, format="json")
        self.assertEqual(response.status_code, 200)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Status.PENDING)

    def test_price_only_edit_keeps_listing_live(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.seller)
        response = self.api.patch(f"/api/vehicles/{vehicle.pk}/", {"price_tzs": 80_000_000}, format="json")
        self.assertEqual(response.status_code, 200)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Status.APPROVED)
        self.assertEqual(vehicle.price_tzs, 80_000_000)

    def test_suspend_blocks_seller_edits_until_restored(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.post(f"/api/admin/vehicles/{vehicle.pk}/suspend/", {"reason": "Fraud check"}, format="json").status_code, 200)
        self.api.force_authenticate(self.seller)
        self.assertEqual(self.api.patch(f"/api/vehicles/{vehicle.pk}/", {"price_tzs": 1_000_000}, format="json").status_code, 403)
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.post(f"/api/admin/vehicles/{vehicle.pk}/restore/").status_code, 200)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Status.APPROVED)

    def test_feature_toggle(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.admin)
        self.api.post(f"/api/admin/vehicles/{vehicle.pk}/feature/", {"featured": True}, format="json")
        vehicle.refresh_from_db()
        self.assertTrue(vehicle.is_featured)

    def test_expiry_command_expires_old_listings_and_renewal_restores(self):
        vehicle = self.approved_listing()
        Vehicle.objects.filter(pk=vehicle.pk).update(expires_at=timezone.now() - timedelta(days=1))
        call_command("expire_listings")
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Status.EXPIRED)
        self.api.force_authenticate(self.seller)
        self.assertEqual(self.api.post(f"/api/vehicles/{vehicle.pk}/actions/renew/").status_code, 200)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Status.PENDING)


class SearchTests(VehicleTestCase):
    def setUp(self):
        super().setUp()
        self.cheap = self.approved_listing(title="Suzuki Alto", make="Suzuki", model="Alto", year=2010,
                                           price_tzs=9_000_000, region="Mwanza", body_type="hatchback")
        self.pricey = self.approved_listing(title="Toyota Prado", make="Toyota", model="Prado", year=2018,
                                            price_tzs=120_000_000, region="Dar es Salaam", body_type="suv")

    def results(self, **params):
        response = APIClient().get("/api/vehicles/", params)
        self.assertEqual(response.status_code, 200, response.content)
        return [item["id"] for item in response.json()["results"]]

    def test_text_and_make_filters(self):
        self.assertEqual(self.results(q="prado"), [self.pricey.pk])
        self.assertEqual(self.results(make="Suzuki"), [self.cheap.pk])

    def test_price_and_year_ranges(self):
        self.assertEqual(self.results(price_max=10_000_000), [self.cheap.pk])
        self.assertEqual(self.results(price_min=100_000_000, year_min=2015), [self.pricey.pk])

    def test_region_and_body_filters(self):
        self.assertEqual(self.results(region="Mwanza"), [self.cheap.pk])
        self.assertEqual(self.results(body_type="suv"), [self.pricey.pk])

    def test_sorting(self):
        self.assertEqual(self.results(sort="price_asc"), [self.cheap.pk, self.pricey.pk])
        self.assertEqual(self.results(sort="price_desc"), [self.pricey.pk, self.cheap.pk])

    def test_invalid_filter_values_return_400(self):
        response = APIClient().get("/api/vehicles/", {"price_min": "lots"})
        self.assertEqual(response.status_code, 400)
        response = APIClient().get("/api/vehicles/", {"fuel_type": "steam"})
        self.assertEqual(response.status_code, 400)
        response = APIClient().get("/api/vehicles/", {"sort": "random"})
        self.assertEqual(response.status_code, 400)

    def test_home_feed_and_facets(self):
        home = APIClient().get("/api/vehicles/home/").json()
        self.assertEqual(len(home["recent"]), 2)
        facets = APIClient().get("/api/vehicles/facets/").json()
        makes = {item["make"] for item in facets["makes"]}
        self.assertEqual(makes, {"Suzuki", "Toyota"})

    def test_related_vehicles_exclude_current(self):
        response = APIClient().get(f"/api/vehicles/{self.pricey.pk}/related/")
        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()]
        self.assertNotIn(self.pricey.pk, ids)


class DetailAndSoldTests(VehicleTestCase):
    def test_detail_counts_views_for_visitors_only(self):
        vehicle = self.approved_listing()
        APIClient().get(f"/api/vehicles/{vehicle.pk}/")
        self.api.force_authenticate(self.seller)
        self.api.get(f"/api/vehicles/{vehicle.pk}/")
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.views_count, 1)

    def test_detail_includes_whatsapp_link_and_owner_flag(self):
        vehicle = self.approved_listing()
        body = APIClient().get(f"/api/vehicles/{vehicle.pk}/").json()
        self.assertEqual(body["whatsapp_url"], "https://wa.me/255712345678?text=Hello%2C%20I%20am%20interested%20in%20your%20Toyota%20Land%20Cruiser%20Prado%20on%20Tanzania%20Car%20Marketplace.")
        self.assertFalse(body["is_owner"])
        self.api.force_authenticate(self.seller)
        self.assertTrue(self.api.get(f"/api/vehicles/{vehicle.pk}/").json()["is_owner"])

    def test_pending_listing_is_404_for_visitors(self):
        vehicle = self.create_listing()
        self.assertEqual(APIClient().get(f"/api/vehicles/{vehicle.pk}/").status_code, 404)

    def test_mark_sold_removes_from_search(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.seller)
        response = self.api.post(f"/api/vehicles/{vehicle.pk}/actions/mark-sold/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], Status.SOLD)
        public_ids = [item["id"] for item in APIClient().get("/api/vehicles/").json()["results"]]
        self.assertNotIn(vehicle.pk, public_ids)

    def test_sold_listing_cannot_be_deleted(self):
        vehicle = self.approved_listing()
        services.mark_sold(vehicle)
        self.api.force_authenticate(self.seller)
        self.assertEqual(self.api.delete(f"/api/vehicles/{vehicle.pk}/").status_code, 400)

    def test_other_seller_cannot_edit(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.other)
        self.assertEqual(self.api.patch(f"/api/vehicles/{vehicle.pk}/", {"price_tzs": 1}, format="json").status_code, 404)


class FavoriteTests(VehicleTestCase):
    def test_favorite_flow(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.buyer)
        self.assertEqual(self.api.post("/api/favorites/", {"vehicle_id": vehicle.pk}, format="json").status_code, 201)
        self.assertEqual(self.api.post("/api/favorites/", {"vehicle_id": vehicle.pk}, format="json").status_code, 200)
        listed = self.api.get("/api/favorites/").json()
        self.assertEqual([item["vehicle"]["id"] for item in listed], [vehicle.pk])
        search = self.api.get("/api/vehicles/").json()["results"]
        self.assertTrue(next(item for item in search if item["id"] == vehicle.pk)["is_favorited"])
        self.assertEqual(self.api.delete(f"/api/favorites/{vehicle.pk}/").status_code, 204)
        self.assertEqual(Favorite.objects.count(), 0)

    def test_sold_vehicles_leave_the_saved_list(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.buyer)
        self.api.post("/api/favorites/", {"vehicle_id": vehicle.pk}, format="json")
        services.mark_sold(vehicle)
        self.assertEqual(self.api.get("/api/favorites/").json(), [])

    def test_cannot_favorite_pending_listing(self):
        vehicle = self.create_listing()
        self.api.force_authenticate(self.buyer)
        self.assertEqual(self.api.post("/api/favorites/", {"vehicle_id": vehicle.pk}, format="json").status_code, 404)


class InquiryTests(VehicleTestCase):
    def test_anonymous_inquiry_notifies_seller(self):
        vehicle = self.approved_listing()
        response = APIClient().post(
            f"/api/vehicles/{vehicle.pk}/inquiries/",
            {"name": "Juma", "phone": "0765000111", "message": "Is the price negotiable?"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Inquiry.objects.get().phone, "+255765000111")
        self.assertTrue(Notification.objects.filter(user=self.seller, kind="inquiry").exists())

    def test_inquiry_needs_contact_details(self):
        vehicle = self.approved_listing()
        response = APIClient().post(f"/api/vehicles/{vehicle.pk}/inquiries/", {"name": "Juma", "message": "Hi"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_seller_cannot_inquire_about_own_listing(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.seller)
        response = self.api.post(f"/api/vehicles/{vehicle.pk}/inquiries/", {"name": "Me", "phone": "0712345678", "message": "x"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_seller_inbox_and_read_receipt(self):
        vehicle = self.approved_listing()
        APIClient().post(f"/api/vehicles/{vehicle.pk}/inquiries/", {"name": "Juma", "email": "j@example.com", "message": "Hi"}, format="json")
        inquiry = Inquiry.objects.get()
        self.api.force_authenticate(self.other)
        self.assertEqual(self.api.get("/api/inquiries/received/").json()["count"], 0)
        self.api.force_authenticate(self.seller)
        self.assertEqual(self.api.get("/api/inquiries/received/").json()["count"], 1)
        self.api.post(f"/api/inquiries/{inquiry.pk}/read/")
        inquiry.refresh_from_db()
        self.assertTrue(inquiry.is_read)

    def test_buyer_sees_sent_inquiries(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.buyer)
        self.api.post(f"/api/vehicles/{vehicle.pk}/inquiries/", {"name": "Buyer", "phone": "0712345678", "message": "Hi"}, format="json")
        self.assertEqual(self.api.get("/api/inquiries/sent/").json()["count"], 1)


class ReportAndDashboardTests(VehicleTestCase):
    def test_report_flow(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.buyer)
        self.assertEqual(self.api.post(f"/api/vehicles/{vehicle.pk}/report/", {"reason": "scam"}, format="json").status_code, 201)
        self.assertEqual(self.api.post(f"/api/vehicles/{vehicle.pk}/report/", {"reason": "scam"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(f"/api/vehicles/{vehicle.pk}/report/", {"reason": "bogus"}, format="json").status_code, 400)

    def test_admin_removes_reported_listing(self):
        vehicle = self.approved_listing()
        report = Report.objects.create(vehicle=vehicle, reporter=self.buyer, reason="scam")
        self.api.force_authenticate(self.admin)
        response = self.api.post(f"/api/admin/reports/{report.pk}/resolve/", {"action": "remove_listing", "note": "Confirmed scam"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Status.SUSPENDED)
        report.refresh_from_db()
        self.assertEqual(report.status, Report.Status.RESOLVED)

    def test_cannot_report_own_listing(self):
        vehicle = self.approved_listing()
        self.api.force_authenticate(self.seller)
        self.assertEqual(self.api.post(f"/api/vehicles/{vehicle.pk}/report/", {"reason": "other"}, format="json").status_code, 400)

    def test_dashboard_counts(self):
        self.approved_listing()
        self.create_listing()
        self.api.force_authenticate(self.seller)
        body = self.api.get("/api/dashboard/").json()
        self.assertEqual(body["counts"]["total"], 2)
        self.assertEqual(body["counts"]["approved"], 1)
        self.assertEqual(body["counts"]["pending"], 1)
        self.assertEqual(body["role"], "seller")

    def test_my_listings_filter(self):
        self.approved_listing()
        self.create_listing(user=self.other)
        self.api.force_authenticate(self.seller)
        mine = self.api.get("/api/vehicles/", {"mine": 1}).json()
        self.assertEqual(mine["count"], 1)
