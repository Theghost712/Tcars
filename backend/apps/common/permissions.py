from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


def is_platform_admin(user) -> bool:
    return bool(user and user.is_authenticated and (user.is_superuser or user.role == Role.ADMIN))


class IsPlatformAdmin(BasePermission):
    message = "Administrator access is required."

    def has_permission(self, request, view):
        return is_platform_admin(request.user)


class IsSellerOrDealer(BasePermission):
    message = "Only seller and dealer accounts can publish vehicles."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in (Role.SELLER, Role.DEALER))
