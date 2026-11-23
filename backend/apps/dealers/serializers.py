from rest_framework import serializers

from apps.common.phone import normalize_tz_phone

from .models import Dealer, Verification


class DealerSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(read_only=True)
    active_listings = serializers.SerializerMethodField()

    class Meta:
        model = Dealer
        fields = [
            "id", "owner_id", "business_name", "description", "phone", "whatsapp_number", "email",
            "region", "city", "address", "verification_status", "verified_at", "active_listings",
            "created_at",
        ]
        read_only_fields = ["id", "verification_status", "verified_at", "created_at"]

    def get_active_listings(self, obj) -> int:
        return obj.vehicles.filter(status="approved").count()

    def validate_phone(self, value):
        return normalize_tz_phone(value)

    def validate_whatsapp_number(self, value):
        return normalize_tz_phone(value)


class VerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Verification
        fields = ["id", "kind", "reference_number", "details", "status", "admin_note", "created_at", "reviewed_at"]
        read_only_fields = ["id", "status", "admin_note", "created_at", "reviewed_at"]

    def validate_kind(self, value):
        user = self.context["request"].user
        if value == Verification.Kind.DEALER and user.role != "dealer":
            raise serializers.ValidationError("Only dealer accounts can request dealership verification.")
        return value
