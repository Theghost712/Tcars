from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsPlatformAdmin
from apps.dealers.models import Verification, VerificationStatus
from apps.dealers.serializers import VerificationSerializer
from apps.notifications.services import notify
from apps.vehicles import services
from apps.vehicles.models import Inquiry, Status, Vehicle
from apps.vehicles.serializers import VehicleCardSerializer
from apps.accounts.models import Role

from .models import ListingModeration, Report
from .serializers import AdminUserSerializer, LogSerializer, ReportSerializer

User = get_user_model()


def run_service(fn, *args):
    """Turn model-level rule violations into HTTP 400 responses."""
    try:
        return fn(*args)
    except DjangoValidationError as exc:
        raise ValidationError({"detail": exc.messages})


class AdminStatsView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        vehicles = Vehicle.objects.all()
        return Response({
            "users": {
                "total": User.objects.count(),
                "by_role": {role: User.objects.filter(role=role).count() for role in Role.values},
                "suspended": User.objects.filter(is_active=False).count(),
            },
            "listings": {status_value: vehicles.filter(status=status_value).count() for status_value in Status.values},
            "open_reports": Report.objects.filter(status=Report.Status.OPEN).count(),
            "pending_verifications": Verification.objects.filter(status=Verification.Status.PENDING).count(),
            "inquiries_total": Inquiry.objects.count(),
            "inquiries_today": Inquiry.objects.filter(created_at__date=timezone.now().date()).count(),
        })


class AdminVehicleListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = VehicleCardSerializer

    def get_queryset(self):
        status_value = self.request.query_params.get("status", Status.PENDING)
        queryset = Vehicle.objects.select_related("dealer", "seller__profile").order_by("created_at")
        if status_value != "all":
            queryset = queryset.filter(status=status_value)
        return queryset


class AdminVehicleActionView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk, action_name):
        vehicle = get_object_or_404(Vehicle, pk=pk)
        moderator = request.user
        if action_name == "approve":
            run_service(services.approve, vehicle, moderator)
        elif action_name == "reject":
            reason = str(request.data.get("reason", "")).strip()
            if not reason:
                raise ValidationError({"reason": "Give the seller a reason for rejecting this listing."})
            run_service(services.reject, vehicle, moderator, reason)
        elif action_name == "suspend":
            reason = str(request.data.get("reason", "")).strip() or "Suspended after moderation review."
            run_service(services.suspend, vehicle, moderator, reason)
        elif action_name == "restore":
            run_service(services.restore, vehicle, moderator)
        elif action_name == "feature":
            featured = bool(request.data.get("featured", True))
            Vehicle.objects.filter(pk=vehicle.pk).update(is_featured=featured)
            ListingModeration.objects.create(
                vehicle=vehicle, moderator=moderator,
                action=ListingModeration.Action.FEATURED if featured else ListingModeration.Action.UNFEATURED,
            )
        else:
            return Response({"detail": "Unknown action."}, status=status.HTTP_404_NOT_FOUND)
        vehicle.refresh_from_db()
        return Response(VehicleCardSerializer(vehicle, context={"request": request}).data)


class AdminReportListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = ReportSerializer

    def get_queryset(self):
        status_value = self.request.query_params.get("status", Report.Status.OPEN)
        queryset = Report.objects.select_related("vehicle", "reporter")
        return queryset if status_value == "all" else queryset.filter(status=status_value)


class AdminReportResolveView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        report = get_object_or_404(Report, pk=pk, status=Report.Status.OPEN)
        decision = request.data.get("action")
        note = str(request.data.get("note", "")).strip()[:500]
        if decision == "dismiss":
            report.status = Report.Status.DISMISSED
        elif decision == "remove_listing":
            run_service(services.suspend, report.vehicle, request.user, note or "Suspended after a user report.")
            report.status = Report.Status.RESOLVED
            ListingModeration.objects.create(
                vehicle=report.vehicle, moderator=request.user,
                action=ListingModeration.Action.REPORT_ACTION, reason=note,
            )
        else:
            raise ValidationError({"action": "Choose 'dismiss' or 'remove_listing'."})
        report.resolution_note = note
        report.resolved_by = request.user
        report.resolved_at = timezone.now()
        report.save()
        return Response(ReportSerializer(report).data)


class AdminVerificationListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = VerificationSerializer

    def get_queryset(self):
        status_value = self.request.query_params.get("status", Verification.Status.PENDING)
        queryset = Verification.objects.select_related("user", "dealer")
        return queryset if status_value == "all" else queryset.filter(status=status_value)

    def get_serializer(self, *args, **kwargs):
        return super().get_serializer(*args, **kwargs)


class AdminVerificationDecideView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        verification = get_object_or_404(Verification, pk=pk, status=Verification.Status.PENDING)
        decision = request.data.get("decision")
        note = str(request.data.get("note", "")).strip()[:500]
        now = timezone.now()
        profile = verification.user.profile
        dealer = verification.dealer

        if decision == "approve":
            verification.status = Verification.Status.APPROVED
            profile.is_verified = True
            profile.verified_at = now
            profile.save(update_fields=["is_verified", "verified_at"])
            if dealer:
                dealer.verification_status = VerificationStatus.VERIFIED
                dealer.verified_at = now
                dealer.save(update_fields=["verification_status", "verified_at", "updated_at"])
            message = "Your verification has been approved. Your listings now show a verified badge."
        elif decision == "reject":
            if not note:
                raise ValidationError({"note": "Explain what is missing so the applicant can resubmit."})
            verification.status = Verification.Status.REJECTED
            if dealer:
                dealer.verification_status = VerificationStatus.REJECTED
                dealer.save(update_fields=["verification_status", "updated_at"])
            message = f"Your verification was not approved: {note}"
        else:
            raise ValidationError({"decision": "Choose 'approve' or 'reject'."})

        verification.admin_note = note
        verification.reviewed_by = request.user
        verification.reviewed_at = now
        verification.save()
        notify(verification.user, "Verification update", message, link="/dashboard", kind="verification", email=True)
        return Response(VerificationSerializer(verification, context={"request": request}).data)


class AdminUserListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        params = self.request.query_params
        queryset = User.objects.all()
        if query := params.get("q", "").strip():
            queryset = queryset.filter(Q(email__icontains=query) | Q(full_name__icontains=query) | Q(phone__icontains=query))
        if role := params.get("role", "").strip():
            queryset = queryset.filter(role=role)
        return queryset


class AdminUserDetailView(generics.UpdateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminUserSerializer
    queryset = User.objects.all()
    http_method_names = ["patch"]

    def perform_update(self, serializer):
        target = self.get_object()
        if target.pk == self.request.user.pk and serializer.validated_data.get("is_active") is False:
            raise ValidationError({"is_active": "You cannot suspend your own account."})
        if target.is_superuser and serializer.validated_data.get("is_active") is False:
            raise ValidationError({"is_active": "Superuser accounts cannot be suspended here."})
        reason = str(self.request.data.get("suspension_reason", "")).strip()[:255]
        instance = serializer.save()
        if "is_active" in serializer.validated_data:
            instance.suspension_reason = "" if instance.is_active else (reason or "Suspended by an administrator.")
            instance.save(update_fields=["suspension_reason"])


class ModerationLogView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = LogSerializer

    def get_queryset(self):
        return ListingModeration.objects.select_related("vehicle", "moderator")[:200]
