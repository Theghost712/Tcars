from django.contrib import admin
from django.utils import timezone

from .models import Dealer, Verification, VerificationStatus


@admin.register(Dealer)
class DealerAdmin(admin.ModelAdmin):
    list_display = ["business_name", "owner", "region", "verification_status", "created_at"]
    list_filter = ["verification_status", "region"]
    search_fields = ["business_name", "owner__email", "phone"]
    actions = ["mark_verified", "mark_unverified"]

    @admin.action(description="Mark selected dealers as verified")
    def mark_verified(self, request, queryset):
        for dealer in queryset:
            dealer.verification_status = VerificationStatus.VERIFIED
            dealer.verified_at = timezone.now()
            dealer.save(update_fields=["verification_status", "verified_at"])

    @admin.action(description="Remove verification from selected dealers")
    def mark_unverified(self, request, queryset):
        queryset.update(verification_status=VerificationStatus.UNVERIFIED, verified_at=None)


@admin.register(Verification)
class VerificationAdmin(admin.ModelAdmin):
    list_display = ["user", "kind", "reference_number", "status", "created_at", "reviewed_by"]
    list_filter = ["status", "kind"]
    search_fields = ["user__email", "reference_number"]
    readonly_fields = ["user", "dealer", "kind", "reference_number", "details", "created_at"]
