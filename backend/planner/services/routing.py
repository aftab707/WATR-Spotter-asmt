"""Routing Service for Weather-Aware Truck Routing.

Implements multi-provider routing with automated fallback and via-waypoint alternative generation:
1. Primary: Mapbox Directions (if MAPBOX_ACCESS_TOKEN is configured)
2. Primary fallback: OSRM Public Driving Router
3. Via-waypoint alternative generator:
   If fewer than 3 distinct routes are returned, computes perpendicular offsets
   from route midpoints and queries via-waypoint routes to guarantee 3 alternatives.
4. Overlap de-duplication:
   Prunes candidate routes sharing > 90% geometry with an existing route.
5. Returns <= 3 routes with IDs ('r1', 'r2', 'r3') and labels ('Route A', 'Route B', 'Route C').
"""

import logging
import math
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import requests

from planner.logic.geometry import Point, haversine_distance_miles
from planner.services.weather import UpstreamError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"
MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving"
DEFAULT_ROUTING_TIMEOUT = 12.0
MAX_ROUTES_TARGET = 3
OVERLAP_THRESHOLD_RATIO = 0.90
OVERLAP_PROXIMITY_MILES = 1.2


@dataclass
class RouteCandidate:
    """Raw route candidate prior to final labeling and checkpoint assignment."""

    distance_miles: float
    duration_minutes: float
    geometry_coords: list[list[float]]  # GeoJSON [[lon, lat], ...]
    duration_profile: list[tuple[float, float]] | None = None
    id: str = ""
    label: str = ""


@dataclass
class RoutingResult:
    """Overall routing result containing up to 3 routes and optional warnings."""

    routes: list[RouteCandidate]
    warnings: list[str]


class BaseRoutingProvider(ABC):
    """Abstract interface for routing providers."""

    @abstractmethod
    def get_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool = True,
    ) -> list[RouteCandidate]:
        """Fetch routes between origin and destination (lat, lon)."""
        pass

    @abstractmethod
    def get_route_via_waypoint(
        self,
        origin: tuple[float, float],
        waypoint: tuple[float, float],
        destination: tuple[float, float],
    ) -> RouteCandidate | None:
        """Fetch a single route routed through an intermediate waypoint."""
        pass


class OSRMRoutingProvider(BaseRoutingProvider):
    """OSRM public HTTP router."""

    def __init__(self, timeout: float = DEFAULT_ROUTING_TIMEOUT):
        self.timeout = timeout

    def _parse_routes(self, data: dict[str, Any]) -> list[RouteCandidate]:
        raw_routes = data.get("routes", [])
        candidates: list[RouteCandidate] = []
        for r in raw_routes:
            dist_m = float(r.get("distance", 0.0))
            dur_s = float(r.get("duration", 0.0))
            coords = r.get("geometry", {}).get("coordinates", [])
            if not coords:
                continue
            candidates.append(
                RouteCandidate(
                    distance_miles=round(dist_m / 1609.344, 2),
                    duration_minutes=round(dur_s / 60.0, 1),
                    geometry_coords=coords,
                )
            )
        return candidates

    def get_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool = True,
    ) -> list[RouteCandidate]:
        url = (
            f"{OSRM_BASE_URL}/"
            f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
            f"?overview=full&geometries=geojson&alternatives={'true' if alternatives else 'false'}"
        )
        headers = {"User-Agent": "WATR-Truck-Router/1.0"}
        try:
            resp = requests.get(url, headers=headers, timeout=self.timeout)
            if resp.status_code != 200:
                logger.error("OSRM router returned HTTP %d: %s", resp.status_code, resp.text[:200])
                raise UpstreamError("Routing service unavailable, try again")
            data = resp.json()
        except requests.RequestException as exc:
            logger.error("OSRM request failed: %s", exc)
            raise UpstreamError("Routing service unavailable, try again") from exc

        return self._parse_routes(data)

    def get_route_via_waypoint(
        self,
        origin: tuple[float, float],
        waypoint: tuple[float, float],
        destination: tuple[float, float],
    ) -> RouteCandidate | None:
        url = (
            f"{OSRM_BASE_URL}/"
            f"{origin[1]},{origin[0]};{waypoint[1]},{waypoint[0]};{destination[1]},{destination[0]}"
            f"?overview=full&geometries=geojson&alternatives=false"
        )
        headers = {"User-Agent": "WATR-Truck-Router/1.0"}
        try:
            resp = requests.get(url, headers=headers, timeout=self.timeout)
            if resp.status_code != 200:
                return None
            data = resp.json()
            routes = self._parse_routes(data)
            return routes[0] if routes else None
        except Exception as exc:
            logger.warning("OSRM via-waypoint route failed: %s", exc)
            return None


