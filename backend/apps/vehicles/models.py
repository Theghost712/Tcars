from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.constants import REGIONS


class Status(models.TextChoices):
    PENDING = "pending", "Pending approval"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    SOLD = "sold", "Sold"
    EXPIRED = "expired", "Expired"
    SUSPENDED = "suspended", "Suspended"


class FuelType(models.TextChoices):
    PETROL = "petrol", "Petrol"
    DIESEL = "diesel", "Diesel"
    HYBRID = "hybrid", "Hybrid"
    ELECTRIC = "electric", "Electric"
    OTHER = "other", "Other"


class Transmission(models.TextChoices):
    MANUAL = "manual", "Manual"
    AUTOMATIC = "automatic", "Automatic"
    CVT = "cvt", "CVT"
    OTHER = "other", "Other"


class BodyType(models.TextChoices):
    SEDAN = "sedan", "Sedan"
    SUV = "suv", "SUV"
    HATCHBACK = "hatchback", "Hatchback"
    PICKUP = "pickup", "Pick-up"
    VAN = "van", "Van"
    MINIBUS = "minibus", "Minibus / Hiace"
    COUPE = "coupe", "Coupe"
    WAGON = "wagon", "Station wagon"
    OTHER = "other", "Other"


class Condition(models.TextChoices):
    NEW = "new", "New"
    USED = "used", "Used"
    RECONDITIONED = "reconditioned", "Reconditioned"


class Vehicle(models.Model):
    """A vehicle advertisement."""

    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vehicles")
    dealer = models.ForeignKey(
        "dealers.Dealer", on_delete=models.SET_NULL, null=True, blank=True, related_name="vehicles"
    )
    title = models.CharField(max_length=150)
    make = models.CharField(max_length=80)
    model = models.CharField(max_length=80)
    year = models.PositiveSmallIntegerField()
    price_tzs = models.PositiveBigIntegerField(help_text="Asking price in Tanzanian shillings.")
    mileage_km = models.PositiveIntegerField(default=0)
    fuel_type = models.CharField(max_length=10, choices=FuelType.choices)
    transmission = models.CharField(max_length=10, choices=Transmission.choices)
    engine_cc = models.PositiveIntegerField(null=True, blank=True)
    body_type = models.CharField(max_length=10, choices=BodyType.choices)
    condition = models.CharField(max_length=15, choices=Condition.choices, default=Condition.USED)
    color = models.CharField(max_length=40, blank=True)
    region = models.CharField(max_length=40, choices=REGIONS)
    city = models.CharField(max_length=80, blank=True)
    description = models.TextField(max_length=3000)
    contact_phone = models.CharField(max_length=20)
    whatsapp_number = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.CharField(max_length=500, blank=True)
    suspension_reason = models.CharField(max_length=500, blank=True)
    is_featured = models.BooleanField(default=False)
    views_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    sold_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]
        indexes = [
            models.Index(fields=["status", "-published_at"]),
            models.Index(fields=["make", "model"]),
            models.Index(fields=["region"]),
            models.Index(fields=["price_tzs"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.year})"

    @property
    def is_public(self) -> bool:
        return self.status == Status.APPROVED and (self.expires_at is None or self.expires_at > timezone.now())

    @property
    def main_image(self):
        return self.images.first()

    def publish(self, now=None):
        now = now or timezone.now()
        self.status = Status.APPROVED
        self.published_at = now
        self.expires_at = now + timedelta(days=settings.LISTING_DURATION_DAYS)
        self.rejection_reason = ""
        self.suspension_reason = ""
        self.save(update_fields=["status", "published_at", "expires_at", "rejection_reason", "suspension_reason", "updated_at"])


class VehicleImage(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="vehicles/%Y/%m/")
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"Image {self.pk} of vehicle {self.vehicle_id}"


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "vehicle"], name="unique_favorite")]


class Inquiry(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="inquiries")
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sent_inquiries"
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    message = models.TextField(max_length=1000)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Inquiry from {self.name} about {self.vehicle_id}"
