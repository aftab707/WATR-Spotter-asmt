from django.urls import path

from planner.views import geocode_view, health_check

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("geocode/", geocode_view, name="geocode"),
]
