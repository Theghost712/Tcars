from django.core import mail
from django.core.cache import cache
from django.contrib.auth.tokens import default_token_generator
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from .models import Role, User


class AccountTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def make_user(self, email="buyer@example.com", role=Role.BUYER, password="StrongPass123!", **extra):
        return User.objects.create_user(email=email, password=password, full_name="Test User", role=role, **extra)

    def login(self, email="buyer@example.com", password="StrongPass123!"):
        response = self.api.post("/api/auth/login/", {"email": email, "password": password}, format="json")
        return response


class RegistrationTests(AccountTestCase):
    def test_register_creates_user_with_profile(self):
        response = self.api.post(
            "/api/auth/register/",
            {"email": "New@Example.com", "full_name": "Amina Juma", "phone": "0712345678",
             "role": "seller", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        user = User.objects.get(email="new@example.com")
        self.assertEqual(user.role, Role.SELLER)
        self.assertEqual(user.phone, "+255712345678")
        self.assertTrue(hasattr(user, "profile"))
        self.assertNotIn("password", response.json())

    def test_cannot_register_as_admin(self):
        response = self.api.post(
            "/api/auth/register/",
            {"email": "sneaky@example.com", "full_name": "X", "role": "admin", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.json())

    def test_weak_password_rejected(self):
        response = self.api.post(
            "/api/auth/register/",
            {"email": "weak@example.com", "full_name": "X", "password": "12345678"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.json())

    def test_duplicate_email_rejected(self):
        self.make_user(email="dup@example.com")
        response = self.api.post(
            "/api/auth/register/",
            {"email": "DUP@example.com", "full_name": "X", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class LoginTests(AccountTestCase):
    def test_login_returns_tokens_and_user(self):
        self.make_user()
        response = self.login()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("access", body)
        self.assertIn("refresh", body)
        self.assertEqual(body["user"]["email"], "buyer@example.com")

    def test_wrong_password_rejected(self):
        self.make_user()
        self.assertEqual(self.login(password="wrong-password").status_code, 401)

    def test_suspended_account_cannot_login(self):
        self.make_user(is_active=False)
        self.assertEqual(self.login().status_code, 401)

    def test_login_is_rate_limited(self):
        self.make_user()
        statuses = [self.login(password="bad-password-x").status_code for _ in range(12)]
        self.assertIn(429, statuses)

    def test_logout_blacklists_refresh_token(self):
        self.make_user()
        tokens = self.login().json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        response = self.api.post("/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(response.status_code, 204)
        refresh = self.api.post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(refresh.status_code, 401)


class ProfileTests(AccountTestCase):
    def test_me_requires_authentication(self):
        self.assertEqual(self.api.get("/api/auth/me/").status_code, 401)

    def test_user_can_update_profile_and_switch_to_seller(self):
        user = self.make_user()
        self.api.force_authenticate(user)
        response = self.api.patch(
            "/api/auth/me/",
            {"full_name": "Neema Ali", "phone": "0754000111", "role": "seller", "region": "Arusha", "city": "Arusha City"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        user.refresh_from_db()
        self.assertEqual(user.role, Role.SELLER)
        self.assertEqual(user.profile.region, "Arusha")
        self.assertEqual(user.phone, "+255754000111")

    def test_user_cannot_make_themselves_admin(self):
        user = self.make_user()
        self.api.force_authenticate(user)
        response = self.api.patch("/api/auth/me/", {"role": "admin"}, format="json")
        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertEqual(user.role, Role.BUYER)

    def test_change_password(self):
        user = self.make_user()
        self.api.force_authenticate(user)
        bad = self.api.post("/api/auth/password/change/", {"old_password": "nope", "new_password": "AnotherPass999"}, format="json")
        self.assertEqual(bad.status_code, 400)
        ok = self.api.post("/api/auth/password/change/", {"old_password": "StrongPass123!", "new_password": "AnotherPass999"}, format="json")
        self.assertEqual(ok.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("AnotherPass999"))


class PasswordResetTests(AccountTestCase):
    def test_reset_request_sends_email_for_known_user(self):
        self.make_user()
        response = self.api.post("/api/auth/password-reset/", {"email": "buyer@example.com"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/reset-password?uid=", mail.outbox[0].body)

    def test_reset_request_does_not_reveal_unknown_email(self):
        response = self.api.post("/api/auth/password-reset/", {"email": "ghost@example.com"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_confirm_sets_new_password(self):
        user = self.make_user()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        response = self.api.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "new_password": "BrandNewPass1"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        user.refresh_from_db()
        self.assertTrue(user.check_password("BrandNewPass1"))

    def test_confirm_rejects_bad_token(self):
        user = self.make_user()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        response = self.api.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": "bad-token", "new_password": "BrandNewPass1"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
