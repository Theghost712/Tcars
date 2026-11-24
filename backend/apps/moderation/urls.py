from django.urls import path

from . import views

urlpatterns = [
    path("stats/", views.AdminStatsView.as_view(), name="admin-stats"),
    path("vehicles/", views.AdminVehicleListView.as_view(), name="admin-vehicles"),
    path("vehicles/<int:pk>/<str:action_name>/", views.AdminVehicleActionView.as_view(), name="admin-vehicle-action"),
    path("reports/", views.AdminReportListView.as_view(), name="admin-reports"),
    path("reports/<int:pk>/resolve/", views.AdminReportResolveView.as_view(), name="admin-report-resolve"),
    path("verifications/", views.AdminVerificationListView.as_view(), name="admin-verifications"),
    path("verifications/<int:pk>/decide/", views.AdminVerificationDecideView.as_view(), name="admin-verification-decide"),
    path("users/", views.AdminUserListView.as_view(), name="admin-users"),
    path("users/<int:pk>/", views.AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("log/", views.ModerationLogView.as_view(), name="admin-log"),
]