class MapboxRoutingProvider(BaseRoutingProvider):
    """Mapbox Directions API router."""

    def __init__(self, token: str, timeout: float = DEFAULT_ROUTING_TIMEOUT):
        self.token = token
        self.timeout = timeout

    def _parse_routes(self, data: dict[str, Any]) -> list[RouteCandidate]:
        raw_routes = data.get("routes", [])
        candidates: list[RouteCandidate] = []
        for r in raw_routes:
            dist_m = float(r.get("distance", 0.0))
            dur_s = float(r.get("duration", 0.0))
            coords = r.get("geometry", {}).get("coordinates", [])
            if not coords:
                continue
            candidates.append(
                RouteCandidate(
                    distance_miles=round(dist_m / 1609.344, 2),
                    duration_minutes=round(dur_s / 60.0, 1),
                    geometry_coords=coords,
                )
            )
        return candidates

    def get_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool = True,
    ) -> list[RouteCandidate]:
        if not self.token:
            raise UpstreamError("Mapbox token not configured")
        url = (
            f"{MAPBOX_DIRECTIONS_URL}/"
            f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
            f"?alternatives={'true' if alternatives else 'false'}&geometries=geojson&overview=full&access_token={self.token}"
        )
        try:
            resp = requests.get(url, timeout=self.timeout)
            if resp.status_code != 200:
                raise UpstreamError(f"Mapbox returned HTTP {resp.status_code}")
            data = resp.json()
        except requests.RequestException as exc:
            raise UpstreamError(f"Mapbox request failed: {exc}") from exc

        return self._parse_routes(data)

    def get_route_via_waypoint(
        self,
        origin: tuple[float, float],
        waypoint: tuple[float, float],
        destination: tuple[float, float],
    ) -> RouteCandidate | None:
        if not self.token:
            return None
        url = (
            f"{MAPBOX_DIRECTIONS_URL}/"
            f"{origin[1]},{origin[0]};{waypoint[1]},{waypoint[0]};{destination[1]},{destination[0]}"
            f"?alternatives=false&geometries=geojson&overview=full&access_token={self.token}"
        )
        try:
            resp = requests.get(url, timeout=self.timeout)
            if resp.status_code != 200:
                return None
            data = resp.json()
            routes = self._parse_routes(data)
            return routes[0] if routes else None
        except Exception:
            return None


