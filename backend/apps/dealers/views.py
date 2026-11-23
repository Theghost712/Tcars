from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role

from .models import Dealer, Verification, VerificationStatus
from .serializers import DealerSerializer, VerificationSerializer


class MyDealerProfileView(generics.RetrieveUpdateAPIView):
    """The signed-in dealer's own dealership profile. Created with POST on the collection below."""

    serializer_class = DealerSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        try:
            return self.request.user.dealer
        except Dealer.DoesNotExist:
            from rest_framework.exceptions import NotFound

            raise NotFound("You have not created a dealership profile yet.")


class DealerCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != Role.DEALER:
            raise PermissionDenied("Switch your account to the dealer role first.")
        if hasattr(request.user, "dealer"):
            raise ValidationError("You already have a dealership profile.")
        serializer = DealerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                dealer = serializer.save(owner=request.user)
        except IntegrityError:
            raise ValidationError("You already have a dealership profile.")
        return Response(DealerSerializer(dealer).data, status=status.HTTP_201_CREATED)


class DealerDetailView(generics.RetrieveAPIView):
    serializer_class = DealerSerializer
    permission_classes = [AllowAny]
    queryset = Dealer.objects.all()


class MyVerificationsView(generics.ListCreateAPIView):
    serializer_class = VerificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Verification.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in (Role.SELLER, Role.DEALER):
            raise PermissionDenied("Only seller and dealer accounts can request verification.")
        if self.get_queryset().filter(status=Verification.Status.PENDING).exists():
            raise ValidationError("You already have a verification request waiting for review.")
        dealer = None
        if serializer.validated_data["kind"] == Verification.Kind.DEALER:
            dealer = getattr(user, "dealer", None)
            if dealer is None:
                raise ValidationError("Create your dealership profile before requesting dealer verification.")
            dealer.verification_status = VerificationStatus.PENDING
            dealer.save(update_fields=["verification_status"])
        serializer.save(user=user, dealer=dealer)
