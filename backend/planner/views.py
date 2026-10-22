"""Views for the planner application.

Exposes:
- GET /api/health/ (keep-alive and uptime ping)
- GET /api/geocode/?q=... (geocoding search)
- POST /api/plan/ (end-to-end weather-aware trip planning)
"""

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from planner.serializers import PlanTripRequestSerializer
from planner.services.geocoding import GeocodingService
from planner.services.orchestrator import plan_trip
from planner.services.weather import UpstreamError

logger = logging.getLogger(__name__)


class PlanTripThrottle(AnonRateThrottle):
    """Rate throttle for the trip planning endpoint (30 requests/min per IP)."""

    scope = "plan"
    rate = "30/min"

    def get_rate(self):
        if getattr(settings, "TESTING", False):
            return None
        rates = getattr(settings, "REST_FRAMEWORK", {}).get("DEFAULT_THROTTLE_RATES", {})
        return rates.get(self.scope, self.rate)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint.

    Returns:
        200 OK with {"status": "ok"}.
        Does not perform external I/O or database calls. Used for keep-alive and uptime pings.
    """
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def geocode_view(request):
    """Geocode search endpoint.

    Query parameters:
        q: Place name or address string to search (e.g. 'chicago').

    Returns:
        200 OK with {"results": [{"label": "...", "lat": 41.88, "lon": -87.63}]}.
        Max 6 results, cached.
    """
    query = request.query_params.get("q", "").strip()
    if not query or len(query) < 2:
        return Response({"results": []}, status=status.HTTP_200_OK)

    geocoder = GeocodingService()
    results = geocoder.search(query, limit=6)
    return Response(
        {"results": [r.to_dict() for r in results]},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PlanTripThrottle])
def plan_trip_view(request):
    """Trip planning endpoint.

    Accepts:
        PlanTripRequest payload (origin, destination, departure_time, load_weight_lb, sampling_interval_miles).

    Returns:
        200 OK with PlanTripResponse JSON adhering to Section 5 contract.
        422 Unprocessable Entity with {"error": "validation", "fields": {...}} on invalid input.
        502 Bad Gateway with {"error": "upstream", "message": "..."} on provider failures.
        504 Gateway Timeout with {"error": "timeout", "message": "..."} on request timeouts.
    """
    serializer = PlanTripRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {
                "error": "validation",
                "fields": serializer.errors,
            },
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    try:
        result = plan_trip(serializer.validated_data)
        return Response(result, status=status.HTTP_200_OK)
    except UpstreamError as exc:
        logger.warning("Upstream failure during trip planning: %s", exc)
        return Response(
            {
                "error": "upstream",
                "message": exc.message,
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except TimeoutError as exc:
        logger.warning("Trip planning timed out: %s", exc)
        return Response(
            {
                "error": "timeout",
                "message": "Trip planning request timed out, please try again",
            },
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
    except Exception as exc:
        logger.exception("Unexpected error during trip planning: %s", exc)
        return Response(
            {
                "error": "upstream",
                "message": "Weather or routing service unavailable, try again",
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
