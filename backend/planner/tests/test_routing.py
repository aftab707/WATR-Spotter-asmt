"""Unit tests for routing service: provider fallback, via-waypoint alternatives, and overlap de-duplication."""

import json
from pathlib import Path

import pytest
from requests_mock.mocker import Mocker

from planner.services.routing import (
    OSRM_BASE_URL,
    OSRMRoutingProvider,
    RouteCandidate,
    RoutingService,
    calculate_geometry_overlap_ratio,
    generate_perpendicular_waypoint,
)
from planner.services.weather import UpstreamError

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture
def osrm_chicago_denver_fixture():
    with open(FIXTURES_DIR / "osrm_chicago_to_denver.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def osrm_chicago_milwaukee_fixture():
    with open(FIXTURES_DIR / "osrm_chicago_to_milwaukee.json", encoding="utf-8") as f:
        return json.load(f)


def test_geometry_overlap_ratio():
    """Identical or nearly identical routes produce overlap > 0.90; divergent routes produce lower."""
    coords_a = [[-87.6 + i * 0.01, 41.8 + i * 0.01] for i in range(100)]
    # Duplicate with minor jitter (<0.1 mi away)
    coords_dup = [[c[0] + 0.0001, c[1] + 0.0001] for c in coords_a]
    # Divergent path
    coords_divergent = [[-87.6 - i * 0.05, 41.8 + i * 0.02] for i in range(100)]

    overlap_dup = calculate_geometry_overlap_ratio(coords_a, coords_dup)
    assert overlap_dup >= 0.90

    overlap_div = calculate_geometry_overlap_ratio(coords_a, coords_divergent)
    assert overlap_div < 0.50


def test_perpendicular_waypoint_generation():
    """Generates non-collinear waypoint offset from route midpoint."""
    origin = (41.8781, -87.6298)
    destination = (39.7392, -104.9903)
    midpoint = (40.8000, -96.3000)

    wp_north = generate_perpendicular_waypoint(origin, destination, midpoint, offset_scale=0.15, direction=1)
    wp_south = generate_perpendicular_waypoint(origin, destination, midpoint, offset_scale=0.15, direction=-1)

    assert wp_north != midpoint
    assert wp_south != midpoint
    assert wp_north != wp_south


def test_provider_failure_falls_back_to_osrm(requests_mock: Mocker, osrm_chicago_milwaukee_fixture):
    """Acceptance check: primary routing provider failure falls back to secondary provider."""
    # Mock primary provider failing
    class FailingProvider(OSRMRoutingProvider):
        def get_routes(self, origin, destination, alternatives=True):
            raise UpstreamError("Primary routing provider down")

    # Mock OSRM fallback succeeding
    requests_mock.get(f"{OSRM_BASE_URL}/-87.6298,41.8781;-87.9065,43.0389", json=osrm_chicago_milwaukee_fixture)

    service = RoutingService(
        primary_provider=FailingProvider(),
        fallback_provider=OSRMRoutingProvider(),
    )
    result = service.get_routes((41.8781, -87.6298), (43.0389, -87.9065))

    assert len(result.routes) >= 2
    assert result.routes[0].id == "r1"
    assert result.routes[0].label == "Route A"


def test_less_than_3_routes_triggers_via_waypoint_alternatives(
    requests_mock: Mocker,
    osrm_chicago_denver_fixture,
):
    """Acceptance check: when router returns < 3 routes, via-waypoint generator triggers to reach 3 routes."""
    import re

    # Match direct route (2 coordinate pairs separated by 1 semicolon)
    direct_pattern = re.compile(r"https://router\.project-osrm\.org/route/v1/driving/[^;]+;[^;?]+(\?.*)?$")
    requests_mock.get(direct_pattern, json=osrm_chicago_denver_fixture)

    # Mock via-waypoint query: return a distinct 3rd route alternative (2 semicolons)
    distinct_3rd_coords = [[-87.6298 - i * 0.05, 41.8781 - i * 0.02] for i in range(100)]
    waypoint_response = {
        "code": "Ok",
        "routes": [
            {
                "distance": 1650000.0,
                "duration": 65000.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": distinct_3rd_coords,
                },
            }
        ],
    }
    waypoint_pattern = re.compile(r"https://router\.project-osrm\.org/route/v1/driving/[^;]+;[^;]+;[^;?]+(\?.*)?$")
    requests_mock.get(waypoint_pattern, json=waypoint_response)

    provider = OSRMRoutingProvider()
    service = RoutingService(primary_provider=provider)
    result = service.get_routes((41.8781, -87.6298), (39.7392, -104.9903))

    assert len(result.routes) == 3
    assert [r.id for r in result.routes] == ["r1", "r2", "r3"]
    assert [r.label for r in result.routes] == ["Route A", "Route B", "Route C"]


def test_duplicates_removed():
    """Acceptance check: routes sharing > 90% geometry are pruned as duplicates."""
    base_coords = [[-87.6 + i * 0.01, 41.8 + i * 0.01] for i in range(100)]
    dup_coords = [[c[0] + 0.0001, c[1] + 0.0001] for c in base_coords]

    mock_routes = [
        RouteCandidate(distance_miles=100.0, duration_minutes=120.0, geometry_coords=base_coords),
        RouteCandidate(distance_miles=100.1, duration_minutes=121.0, geometry_coords=dup_coords),
    ]

    class MockProvider(OSRMRoutingProvider):
        def get_routes(self, origin, destination, alternatives=True):
            return mock_routes

        def get_route_via_waypoint(self, origin, waypoint, destination):
            return None

    service = RoutingService(primary_provider=MockProvider())
    result = service.get_routes((41.8, -87.6), (42.8, -86.6))

    # Duplicate was dropped! Only 1 distinct route remained.
    assert len(result.routes) == 1
    assert "Only 1 distinct route option(s) available" in result.warnings[0]
