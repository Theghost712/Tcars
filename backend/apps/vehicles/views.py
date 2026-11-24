from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, F, Max, Min, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.generics import get_object_or_404

from apps.common.permissions import IsSellerOrDealer
from apps.common.uploads import process_image_upload
from apps.moderation.models import Report

from . import services
from .filters import apply_filters
from .models import BodyType, Favorite, Inquiry, Status, Vehicle, VehicleImage
from .serializers import (
    FavoriteSerializer,
    InquirySerializer,
    VehicleCardSerializer,
    VehicleDetailSerializer,
    VehicleWriteSerializer,
)
from apps.notifications.services import notify

SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


def public_queryset():
    now = timezone.now()
    return Vehicle.objects.filter(status=Status.APPROVED).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))


class VehicleListCreateView(generics.ListCreateAPIView):
    """Search public listings (GET) or publish a new one (POST, seller/dealer accounts only)."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsSellerOrDealer()]
        return [AllowAny()]

    def get_serializer_class(self):
        return VehicleWriteSerializer if self.request.method == "POST" else VehicleCardSerializer

    def get_queryset(self):
        params = self.request.query_params
        user = self.request.user
        if params.get("mine") and user.is_authenticated:
            queryset = Vehicle.objects.filter(seller=user).exclude(status=Status.SUSPENDED).select_related("dealer")
            if status_filter := params.get("status"):
                queryset = queryset.filter(status=status_filter)
            return queryset.order_by("-created_at")
        queryset = public_queryset().select_related("dealer", "seller__profile")
        return apply_filters(queryset, params)

    def create(self, request, *args, **kwargs):
        serializer = VehicleWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        images = serializer.validated_data.pop("images", [])
        dealer = getattr(request.user, "dealer", None) if request.user.role == "dealer" else None
        with transaction.atomic():
            vehicle = serializer.save(seller=request.user, dealer=dealer, status=Status.PENDING)
            self._store_images(vehicle, images)
        return Response(
            VehicleDetailSerializer(vehicle, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _store_images(vehicle, files):
        start = vehicle.images.count()
        for offset, uploaded in enumerate(files):
            content = process_image_upload(uploaded)
            VehicleImage.objects.create(vehicle=vehicle, image=content, position=start + offset)


class VehicleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VehicleDetailSerializer

    def get_permissions(self):
        return [AllowAny()] if self.request.method in SAFE_METHODS else [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if self.request.method in SAFE_METHODS:
            visible = public_queryset()
            if user.is_authenticated:
                visible = Vehicle.objects.filter(Q(pk__in=visible.values("pk")) | Q(seller=user))
            return visible.select_related("dealer", "seller__profile")
        return Vehicle.objects.filter(seller=user).select_related("dealer")

    def retrieve(self, request, *args, **kwargs):
        vehicle = self.get_object()
        if vehicle.is_public and not (request.user.is_authenticated and request.user.id == vehicle.seller_id):
            Vehicle.objects.filter(pk=vehicle.pk).update(views_count=F("views_count") + 1)
            vehicle.refresh_from_db(fields=["views_count"])
        return Response(VehicleDetailSerializer(vehicle, context={"request": request}).data)

    def update(self, request, *args, **kwargs):
        vehicle = self.get_object()
        if vehicle.status == Status.SUSPENDED:
            raise PermissionDenied("This listing is suspended and cannot be edited.")
        partial = kwargs.pop("partial", False)
        serializer = VehicleWriteSerializer(vehicle, data=request.data, partial=partial, context={"request": request})
        serializer.is_valid(raise_exception=True)
        images = serializer.validated_data.pop("images", [])
        changed = [field for field in serializer.validated_data if getattr(vehicle, field, None) != serializer.validated_data[field]]
        with transaction.atomic():
            vehicle = serializer.save()
            if services.needs_review_after_edit(vehicle, changed):
                vehicle.status = Status.PENDING
                vehicle.rejection_reason = ""
                vehicle.save(update_fields=["status", "rejection_reason", "updated_at"])
            VehicleListCreateView._store_images(vehicle, images)
        return Response(VehicleDetailSerializer(vehicle, context={"request": request}).data)

    def perform_destroy(self, instance):
        if instance.status == Status.SOLD:
            raise ValidationError("Sold listings are kept for your records and cannot be deleted.")
        instance.delete()


class VehicleImagesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        vehicle = get_object_or_404(Vehicle, pk=pk, seller=request.user)
        if vehicle.status == Status.SUSPENDED:
            raise PermissionDenied("This listing is suspended and cannot be edited.")
        files = request.FILES.getlist("images") or request.FILES.getlist("image")
        if not files:
            raise ValidationError({"images": "Attach at least one photo."})
        if vehicle.images.count() + len(files) > settings.MAX_IMAGES_PER_LISTING:
            raise ValidationError({"images": f"A listing can have at most {settings.MAX_IMAGES_PER_LISTING} photos."})
        VehicleListCreateView._store_images(vehicle, files)
        return Response(VehicleDetailSerializer(vehicle, context={"request": request}).data, status=status.HTTP_201_CREATED)


class VehicleImageDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, image_id):
        vehicle = get_object_or_404(Vehicle, pk=pk, seller=request.user)
        image = get_object_or_404(VehicleImage, pk=image_id, vehicle=vehicle)
        image.image.delete(save=False)
        image.delete()
        return Response(VehicleDetailSerializer(vehicle, context={"request": request}).data)


class VehicleActionView(APIView):
    """Seller actions on their own listing: mark as sold or renew."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk, action_name):
        vehicle = get_object_or_404(Vehicle, pk=pk, seller=request.user)
        if action_name == "mark-sold":
            services.mark_sold(vehicle)
        elif action_name == "renew":
            services.renew(vehicle)
        else:
            return Response({"detail": "Unknown action."}, status=status.HTTP_404_NOT_FOUND)
        vehicle.refresh_from_db()
        return Response(VehicleDetailSerializer(vehicle, context={"request": request}).data)


