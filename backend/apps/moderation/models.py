from django.conf import settings
from django.db import models
from django.utils import timezone


class Report(models.Model):
    class Reason(models.TextChoices):
        MISLEADING = "misleading", "Misleading information"
        WRONG_PRICE = "wrong_price", "Wrong price"
        FAKE_PHOTOS = "fake_photos", "Photos are not of this vehicle"
        SOLD = "sold", "Already sold"
        SCAM = "scam", "Suspected scam"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"
        DISMISSED = "dismissed", "Dismissed"

    vehicle = models.ForeignKey("vehicles.Vehicle", on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reports_made")
    reason = models.CharField(max_length=20, choices=Reason.choices)
    details = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    resolution_note = models.CharField(max_length=500, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["vehicle", "reporter"], name="unique_report_per_user")]

    def __str__(self):
        return f"Report on vehicle {self.vehicle_id}: {self.get_reason_display()}"


class ListingModeration(models.Model):
    """Audit trail of every moderation decision."""

    class Action(models.TextChoices):
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        SUSPENDED = "suspended", "Suspended"
        RESTORED = "restored", "Restored"
        FEATURED = "featured", "Featured"
        UNFEATURED = "unfeatured", "Removed from featured"
        REPORT_ACTION = "report_action", "Action taken on report"

    vehicle = models.ForeignKey("vehicles.Vehicle", on_delete=models.CASCADE, related_name="moderation_log")
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="moderation_actions"
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_action_display()} vehicle {self.vehicle_id}"
