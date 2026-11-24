from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, UserProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = ["email", "full_name", "role", "is_active", "is_staff", "date_joined"]
    list_filter = ["role", "is_active", "is_staff"]
    search_fields = ["email", "full_name", "phone"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("full_name", "phone")}),
        ("Marketplace", {"fields": ("role", "is_active", "suspension_reason")}),
        ("Permissions", {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "full_name", "role", "password1", "password2")}),
    )
    readonly_fields = ["last_login", "date_joined"]
    actions = ["suspend_accounts", "reactivate_accounts"]

    @admin.action(description="Suspend selected accounts")
    def suspend_accounts(self, request, queryset):
        queryset.exclude(is_superuser=True).update(is_active=False)

    @admin.action(description="Reactivate selected accounts")
    def reactivate_accounts(self, request, queryset):
        queryset.update(is_active=True, suspension_reason="")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "region", "city", "is_verified", "verified_at"]
    list_filter = ["is_verified", "region"]
    search_fields = ["user__email", "user__full_name"]