class VehicleReportView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "report"

    def post(self, request, pk):
        vehicle = get_object_or_404(public_queryset(), pk=pk)
        if vehicle.seller_id == request.user.id:
            raise ValidationError("You cannot report your own listing.")
        reason = request.data.get("reason", "")
        if reason not in Report.Reason.values:
            raise ValidationError({"reason": "Choose a valid reason."})
        try:
            with transaction.atomic():
                Report.objects.create(
                    vehicle=vehicle, reporter=request.user, reason=reason,
                    details=str(request.data.get("details", ""))[:1000],
                )
        except IntegrityError:
            raise ValidationError("You have already reported this listing.")
        return Response({"detail": "Thank you. Our team will review this listing."}, status=status.HTTP_201_CREATED)


class VehicleInquiryView(generics.CreateAPIView):
    serializer_class = InquirySerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "inquiry"

    def create(self, request, *args, **kwargs):
        vehicle = get_object_or_404(public_queryset(), pk=kwargs["pk"])
        if request.user.is_authenticated and request.user.id == vehicle.seller_id:
            raise ValidationError("You cannot send an inquiry about your own listing.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        buyer = request.user if request.user.is_authenticated else None
        inquiry = serializer.save(vehicle=vehicle, buyer=buyer)
        notify(vehicle.seller, "New buyer inquiry",
               f"{inquiry.name} asked about “{vehicle.title}”.", link="/dashboard", kind="inquiry", email=True)
        return Response(InquirySerializer(inquiry).data, status=status.HTTP_201_CREATED)


class RelatedVehiclesView(generics.ListAPIView):
    serializer_class = VehicleCardSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        vehicle = public_queryset().filter(pk=self.kwargs["pk"]).first()
        if vehicle is None:
            # Owners may view their own pending listings; those simply have no recommendations.
            return Vehicle.objects.none()
        return (
            public_queryset()
            .exclude(pk=vehicle.pk)
            .filter(Q(make=vehicle.make) | Q(body_type=vehicle.body_type) | Q(region=vehicle.region))
            .select_related("dealer")
            .order_by("-is_featured", "-published_at")[:4]
        )


class HomeFeedView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        live = public_queryset().select_related("dealer")
        featured = live.filter(is_featured=True)[:8]
        recent = live[:8]
        ctx = {"request": request}
        regions = (
            live.values("region").annotate(count=Count("id")).order_by("-count", "region")[:12]
        )
        from apps.dealers.models import Dealer, VerificationStatus

        return Response({
            "stats": {
                "live_listings": live.count(),
                "verified_dealers": Dealer.objects.filter(verification_status=VerificationStatus.VERIFIED).count(),
                "regions": live.values("region").distinct().count(),
            },
            "featured": VehicleCardSerializer(featured, many=True, context=ctx).data,
            "recent": VehicleCardSerializer(recent, many=True, context=ctx).data,
            "regions": list(regions),
            "body_types": [
                {"value": value, "label": label, "count": live.filter(body_type=value).count()}
                for value, label in BodyType.choices
            ],
        })


class FacetsView(APIView):
    """Counts used by the search sidebar."""

    permission_classes = [AllowAny]

    def get(self, request):
        live = public_queryset()
        makes = live.values("make").annotate(count=Count("id")).order_by("-count", "make")[:20]
        regions = live.values("region").annotate(count=Count("id")).order_by("region")
        bounds = live.aggregate(min_price=Min("price_tzs"), max_price=Max("price_tzs"),
                                min_year=Min("year"), max_year=Max("year"))
        return Response({"makes": list(makes), "regions": list(regions), "bounds": bounds})


class FavoriteListView(generics.ListCreateAPIView):
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # Sold, expired or suspended vehicles drop out of the saved list.
        live_ids = public_queryset().values("pk")
        return (
            Favorite.objects.filter(user=self.request.user, vehicle_id__in=live_ids)
            .select_related("vehicle__dealer")
        )

    def create(self, request, *args, **kwargs):
        vehicle_id = request.data.get("vehicle_id")
        vehicle = get_object_or_404(public_queryset(), pk=vehicle_id)
        favorite, created = Favorite.objects.get_or_create(user=request.user, vehicle=vehicle)
        data = FavoriteSerializer(favorite, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class FavoriteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, vehicle_id):
        Favorite.objects.filter(user=request.user, vehicle_id=vehicle_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReceivedInquiriesView(generics.ListAPIView):
    serializer_class = InquirySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Inquiry.objects.filter(vehicle__seller=self.request.user).select_related("vehicle")


class SentInquiriesView(generics.ListAPIView):
    serializer_class = InquirySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Inquiry.objects.filter(buyer=self.request.user).select_related("vehicle")


class InquiryReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        inquiry = get_object_or_404(Inquiry, pk=pk, vehicle__seller=request.user)
        inquiry.is_read = True
        inquiry.save(update_fields=["is_read"])
        return Response(InquirySerializer(inquiry).data)


class DashboardView(APIView):
    """Overview for seller and dealer accounts."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        vehicles = Vehicle.objects.filter(seller=user)
        counts = {choice: vehicles.filter(status=choice).count() for choice, _ in Status.choices}
        views = sum(vehicles.values_list("views_count", flat=True))
        inquiries = Inquiry.objects.filter(vehicle__seller=user)
        dealer = getattr(user, "dealer", None)
        dealer_payload = None
        if dealer:
            dealer_payload = {
                "id": dealer.id,
                "business_name": dealer.business_name,
                "verification_status": dealer.verification_status,
                "is_verified": dealer.is_verified,
                "active_listings": counts.get(Status.APPROVED, 0),
            }
        return Response({
            "role": user.role,
            "counts": {
                "total": vehicles.count(),
                "pending": counts[Status.PENDING],
                "approved": counts[Status.APPROVED],
                "rejected": counts[Status.REJECTED],
                "sold": counts[Status.SOLD],
                "expired": counts[Status.EXPIRED],
                "suspended": counts[Status.SUSPENDED],
            },
            "views": views,
            "inquiries": {
                "total": inquiries.count(),
                "unread": inquiries.filter(is_read=False).count(),
            },
            "favorites_saved": Favorite.objects.filter(user=user).count(),
            "dealer": dealer_payload,
            "recent_listings": VehicleCardSerializer(
                vehicles.exclude(status=Status.SUSPENDED).order_by("-created_at")[:6],
                many=True, context={"request": request},
            ).data,
            "recent_inquiries": InquirySerializer(inquiries.select_related("vehicle")[:5], many=True).data,
        })
