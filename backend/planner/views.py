from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from planner.services.geocoding import GeocodingService


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