def calculate_geometry_overlap_ratio(
    coords_a: list[list[float]],
    coords_b: list[list[float]],
    sample_size: int = 50,
    proximity_miles: float = OVERLAP_PROXIMITY_MILES,
) -> float:
    """Calculate the overlap ratio between two polyline geometries.

    Evaluates the fraction of sampled coordinates from coords_b that lie within
    proximity_miles of any point in coords_a.
    """
    if not coords_a or not coords_b:
        return 0.0

    step = max(1, len(coords_b) // sample_size)
    sampled_b = coords_b[::step]
    if not sampled_b:
        return 0.0

    points_a = [Point(lat=c[1], lon=c[0]) for c in coords_a]

    overlapping_count = 0
    for cb in sampled_b:
        pb = Point(lat=cb[1], lon=cb[0])
        # Find minimum distance to points in coords_a
        min_dist = min(haversine_distance_miles(pb, pa) for pa in points_a)
        if min_dist <= proximity_miles:
            overlapping_count += 1

    return overlapping_count / len(sampled_b)


def generate_perpendicular_waypoint(
    origin: tuple[float, float],
    destination: tuple[float, float],
    midpoint: tuple[float, float],
    offset_scale: float = 0.12,
    direction: int = 1,
) -> tuple[float, float]:
    """Compute a perpendicular offset waypoint from the midpoint of the route corridor.

    Args:
        origin: (lat, lon)
        destination: (lat, lon)
        midpoint: (lat, lon)
        offset_scale: Proportion of distance to offset (default ~12%).
        direction: +1 for one perpendicular side, -1 for the other.

    Returns:
        Offset waypoint coordinate (lat, lon).
    """
    d_lat = destination[0] - origin[0]
    d_lon = destination[1] - origin[1]
    euclidean_len = math.sqrt(d_lat * d_lat + d_lon * d_lon)

    if euclidean_len == 0:
        return midpoint

    # Perpendicular unit vector: (-d_lon, d_lat) * direction
    unit_perp_lat = (-d_lon / euclidean_len) * direction
    unit_perp_lon = (d_lat / euclidean_len) * direction

    offset_magnitude = euclidean_len * offset_scale

    waypoint_lat = midpoint[0] + unit_perp_lat * offset_magnitude
    waypoint_lon = midpoint[1] + unit_perp_lon * offset_magnitude

    return (round(waypoint_lat, 4), round(waypoint_lon, 4))


class RoutingService:
    """Orchestrates route generation, provider fallback, and via-waypoint alternative generation."""

    def __init__(
        self,
        primary_provider: BaseRoutingProvider | None = None,
        fallback_provider: BaseRoutingProvider | None = None,
    ):
        mapbox_token = os.environ.get("MAPBOX_ACCESS_TOKEN", "").strip()
        if primary_provider:
            self.primary = primary_provider
        elif mapbox_token:
            self.primary = MapboxRoutingProvider(token=mapbox_token)
        else:
            self.primary = OSRMRoutingProvider()

        self.fallback = fallback_provider or OSRMRoutingProvider()

    def get_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> RoutingResult:
        """Fetch up to 3 distinct routes between origin and destination."""
        warnings: list[str] = []

        # 1. Fetch initial routes from primary provider (with fallback)
        active_provider = self.primary
        try:
            initial_routes = self.primary.get_routes(origin, destination, alternatives=True)
        except UpstreamError as exc:
            logger.warning("Primary routing provider failed (%s), switching to fallback", exc)
            active_provider = self.fallback
            initial_routes = self.fallback.get_routes(origin, destination, alternatives=True)

        if not initial_routes:
            raise UpstreamError("No routes found between origin and destination")

        # 2. De-duplicate initial routes
        distinct_routes: list[RouteCandidate] = []
        for candidate in initial_routes:
            is_dup = False
            for existing in distinct_routes:
                overlap = calculate_geometry_overlap_ratio(
                    existing.geometry_coords, candidate.geometry_coords
                )
                if overlap >= OVERLAP_THRESHOLD_RATIO:
                    is_dup = True
                    break
            if not is_dup:
                distinct_routes.append(candidate)

        # 3. If fewer than 3 distinct routes, generate via-waypoint alternatives
        if len(distinct_routes) < MAX_ROUTES_TARGET and distinct_routes:
            base_route = distinct_routes[0]
            coords = base_route.geometry_coords
            mid_idx = len(coords) // 2
            midpoint = (coords[mid_idx][1], coords[mid_idx][0])  # (lat, lon)

            # Try both perpendicular directions (+1 and -1) at multiple scales
            offset_attempts = [(1, 0.10), (-1, 0.10), (1, 0.18), (-1, 0.18)]
            for direction, scale in offset_attempts:
                if len(distinct_routes) >= MAX_ROUTES_TARGET:
                    break

                waypoint = generate_perpendicular_waypoint(
                    origin=origin,
                    destination=destination,
                    midpoint=midpoint,
                    offset_scale=scale,
                    direction=direction,
                )

                candidate_via = active_provider.get_route_via_waypoint(origin, waypoint, destination)
                if not candidate_via:
                    continue

                # Verify this alternative does not share > 90% geometry with existing routes
                is_duplicate = False
                for existing in distinct_routes:
                    overlap = calculate_geometry_overlap_ratio(
                        existing.geometry_coords, candidate_via.geometry_coords
                    )
                    if overlap >= OVERLAP_THRESHOLD_RATIO:
                        is_duplicate = True
                        break

                if not is_duplicate:
                    distinct_routes.append(candidate_via)

        # 4. If still fewer than 3, add warning
        if len(distinct_routes) < MAX_ROUTES_TARGET:
            warnings.append(
                f"Only {len(distinct_routes)} distinct route option(s) available for this corridor."
            )

        # 5. Assign clean IDs ('r1', 'r2', 'r3') and labels ('Route A', 'Route B', 'Route C')
        labeled_routes = distinct_routes[:MAX_ROUTES_TARGET]
        labels = ["Route A", "Route B", "Route C"]
        for idx, route in enumerate(labeled_routes):
            route.id = f"r{idx + 1}"
            route.label = labels[idx] if idx < len(labels) else f"Route {idx + 1}"

        return RoutingResult(routes=labeled_routes, warnings=warnings)
