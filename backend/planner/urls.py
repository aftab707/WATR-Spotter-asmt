from django.urls import path

from planner.views import geocode_view, health_check, plan_trip_view

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("geocode/", geocode_view, name="geocode"),
    path("plan/", plan_trip_view, name="plan_trip"),
]
