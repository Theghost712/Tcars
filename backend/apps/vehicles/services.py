"""Listing lifecycle rules: moderation, sales, renewals and expiry.

Every change that an administrator makes is written to the moderation log,
and sellers are notified of decisions about their listings.
"""

from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.moderation.models import ListingModeration
from apps.notifications.services import notify

from .models import Status, Vehicle

# Changes to these fields send an approved, rejected or expired listing back to review.
MODERATED_FIELDS = {
    "title", "make", "model", "year", "mileage_km", "fuel_type", "transmission", "engine_cc",
    "body_type", "condition", "color", "region", "city", "description", "contact_phone",
    "whatsapp_number",
}
REVIEW_STATUSES = {Status.APPROVED, Status.REJECTED, Status.EXPIRED}


def log_action(vehicle, moderator, action, reason=""):
    ListingModeration.objects.create(vehicle=vehicle, moderator=moderator, action=action, reason=reason)


def needs_review_after_edit(vehicle, changed_fields) -> bool:
    return bool(MODERATED_FIELDS & set(changed_fields)) and vehicle.status in REVIEW_STATUSES


@transaction.atomic
def approve(vehicle: Vehicle, moderator):
    if vehicle.status != Status.PENDING:
        raise ValidationError("Only listings waiting for approval can be approved.")
    vehicle.publish()
    log_action(vehicle, moderator, ListingModeration.Action.APPROVED)
    notify(vehicle.seller, "Your listing is live", f"“{vehicle.title}” has been approved and is now visible to buyers.",
           link=f"/vehicles/{vehicle.pk}", kind="listing", email=True)


@transaction.atomic
def reject(vehicle: Vehicle, moderator, reason: str):
    if vehicle.status != Status.PENDING:
        raise ValidationError("Only listings waiting for approval can be rejected.")
    vehicle.status = Status.REJECTED
    vehicle.rejection_reason = reason
    vehicle.save(update_fields=["status", "rejection_reason", "updated_at"])
    log_action(vehicle, moderator, ListingModeration.Action.REJECTED, reason)
    notify(vehicle.seller, "Your listing needs changes",
           f"“{vehicle.title}” was not approved: {reason}. Edit it and it will be reviewed again.",
           link=f"/vehicles/{vehicle.pk}/edit", kind="listing", email=True)


@transaction.atomic
def suspend(vehicle: Vehicle, moderator, reason: str):
    if vehicle.status in (Status.SOLD, Status.SUSPENDED):
        raise ValidationError("This listing cannot be suspended in its current state.")
    vehicle.status = Status.SUSPENDED
    vehicle.suspension_reason = reason
    vehicle.save(update_fields=["status", "suspension_reason", "updated_at"])
    log_action(vehicle, moderator, ListingModeration.Action.SUSPENDED, reason)
    notify(vehicle.seller, "A listing was suspended", f"“{vehicle.title}” has been suspended: {reason}.",
           link="/dashboard", kind="listing", email=True)


@transaction.atomic
def restore(vehicle: Vehicle, moderator):
    if vehicle.status != Status.SUSPENDED:
        raise ValidationError("Only suspended listings can be restored.")
    if vehicle.published_at:
        vehicle.publish()
        new_status = Status.APPROVED
    else:
        vehicle.status = Status.PENDING
        vehicle.suspension_reason = ""
        vehicle.save(update_fields=["status", "suspension_reason", "updated_at"])
        new_status = Status.PENDING
    log_action(vehicle, moderator, ListingModeration.Action.RESTORED)
    notify(vehicle.seller, "A listing was restored", f"“{vehicle.title}” is active again ({new_status}).",
           link=f"/vehicles/{vehicle.pk}", kind="listing")


@transaction.atomic
def mark_sold(vehicle: Vehicle):
    if vehicle.status == Status.SOLD:
        raise ValidationError("This vehicle is already marked as sold.")
    if vehicle.status == Status.SUSPENDED:
        raise ValidationError("Suspended listings cannot be changed.")
    vehicle.status = Status.SOLD
    vehicle.sold_at = timezone.now()
    vehicle.save(update_fields=["status", "sold_at", "updated_at"])


@transaction.atomic
def renew(vehicle: Vehicle, moderator=None):
    """Expired listings return to the review queue; approved ones get a fresh period."""
    if vehicle.status not in (Status.EXPIRED, Status.APPROVED):
        raise ValidationError("Only live or expired listings can be renewed.")
    if vehicle.status == Status.EXPIRED:
        vehicle.status = Status.PENDING
        vehicle.save(update_fields=["status", "updated_at"])
    else:
        vehicle.expires_at = timezone.now() + timedelta(days=settings.LISTING_DURATION_DAYS)
        vehicle.save(update_fields=["expires_at", "updated_at"])


def expire_stale_listings(now=None) -> int:
    now = now or timezone.now()
    stale = Vehicle.objects.filter(status=Status.APPROVED, expires_at__lte=now)
    count = 0
    for vehicle in stale:
        vehicle.status = Status.EXPIRED
        vehicle.save(update_fields=["status", "updated_at"])
        notify(vehicle.seller, "Your listing has expired",
               f"“{vehicle.title}” has reached the end of its listing period. Renew it from your dashboard.",
               link="/dashboard", kind="listing", email=True)
        count += 1
    return count
