from django.contrib import admin
from django.utils import timezone

from apps.moderation.models import ListingModeration

from . import services
from .models import Favorite, Inquiry, Status, Vehicle, VehicleImage


class VehicleImageInline(admin.TabularInline):
    model = VehicleImage
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["title", "make", "year", "price_tzs", "region", "status", "is_featured", "seller", "created_at"]
    list_filter = ["status", "is_featured", "region", "body_type", "fuel_type", "transmission"]
    search_fields = ["title", "make", "model", "seller__email", "contact_phone"]
    readonly_fields = ["views_count", "created_at", "updated_at", "published_at", "expires_at", "sold_at"]
    inlines = [VehicleImageInline]
    actions = ["approve_selected", "reject_selected_pending", "suspend_selected", "feature_selected", "unfeature_selected"]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("seller", "dealer")

    @admin.action(description="Approve selected pending listings")
    def approve_selected(self, request, queryset):
        approved = 0
        for vehicle in queryset.filter(status=Status.PENDING):
            services.approve(vehicle, request.user)
            approved += 1
        self.message_user(request, f"Approved {approved} listing(s).")

    @admin.action(description="Reject selected pending listings (reason: see moderation log)")
    def reject_selected_pending(self, request, queryset):
        rejected = 0
        for vehicle in queryset.filter(status=Status.PENDING):
            services.reject(vehicle, request.user, "Does not meet listing guidelines.")
            rejected += 1
        self.message_user(request, f"Rejected {rejected} listing(s).")

    @admin.action(description="Suspend selected listings")
    def suspend_selected(self, request, queryset):
        for vehicle in queryset.exclude(status__in=[Status.SOLD, Status.SUSPENDED]):
            services.suspend(vehicle, request.user, "Suspended by an administrator.")

    @admin.action(description="Feature selected listings on the homepage")
    def feature_selected(self, request, queryset):
        queryset.update(is_featured=True)

    @admin.action(description="Remove featured status")
    def unfeature_selected(self, request, queryset):
        queryset.update(is_featured=False)


@admin.register(Inquiry)
class InquiryAdmin(admin.ModelAdmin):
    list_display = ["name", "vehicle", "phone", "email", "is_read", "created_at"]
    list_filter = ["is_read"]
    search_fields = ["name", "phone", "email", "vehicle__title"]


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ["user", "vehicle", "created_at"]
    search_fields = ["user__email", "vehicle__title"]
