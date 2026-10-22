"""Serializers for request validation and API responses.

Matching Section 5 contract in PROJECT_SPEC.md.
"""

from datetime import UTC, datetime, timedelta

from rest_framework import serializers

# ---------------------------------------------------------------------------
# Request Serializers
# ---------------------------------------------------------------------------

class LocationCoordinateSerializer(serializers.Serializer):
    """Origin or destination geographic location."""

    label = serializers.CharField(max_length=255, required=True)
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0, required=True)
    lon = serializers.FloatField(min_value=-180.0, max_value=180.0, required=True)


class PlanTripRequestSerializer(serializers.Serializer):
    """Request payload for POST /api/plan/ endpoint."""

    origin = LocationCoordinateSerializer(required=True)
    destination = LocationCoordinateSerializer(required=True)
    departure_time = serializers.DateTimeField(required=True)
    load_weight_lb = serializers.IntegerField(min_value=1, max_value=120000, required=True)
    sampling_interval_miles = serializers.ChoiceField(
        choices=[10, 25, 50],
        default=25,
        required=False,
    )

    def validate_departure_time(self, value: datetime) -> datetime:
        """Validate departure is within [now - 1h, now + 7 days]."""
        now_utc = datetime.now(UTC)
        val_utc = value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)

        min_allowed = now_utc - timedelta(hours=1, minutes=5)  # 5 min buffer for clock skew
        max_allowed = now_utc + timedelta(days=7, hours=1)

        if val_utc < min_allowed:
            raise serializers.ValidationError(
                "Departure time cannot be in the past (must be within [now - 1h, now + 7 days])."
            )
        if val_utc > max_allowed:
            raise serializers.ValidationError(
                "Departure time cannot exceed forecast horizon (must be within [now - 1h, now + 7 days])."
            )

        return val_utc

    def validate(self, attrs):
        """Cross-field validation for trip origin and destination."""
        origin = attrs.get("origin")
        destination = attrs.get("destination")
        if origin and destination:
            if (
                round(origin["lat"], 4) == round(destination["lat"], 4)
                and round(origin["lon"], 4) == round(destination["lon"], 4)
            ):
                raise serializers.ValidationError(
                    {"destination": ["Destination cannot be identical to origin."]}
                )
        return attrs


# ---------------------------------------------------------------------------
# Response Serializers (Documenting & Validating Section 5 Contract)
# ---------------------------------------------------------------------------

class HealthCheckResponseSerializer(serializers.Serializer):
    """Serializer documenting health check response structure."""

    status = serializers.CharField()


class GeocodeItemSerializer(serializers.Serializer):
    """Individual geocode result item."""

    label = serializers.CharField()
    lat = serializers.FloatField()
    lon = serializers.FloatField()


class GeocodeResponseSerializer(serializers.Serializer):
    """Response serializer for /api/geocode/ endpoint."""

    results = serializers.ListField(child=GeocodeItemSerializer())


class PlanMetaSerializer(serializers.Serializer):
    """Metadata block in trip planning response."""

    generated_at = serializers.CharField()
    departure_time = serializers.CharField()
    load_weight_lb = serializers.IntegerField()
    sampling_interval_miles = serializers.IntegerField()
    weather_source = serializers.CharField()
    warnings = serializers.ListField(child=serializers.CharField(), default=[])


class CheckpointSerializer(serializers.Serializer):
    """Checkpoint detail along a route corridor."""

    index = serializers.IntegerField()
    mile = serializers.FloatField()
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    eta = serializers.CharField()
    risk = serializers.IntegerField(min_value=1, max_value=5)
    risk_label = serializers.CharField()
    wind_mph = serializers.FloatField()
    rain_in_hr = serializers.FloatField()
    snow_in_hr = serializers.FloatField()
    drivers = serializers.ListField(child=serializers.CharField())
    load_rule_applied = serializers.BooleanField()
    segment_miles = serializers.FloatField()


class RouteSummarySerializer(serializers.Serializer):
    """Aggregated route weather risk summary metrics."""

    no_travel_miles = serializers.FloatField()
    severe_miles = serializers.FloatField()
    high_miles = serializers.FloatField()
    moderate_miles = serializers.FloatField()
    low_miles = serializers.FloatField()
    avg_risk = serializers.FloatField()
    max_risk = serializers.IntegerField(min_value=1, max_value=5)
    max_risk_label = serializers.CharField()


class RouteGeometrySerializer(serializers.Serializer):
    """GeoJSON LineString geometry."""

    type = serializers.CharField(default="LineString")
    coordinates = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField())
    )


class RouteOptionSerializer(serializers.Serializer):
    """Candidate route evaluated for safety and duration."""

    id = serializers.CharField()
    label = serializers.CharField()
    rank = serializers.IntegerField()
    is_recommended = serializers.BooleanField()
    distance_miles = serializers.FloatField()
    duration_minutes = serializers.FloatField()
    arrival_time = serializers.CharField()
    geometry = RouteGeometrySerializer()
    summary = RouteSummarySerializer()
    recommendation_reason = serializers.CharField()
    checkpoints = serializers.ListField(child=CheckpointSerializer())


class HeatmapPointSerializer(serializers.Serializer):
    """Heatmap geographic point with 49-hour risk series."""

    lat = serializers.FloatField()
    lon = serializers.FloatField()
    route_ids = serializers.ListField(child=serializers.CharField())
    risk = serializers.ListField(child=serializers.IntegerField(min_value=1, max_value=5))


class HeatmapSeriesSerializer(serializers.Serializer):
    """0-48h forecast heatmap series matrix."""

    hours = serializers.ListField(child=serializers.IntegerField())
    points = serializers.ListField(child=HeatmapPointSerializer())


class PlanTripResponseSerializer(serializers.Serializer):
    """Top-level response payload for POST /api/plan/ endpoint."""

    meta = PlanMetaSerializer()
    recommended_route_id = serializers.CharField(allow_null=True)
    routes = serializers.ListField(child=RouteOptionSerializer())
    heatmap = HeatmapSeriesSerializer()
