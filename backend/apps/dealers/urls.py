from django.urls import path

from . import views

urlpatterns = [
    path("dealer/profile/", views.MyDealerProfileView.as_view(), name="dealer-profile"),
    path("dealer/profile/create/", views.DealerCreateView.as_view(), name="dealer-create"),
    path("dealers/<int:pk>/", views.DealerDetailView.as_view(), name="dealer-detail"),
    path("verifications/", views.MyVerificationsView.as_view(), name="verifications"),
]
