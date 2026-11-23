from django.conf import settings
from rest_framework import serializers

from apps.common.constants import REGION_VALUES
from apps.common.phone import normalize_tz_phone, whatsapp_link
from apps.dealers.models import Dealer

from .models import Favorite, Inquiry, Status, Vehicle, VehicleImage

NON_MODERATED_WRITE_FIELDS = {"price_tzs"}


def absolute(request, url):
    if not url or request is None:
        return url
    return request.build_absolute_uri(url)


class VehicleImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = VehicleImage
        fields = ["id", "url", "position"]

    def get_url(self, obj):
        return absolute(self.context.get("request"), obj.image.url)


class SellerSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    is_verified = serializers.BooleanField()
    dealer_id = serializers.IntegerField(allow_null=True)
    dealer_name = serializers.CharField(allow_null=True)
    dealer_verified = serializers.BooleanField(allow_null=True)


def seller_summary(vehicle: Vehicle) -> dict:
    seller = vehicle.seller
    dealer = vehicle.dealer
    profile = getattr(seller, "profile", None)
    return {
        "id": seller.id,
        "name": seller.display_name,
        "is_verified": bool(profile and profile.is_verified),
        "dealer_id": dealer.id if dealer else None,
        "dealer_name": dealer.business_name if dealer else None,
        "dealer_verified": dealer.is_verified if dealer else None,
    }


class VehicleCardSerializer(serializers.ModelSerializer):
    """Compact representation used in search results, dashboards and favourites."""

    main_image = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    dealer_name = serializers.SerializerMethodField()
    dealer_verified = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            "id", "title", "make", "model", "year", "price_tzs", "mileage_km", "fuel_type",
            "transmission", "body_type", "condition", "region", "city", "status", "is_featured",
            "views_count", "main_image", "is_favorited", "dealer_name", "dealer_verified",
            "published_at", "expires_at", "created_at",
        ]

    def get_main_image(self, obj):
        image = obj.main_image
        return absolute(self.context.get("request"), image.image.url) if image else None

    def get_is_favorited(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Favorite.objects.filter(user=request.user, vehicle=obj).exists()

    def get_dealer_name(self, obj):
        return obj.dealer.business_name if obj.dealer else None

    def get_dealer_verified(self, obj):
        return obj.dealer.is_verified if obj.dealer else None


class VehicleDetailSerializer(VehicleCardSerializer):
    images = VehicleImageSerializer(many=True, read_only=True)
    description = serializers.CharField(read_only=True)
    color = serializers.CharField(read_only=True)
    engine_cc = serializers.IntegerField(read_only=True)
    contact_phone = serializers.CharField(read_only=True)
    whatsapp_number = serializers.CharField(read_only=True)
    whatsapp_url = serializers.SerializerMethodField()
    seller = serializers.SerializerMethodField()
    dealer = serializers.SerializerMethodField()
    rejection_reason = serializers.CharField(read_only=True)
    suspension_reason = serializers.CharField(read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta(VehicleCardSerializer.Meta):
        fields = VehicleCardSerializer.Meta.fields + [
            "description", "color", "engine_cc", "contact_phone", "whatsapp_number", "whatsapp_url",
            "images", "seller", "dealer", "rejection_reason", "suspension_reason", "is_owner", "updated_at",
            "sold_at",
        ]

    def get_whatsapp_url(self, obj):
        return whatsapp_link(obj.whatsapp_number or obj.contact_phone, f"Hello, I am interested in your {obj.title} on Tanzania Car Marketplace.")

    def get_seller(self, obj):
        return seller_summary(obj)

    def get_dealer(self, obj):
        if not obj.dealer:
            return None
        dealer: Dealer = obj.dealer
        return {
            "id": dealer.id,
            "business_name": dealer.business_name,
            "region": dealer.region,
            "city": dealer.city,
            "phone": dealer.phone,
            "verification_status": dealer.verification_status,
            "is_verified": dealer.is_verified,
        }

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and request.user.id == obj.seller_id)


class VehicleWriteSerializer(serializers.ModelSerializer):
    contact_phone = serializers.CharField(max_length=20)
    whatsapp_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    region = serializers.ChoiceField(choices=REGION_VALUES)
    images = serializers.ListField(
        child=serializers.ImageField(), write_only=True, required=False, allow_empty=True
    )

    class Meta:
        model = Vehicle
        fields = [
            "id", "title", "make", "model", "year", "price_tzs", "mileage_km", "fuel_type", "transmission",
            "engine_cc", "body_type", "condition", "color", "region", "city", "description",
            "contact_phone", "whatsapp_number", "images",
        ]
        read_only_fields = ["id"]

    def validate_contact_phone(self, value):
        return normalize_tz_phone(value)

    def validate_whatsapp_number(self, value):
        return normalize_tz_phone(value) if value else ""

    def validate_year(self, value):
        from datetime import date

        if not 1950 <= value <= date.today().year + 1:
            raise serializers.ValidationError(f"Year must be between 1950 and {date.today().year + 1}.")
        return value

    def validate_price_tzs(self, value):
        if value < 100_000:
            raise serializers.ValidationError("Price must be at least TZS 100,000.")
        if value > 10_000_000_000:
            raise serializers.ValidationError("Price is unrealistically high. Please check it.")
        return value

    def validate_engine_cc(self, value):
        if value is not None and not 50 <= value <= 12000:
            raise serializers.ValidationError("Engine capacity must be between 50 and 12000 cc.")
        return value

    def validate_images(self, files):
        limit = settings.MAX_IMAGES_PER_LISTING
        existing = self.instance.images.count() if self.instance else 0
        if existing + len(files) > limit:
            raise serializers.ValidationError(f"A listing can have at most {limit} photos.")
        return files


class InquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inquiry
        fields = ["id", "name", "phone", "email", "message", "is_read", "created_at", "vehicle"]
        read_only_fields = ["id", "is_read", "created_at", "vehicle"]

    def validate_phone(self, value):
        return normalize_tz_phone(value) if value else ""

    def validate(self, attrs):
        if not attrs.get("phone") and not attrs.get("email"):
            raise serializers.ValidationError("Give a phone number or email so the seller can reply.")
        return attrs


class FavoriteSerializer(serializers.ModelSerializer):
    vehicle = VehicleCardSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ["id", "vehicle", "created_at"]

