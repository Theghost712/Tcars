import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import Notification

logger = logging.getLogger(__name__)


def notify(user, title: str, body: str, link: str = "", kind: str = "general", email: bool = False):
    """Store an in-app notification and optionally email it. Email failures never break the caller."""
    notification = Notification.objects.create(user=user, title=title, body=body, link=link, kind=kind)
    if email and user.email:
        try:
            send_mail(
                subject=f"Tanzania Car Marketplace: {title}",
                message=f"{body}\n\nOpen: {settings.FRONTEND_URL}{link}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Could not send notification email to user %s", user.pk)
    return notification
