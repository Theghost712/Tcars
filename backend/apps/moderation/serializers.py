from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import Role
from apps.vehicles.models import Vehicle

from .models import ListingModeration, Report

User = get_user_model()


class ReportSerializer(serializers.ModelSerializer):
    vehicle = serializers.SerializerMethodField()
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)
    reporter_email = serializers.EmailField(source="reporter.email", read_only=True)

    class Meta:
        model = Report
        fields = [
            "id", "reason", "reason_label", "details", "status", "resolution_note",
            "created_at", "resolved_at", "vehicle", "reporter_email",
        ]

    def get_vehicle(self, obj):
        vehicle: Vehicle = obj.vehicle
        return {"id": vehicle.id, "title": vehicle.title, "status": vehicle.status, "price_tzs": vehicle.price_tzs}


class LogSerializer(serializers.ModelSerializer):
    moderator = serializers.SerializerMethodField()
    vehicle_title = serializers.CharField(source="vehicle.title", read_only=True)

    class Meta:
        model = ListingModeration
        fields = ["id", "vehicle", "vehicle_title", "action", "reason", "moderator", "created_at"]

    def get_moderator(self, obj):
        return obj.moderator.email if obj.moderator else None


class AdminUserSerializer(serializers.ModelSerializer):
    listings = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "phone", "role", "is_active", "suspension_reason",
            "date_joined", "last_login", "listings",
        ]
        read_only_fields = ["id", "email", "full_name", "phone", "date_joined", "last_login"]

    def get_listings(self, obj) -> int:
        return obj.vehicles.count()

    def validate_role(self, value):
        if value not in Role.values:
            raise serializers.ValidationError("Unknown role.")
        return value
