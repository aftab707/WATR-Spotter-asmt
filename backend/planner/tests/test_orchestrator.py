"""Contract and integration tests for POST /api/plan/ and Trip Orchestrator.

Per Step 7 acceptance criteria:
1. End-to-end contract test returns Section 5 shape using mocked providers.
2. Invalid input returns HTTP 422 with {"error": "validation", "fields": {...}}.
3. Upstream provider failure returns HTTP 502 JSON with {"error": "upstream", "message": "..."}.
4. Route recommendations, checkpoint risk evaluations, and 0-48h heatmap matrix adhere to domain rules.
5. All-No-Travel scenario handled gracefully.
6. TimeoutError mapped to HTTP 504.
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from planner.serializers import PlanTripResponseSerializer
from planner.services.routing import RouteCandidate, RoutingResult, RoutingService
from planner.services.weather import HourlyWeather, LocationWeather, UpstreamError, WeatherService


def _generate_synthetic_route(
    route_id: str,
    label: str,
    distance_miles: float,
    duration_minutes: float,
    start_coords: tuple[float, float] = (41.8781, -87.6298),
    end_coords: tuple[float, float] = (39.7392, -104.9903),
    mid_offset: float = 0.0,
) -> RouteCandidate:
    """Generate a realistic route candidate with 25 polyline points."""
    coords: list[list[float]] = []
    num_pts = 25
    for i in range(num_pts):
        fraction = i / (num_pts - 1)
        lat = start_coords[0] + fraction * (end_coords[0] - start_coords[0]) + mid_offset * (1 - fraction) * fraction * 4
        lon = start_coords[1] + fraction * (end_coords[1] - start_coords[1])
        coords.append([round(lon, 4), round(lat, 4)])

    return RouteCandidate(
        id=route_id,
        label=label,
        distance_miles=distance_miles,
        duration_minutes=duration_minutes,
        geometry_coords=coords,
    )


def _generate_mock_weather_for_coords(
    coordinates: list[tuple[float, float]],
    base_wind: float = 20.0,
    base_rain: float = 0.0,
    base_snow: float = 0.0,
) -> list[LocationWeather]:
    """Generate 72 hours of mock weather for a list of coordinates."""
    results: list[LocationWeather] = []
    base_time = datetime(2026, 10, 22, 0, 0, tzinfo=UTC)

    for coord in coordinates:
        hourly_dict: dict[str, HourlyWeather] = {}
        for h in range(72):
            t = base_time + timedelta(hours=h)
            time_iso = t.strftime("%Y-%m-%dT%H:00")
            hourly_dict[time_iso] = HourlyWeather(
                time_iso=time_iso,
                wind_mph=base_wind,
                rain_in_hr=base_rain,
                snow_in_hr=base_snow,
            )
        results.append(LocationWeather(lat=coord[0], lon=coord[1], hourly=hourly_dict))

    return results


@pytest.fixture
def api_client():
    """DRF test API client."""
    return APIClient()


@pytest.fixture
def mock_trip_request_payload():
    """Valid trip planning payload within departure time window."""
    dept = datetime.now(UTC) + timedelta(hours=3)
    return {
        "origin": {"label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298},
        "destination": {"label": "Denver, CO", "lat": 39.7392, "lon": -104.9903},
        "departure_time": dept.isoformat(),
        "load_weight_lb": 42000,
        "sampling_interval_miles": 50,
    }


class TestPlanTripContract:
    """Verifies that POST /api/plan/ returns the exact Section 5 contract shape."""

    @patch.object(RoutingService, "get_routes")
    @patch.object(WeatherService, "get_corridor_weather")
    def test_plan_trip_success_matches_contract_shape(
        self,
        mock_weather,
        mock_routing,
        api_client,
        mock_trip_request_payload,
    ):
        r1 = _generate_synthetic_route("r1", "Route A (I-80 W)", 1003.4, 905.0, mid_offset=0.2)
        r2 = _generate_synthetic_route("r2", "Route B (I-70 W)", 1045.0, 940.0, mid_offset=-0.3)
        mock_routing.return_value = RoutingResult(routes=[r1, r2], warnings=[])

        def weather_side_effect(coords, date_window=None):
            return _generate_mock_weather_for_coords(coords, base_wind=38.0, base_rain=0.0, base_snow=0.0)

        mock_weather.side_effect = weather_side_effect

        response = api_client.post("/api/plan/", mock_trip_request_payload, format="json")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()

        # 1. Validate top-level schema via PlanTripResponseSerializer
        serializer = PlanTripResponseSerializer(data=data)
        assert serializer.is_valid(), f"Response validation failed: {serializer.errors}"

        # 2. Assert top-level keys
        assert "meta" in data
        assert "recommended_route_id" in data
        assert "routes" in data
        assert "heatmap" in data

        # 3. Assert meta properties
        meta = data["meta"]
        assert "generated_at" in meta
        assert meta["load_weight_lb"] == 42000
        assert meta["sampling_interval_miles"] == 50
        assert meta["weather_source"] == "open-meteo"
        assert isinstance(meta["warnings"], list)

        # 4. Assert routes structure
        routes = data["routes"]
        assert len(routes) == 2
        for route in routes:
            assert "id" in route
            assert "label" in route
            assert "rank" in route
            assert "is_recommended" in route
            assert "distance_miles" in route
            assert "duration_minutes" in route
            assert "arrival_time" in route
            assert route["geometry"]["type"] == "LineString"
            assert len(route["geometry"]["coordinates"]) > 0

            # Summary verification
            summary = route["summary"]
            for field in [
                "no_travel_miles",
                "severe_miles",
                "high_miles",
                "moderate_miles",
                "low_miles",
                "avg_risk",
                "max_risk",
                "max_risk_label",
            ]:
                assert field in summary

            # Segment miles verification: sum of segment miles must strictly equal route distance (within float tolerance)
            checkpoints = route["checkpoints"]
            assert len(checkpoints) > 0
            total_seg_miles = sum(cp["segment_miles"] for cp in checkpoints)
            assert pytest.approx(total_seg_miles, abs=0.5) == route["distance_miles"]

            for cp in checkpoints:
                assert "index" in cp
                assert "mile" in cp
                assert "lat" in cp
                assert "lon" in cp
                assert "eta" in cp
                assert 1 <= cp["risk"] <= 5
                assert cp["risk_label"] in ["LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL"]
                assert "wind_mph" in cp
                assert "rain_in_hr" in cp
                assert "snow_in_hr" in cp
                assert "drivers" in cp
                assert "load_rule_applied" in cp
                assert "segment_miles" in cp

        # 5. Assert heatmap structure
        heatmap = data["heatmap"]
        assert len(heatmap["hours"]) == 49
        assert heatmap["hours"][0] == 0
        assert heatmap["hours"][-1] == 48
        assert len(heatmap["points"]) > 0
        for pt in heatmap["points"]:
            assert "lat" in pt
            assert "lon" in pt
            assert "route_ids" in pt
            assert len(pt["risk"]) == 49
            assert all(1 <= r <= 5 for r in pt["risk"])

    @patch.object(RoutingService, "get_routes")
    @patch.object(WeatherService, "get_corridor_weather")
    def test_all_routes_no_travel_scenario(
        self,
        mock_weather,
        mock_routing,
        api_client,
        mock_trip_request_payload,
    ):
        """When all routes encounter wind >= 55 mph, recommended_route_id is None and warning is present."""
        r1 = _generate_synthetic_route("r1", "Route A", 300.0, 280.0)
        mock_routing.return_value = RoutingResult(routes=[r1], warnings=[])

        # Hurricane-force wind > 55 mph
        def weather_side_effect(coords, date_window=None):
            return _generate_mock_weather_for_coords(coords, base_wind=60.0, base_rain=0.0, base_snow=0.0)

        mock_weather.side_effect = weather_side_effect

        response = api_client.post("/api/plan/", mock_trip_request_payload, format="json")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["recommended_route_id"] is None
        assert data["routes"][0]["is_recommended"] is False
        assert any("no travel" in w.lower() for w in data["meta"]["warnings"])


class TestPlanTripValidationErrors:
    """Verifies that invalid requests return HTTP 422 with clear field errors."""

    def test_missing_required_fields_returns_422(self, api_client):
        response = api_client.post("/api/plan/", {}, format="json")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "validation"
        assert "origin" in data["fields"]
        assert "destination" in data["fields"]
        assert "departure_time" in data["fields"]
        assert "load_weight_lb" in data["fields"]

    def test_departure_time_in_past_returns_422(self, api_client, mock_trip_request_payload):
        past_time = datetime.now(UTC) - timedelta(hours=2)
        payload = dict(mock_trip_request_payload)
        payload["departure_time"] = past_time.isoformat()

        response = api_client.post("/api/plan/", payload, format="json")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "validation"
        assert "departure_time" in data["fields"]

    def test_departure_time_beyond_7_days_returns_422(self, api_client, mock_trip_request_payload):
        future_time = datetime.now(UTC) + timedelta(days=8)
        payload = dict(mock_trip_request_payload)
        payload["departure_time"] = future_time.isoformat()

        response = api_client.post("/api/plan/", payload, format="json")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "validation"
        assert "departure_time" in data["fields"]

    def test_invalid_load_weight_returns_422(self, api_client, mock_trip_request_payload):
        payload_zero = dict(mock_trip_request_payload)
        payload_zero["load_weight_lb"] = 0
        res = api_client.post("/api/plan/", payload_zero, format="json")
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "load_weight_lb" in res.json()["fields"]

        payload_heavy = dict(mock_trip_request_payload)
        payload_heavy["load_weight_lb"] = 150000
        res2 = api_client.post("/api/plan/", payload_heavy, format="json")
        assert res2.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "load_weight_lb" in res2.json()["fields"]

    def test_identical_origin_and_destination_returns_422(self, api_client, mock_trip_request_payload):
        payload = dict(mock_trip_request_payload)
        payload["destination"] = payload["origin"]

        response = api_client.post("/api/plan/", payload, format="json")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "validation"
        assert "destination" in data["fields"]


class TestPlanTripUpstreamErrors:
    """Verifies that upstream external failures return HTTP 502 Bad Gateway JSON."""

    @patch.object(RoutingService, "get_routes")
    def test_routing_failure_returns_502(self, mock_routing, api_client, mock_trip_request_payload):
        mock_routing.side_effect = UpstreamError("OSRM router is currently unavailable", status_code=502)

        response = api_client.post("/api/plan/", mock_trip_request_payload, format="json")
        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        data = response.json()
        assert data["error"] == "upstream"
        assert "OSRM router is currently unavailable" in data["message"]

    @patch.object(RoutingService, "get_routes")
    @patch.object(WeatherService, "get_corridor_weather")
    def test_weather_failure_returns_502(
        self,
        mock_weather,
        mock_routing,
        api_client,
        mock_trip_request_payload,
    ):
        r1 = _generate_synthetic_route("r1", "Route A", 500.0, 480.0)
        mock_routing.return_value = RoutingResult(routes=[r1], warnings=[])
        mock_weather.side_effect = UpstreamError("Weather service unavailable, try again", status_code=502)

        response = api_client.post("/api/plan/", mock_trip_request_payload, format="json")
        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        data = response.json()
        assert data["error"] == "upstream"
        assert "Weather service unavailable" in data["message"]

    @patch("planner.views.plan_trip")
    def test_timeout_returns_504(self, mock_plan_trip, api_client, mock_trip_request_payload):
        mock_plan_trip.side_effect = TimeoutError("External service timed out")

        response = api_client.post("/api/plan/", mock_trip_request_payload, format="json")
        assert response.status_code == status.HTTP_504_GATEWAY_TIMEOUT
        data = response.json()
        assert data["error"] == "timeout"
        assert "timed out" in data["message"].lower()


class TestPlanFixtureIntegrity:
    """Verifies that frontend/src/api/fixtures/plan.json exists and strictly satisfies contract."""

    def test_plan_json_fixture_validity(self):
        fixture_path = Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "fixtures" / "plan.json"
        assert fixture_path.exists(), f"Fixture file not found at {fixture_path}"

        with open(fixture_path, encoding="utf-8") as f:
            data = json.load(f)

        serializer = PlanTripResponseSerializer(data=data)
        assert serializer.is_valid(), f"Fixture validation failed: {serializer.errors}"
        assert data["recommended_route_id"] in ["r1", "r2", "r3"]
        assert len(data["routes"]) == 3
        assert len(data["heatmap"]["hours"]) == 49

