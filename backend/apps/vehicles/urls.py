from django.urls import path

from . import views

urlpatterns = [
    path("vehicles/", views.VehicleListCreateView.as_view(), name="vehicle-list"),
    path("vehicles/home/", views.HomeFeedView.as_view(), name="vehicle-home"),
    path("vehicles/facets/", views.FacetsView.as_view(), name="vehicle-facets"),
    path("vehicles/<int:pk>/", views.VehicleDetailView.as_view(), name="vehicle-detail"),
    path("vehicles/<int:pk>/images/", views.VehicleImagesView.as_view(), name="vehicle-images"),
    path("vehicles/<int:pk>/images/<int:image_id>/", views.VehicleImageDeleteView.as_view(), name="vehicle-image-delete"),
    path("vehicles/<int:pk>/actions/<str:action_name>/", views.VehicleActionView.as_view(), name="vehicle-action"),
    path("vehicles/<int:pk>/report/", views.VehicleReportView.as_view(), name="vehicle-report"),
    path("vehicles/<int:pk>/inquiries/", views.VehicleInquiryView.as_view(), name="vehicle-inquiry"),
    path("vehicles/<int:pk>/related/", views.RelatedVehiclesView.as_view(), name="vehicle-related"),
    path("favorites/", views.FavoriteListView.as_view(), name="favorites"),
    path("favorites/<int:vehicle_id>/", views.FavoriteDetailView.as_view(), name="favorite-detail"),
    path("inquiries/received/", views.ReceivedInquiriesView.as_view(), name="inquiries-received"),
    path("inquiries/sent/", views.SentInquiriesView.as_view(), name="inquiries-sent"),
    path("inquiries/<int:pk>/read/", views.InquiryReadView.as_view(), name="inquiry-read"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
]
