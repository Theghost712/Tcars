from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.constants import REGIONS


class VerificationStatus(models.TextChoices):
    UNVERIFIED = "unverified", "Not verified"
    PENDING = "pending", "Verification pending"
    VERIFIED = "verified", "Verified"
    REJECTED = "rejected", "Verification rejected"


class Dealer(models.Model):
    """Dealership profile owned by a dealer account."""

    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dealer")
    business_name = models.CharField(max_length=150)
    description = models.TextField(blank=True, max_length=2000)
    phone = models.CharField(max_length=20)
    whatsapp_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    region = models.CharField(max_length=40, choices=REGIONS)
    city = models.CharField(max_length=80, blank=True)
    address = models.CharField(max_length=255, blank=True)
    verification_status = models.CharField(
        max_length=12, choices=VerificationStatus.choices, default=VerificationStatus.UNVERIFIED
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["business_name"]

    def __str__(self):
        return self.business_name

    @property
    def is_verified(self) -> bool:
        return self.verification_status == VerificationStatus.VERIFIED


class Verification(models.Model):
    """A request from a seller or dealer to be verified by an administrator."""

    class Kind(models.TextChoices):
        SELLER = "seller", "Individual seller"
        DEALER = "dealer", "Dealership"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="verifications")
    dealer = models.ForeignKey(
        "dealers.Dealer", on_delete=models.CASCADE, related_name="verifications", null=True, blank=True
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    reference_number = models.CharField(
        max_length=60, help_text="National ID, TIN or business licence number supplied by the applicant."
    )
    details = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    admin_note = models.CharField(max_length=500, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(status="pending"),
                name="one_pending_verification_per_user",
            )
        ]

    def __str__(self):
        return f"{self.get_kind_display()} verification for {self.user}"
