from django.contrib import admin

from .models import ListingModeration, Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["vehicle", "reporter", "reason", "status", "created_at", "resolved_by"]
    list_filter = ["status", "reason"]
    search_fields = ["vehicle__title", "reporter__email"]
    readonly_fields = ["vehicle", "reporter", "reason", "details", "created_at"]
    actions = ["dismiss_reports"]

    @admin.action(description="Dismiss selected reports")
    def dismiss_reports(self, request, queryset):
        from django.utils import timezone

        queryset.filter(status=Report.Status.OPEN).update(
            status=Report.Status.DISMISSED, resolved_by=request.user, resolved_at=timezone.now()
        )


@admin.register(ListingModeration)
class ListingModerationAdmin(admin.ModelAdmin):
    list_display = ["vehicle", "action", "moderator", "reason", "created_at"]
    list_filter = ["action"]
    search_fields = ["vehicle__title", "moderator__email"]
    readonly_fields = ["vehicle", "moderator", "action", "reason", "created_at"]
