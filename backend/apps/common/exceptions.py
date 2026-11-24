from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Convert Django validation errors raised from model/service code into 400 responses."""
    if isinstance(exc, DjangoValidationError):
        exc = DRFValidationError(detail=exc.messages)
    return drf_exception_handler(exc, context)
