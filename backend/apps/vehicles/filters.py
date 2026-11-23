"""Query-string search and filtering for vehicle listings."""

from django.core.exceptions import ValidationError
from django.db.models import Q

from .models import BodyType, Condition, FuelType, Transmission

SORT_OPTIONS = {
    "newest": ("-published_at", "-created_at"),
    "price_asc": ("price_tzs", "-published_at"),
    "price_desc": ("-price_tzs", "-published_at"),
    "year_desc": ("-year", "-published_at"),
    "mileage_asc": ("mileage_km", "-published_at"),
}

CHOICE_FILTERS = {
    "fuel_type": FuelType,
    "transmission": Transmission,
    "body_type": BodyType,
    "condition": Condition,
}


def _int(params, name):
    raw = params.get(name)
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except ValueError:
        raise ValidationError({name: f"{name} must be a whole number."})


def apply_filters(queryset, params):
    text = (params.get("q") or "").strip()
    if text:
        queryset = queryset.filter(
            Q(title__icontains=text)
            | Q(make__icontains=text)
            | Q(model__icontains=text)
            | Q(description__icontains=text)
            | Q(city__icontains=text)
            | Q(region__icontains=text)
        )

    if make := (params.get("make") or "").strip():
        queryset = queryset.filter(make__iexact=make)
    if model := (params.get("model") or "").strip():
        queryset = queryset.filter(model__icontains=model)
    if region := (params.get("region") or "").strip():
        queryset = queryset.filter(region__iexact=region)
    if city := (params.get("city") or "").strip():
        queryset = queryset.filter(city__icontains=city)

    for name, lookup in (
        ("price_min", "price_tzs__gte"),
        ("price_max", "price_tzs__lte"),
        ("year_min", "year__gte"),
        ("year_max", "year__lte"),
        ("mileage_max", "mileage_km__lte"),
        ("dealer", "dealer_id"),
    ):
        value = _int(params, name)
        if value is not None:
            queryset = queryset.filter(**{lookup: value})

    for name, choices in CHOICE_FILTERS.items():
        value = (params.get(name) or "").strip()
        if value:
            if value not in choices.values:
                raise ValidationError({name: f"Unknown {name.replace('_', ' ')} '{value}'."})
            queryset = queryset.filter(**{name: value})

    sort = params.get("sort") or "newest"
    if sort not in SORT_OPTIONS:
        raise ValidationError({"sort": "Choose one of: " + ", ".join(SORT_OPTIONS) + "."})
    return queryset.order_by(*SORT_OPTIONS[sort])
