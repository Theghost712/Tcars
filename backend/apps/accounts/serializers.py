from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.common.constants import REGION_VALUES
from apps.common.phone import normalize_tz_phone

from .models import Role, User

PUBLIC_ROLES = [Role.BUYER, Role.SELLER, Role.DEALER]


class UserSerializer(serializers.ModelSerializer):
    region = serializers.CharField(source="profile.region", required=False, allow_blank=True, max_length=40)
    city = serializers.CharField(source="profile.city", required=False, allow_blank=True, max_length=80)
    is_verified = serializers.BooleanField(source="profile.is_verified", read_only=True)
    has_dealer_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "phone", "role", "region", "city",
            "is_verified", "has_dealer_profile", "date_joined",
        ]
        read_only_fields = ["id", "email", "date_joined"]

    def get_has_dealer_profile(self, obj) -> bool:
        return hasattr(obj, "dealer")

    def validate_phone(self, value):
        return normalize_tz_phone(value)

    def validate_role(self, value):
        if value not in PUBLIC_ROLES:
            raise serializers.ValidationError("Choose buyer, seller or dealer.")
        return value

    def validate(self, attrs):
        profile = attrs.pop("profile", {})
        region = profile.get("region")
        if region and region not in REGION_VALUES:
            raise serializers.ValidationError({"region": "Choose a region from the list."})
        if profile:
            attrs["_profile"] = profile
        return attrs

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("_profile", {})
        instance = super().update(instance, validated_data)
        if profile_data:
            profile = instance.profile
            for field, value in profile_data.items():
                setattr(profile, field, value)
            profile.save()
        return instance


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=PUBLIC_ROLES, default=Role.BUYER)
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_phone(self, value):
        return normalize_tz_phone(value)

    def validate(self, attrs):
        candidate = User(email=attrs.get("email", ""), full_name=attrs.get("full_name", ""))
        try:
            password_validation.validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login with email and password; the response also carries the user."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your current password is incorrect.")
        return value

    def validate(self, attrs):
        try:
            password_validation.validate_password(attrs["new_password"], user=self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": exc.messages})
        return attrs
