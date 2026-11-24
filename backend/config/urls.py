from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.common.urls")),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.dealers.urls")),
    path("api/", include("apps.vehicles.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/admin/", include("apps.moderation.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
