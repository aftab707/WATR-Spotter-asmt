"""Pure Geometry Module for Weather-Aware Truck Routing.

Implements:
- Haversine great-circle distance calculation between geographic coordinates.
- Cumulative distance accumulation along polyline coordinates scaled to provider road distance.
- Uniform checkpoint sampling at specified intervals (10, 25, 50 miles) plus terminal checkpoint.
- Ramer-Douglas-Peucker (RDP) polyline simplification for lightweight map rendering (<= 2000 points).
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# Mean Earth radius in miles (WGS-84 spherical approximation)
EARTH_RADIUS_MILES = 3958.7613
MAX_DISPLAY_GEOMETRY_POINTS = 2000


@dataclass(frozen=True)
class Point:
    """Immutable geographic coordinate."""

    lat: float
    lon: float

    @classmethod
    def from_geojson_coord(cls, coord: Sequence[float]) -> "Point":
        """Create Point from GeoJSON [lon, lat] coordinate array."""
        return cls(lat=float(coord[1]), lon=float(coord[0]))

    def to_geojson_coord(self) -> list[float]:
        """Convert Point to GeoJSON [lon, lat] format."""
        return [round(self.lon, 6), round(self.lat, 6)]


@dataclass(frozen=True)
class SampledCheckpoint:
    """Checkpoint sampled along a route corridor.

    Attributes:
        index: Zero-based sequence index.
        mile: Cumulative distance in miles from the route start.
        point: Geographic coordinates of the checkpoint.
    """

    index: int
    mile: float
    point: Point


def haversine_distance_miles(p1: Point, p2: Point) -> float:
    """Calculate the great-circle distance between two geographic points in miles.

    Uses the Haversine formula:
        a = sin^2(dlat / 2) + cos(lat1) * cos(lat2) * sin^2(dlon / 2)
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        d = R * c
    """
    if p1.lat == p2.lat and p1.lon == p2.lon:
        return 0.0

    phi1 = math.radians(p1.lat)
    phi2 = math.radians(p2.lat)
    delta_phi = math.radians(p2.lat - p1.lat)
    delta_lambda = math.radians(p2.lon - p1.lon)

    sin_half_phi = math.sin(delta_phi / 2.0)
    sin_half_lambda = math.sin(delta_lambda / 2.0)

    a = (
        sin_half_phi * sin_half_phi
        + math.cos(phi1) * math.cos(phi2) * sin_half_lambda * sin_half_lambda
    )
    # Clamp to avoid floating point imprecision exceeding 1.0
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_MILES * c


def calculate_cumulative_distances(points: Sequence[Point]) -> list[float]:
    """Calculate cumulative Haversine distances along a sequence of points in miles."""
    if not points:
        return []

    cumulative = [0.0]
    total = 0.0
    for i in range(1, len(points)):
        step = haversine_distance_miles(points[i - 1], points[i])
        total += step
        cumulative.append(total)

    return cumulative


def interpolate_point(p1: Point, p2: Point, fraction: float) -> Point:
    """Linearly interpolate coordinates between p1 and p2 by a fraction in [0, 1]."""
    if fraction <= 0.0:
        return p1
    if fraction >= 1.0:
        return p2

    lat = p1.lat + (p2.lat - p1.lat) * fraction
    lon = p1.lon + (p2.lon - p1.lon) * fraction
    return Point(lat=lat, lon=lon)


def sample_checkpoints(
    points: Sequence[Point],
    interval_miles: float,
    provider_total_miles: float | None = None,
) -> list[SampledCheckpoint]:
    """Sample checkpoints along a polyline at fixed intervals plus the terminal destination point.

    Per Section 3:
        Checkpoints at miles 0, N, 2N, ... plus final point at total distance.
        N in {10, 25, 50}.

    Args:
        points: Route polyline coordinates.
        interval_miles: Sampling frequency (e.g. 10, 25, 50).
        provider_total_miles: Actual total distance reported by routing engine (miles).
                              If provided and > 0, polyline segments are proportionally
                              scaled to match the provider's exact road distance.

    Returns:
        List of SampledCheckpoint objects.
    """
    if not points:
        return []

    if len(points) == 1:
        mile = round(provider_total_miles, 2) if provider_total_miles is not None else 0.0
        return [SampledCheckpoint(index=0, mile=mile, point=points[0])]

    raw_cumulative = calculate_cumulative_distances(points)
    raw_total = raw_cumulative[-1]

    # Target total distance
    if provider_total_miles is not None and provider_total_miles > 0:
        total_miles = provider_total_miles
        scale = total_miles / raw_total if raw_total > 0 else 1.0
        scaled_cumulative = [dist * scale for dist in raw_cumulative]
    else:
        total_miles = raw_total
        scaled_cumulative = raw_cumulative

    # Generate target milestone distances: 0, interval, 2*interval, ...
    target_miles = []
    current_mile = 0.0
    while current_mile < total_miles:
        target_miles.append(round(current_mile, 4))
        current_mile += interval_miles

    # Always include the terminal destination checkpoint
    # If the last milestone was not the exact total distance, append total
    rounded_total = round(total_miles, 4)
    if not target_miles or target_miles[-1] < rounded_total:
        target_miles.append(rounded_total)

    # Walk along the polyline segments to locate and interpolate target miles
    checkpoints: list[SampledCheckpoint] = []
    seg_idx = 0
    num_segments = len(points) - 1

    for chk_idx, target in enumerate(target_miles):
        # Advance segment index until target falls within [scaled_cumulative[seg_idx], scaled_cumulative[seg_idx + 1]]
        while seg_idx < num_segments - 1 and scaled_cumulative[seg_idx + 1] < target:
            seg_idx += 1

        seg_start_dist = scaled_cumulative[seg_idx]
        seg_end_dist = scaled_cumulative[seg_idx + 1]
        seg_length = seg_end_dist - seg_start_dist

        if seg_length > 0:
            fraction = (target - seg_start_dist) / seg_length
            pt = interpolate_point(points[seg_idx], points[seg_idx + 1], fraction)
        else:
            pt = points[seg_idx]

        checkpoints.append(
            SampledCheckpoint(
                index=chk_idx,
                mile=round(target, 2),
                point=pt,
            )
        )

    return checkpoints


# ---------------------------------------------------------------------------
# Polyline Simplification (Ramer-Douglas-Peucker)
# ---------------------------------------------------------------------------
def _perpendicular_distance_sq(pt: Point, line_start: Point, line_end: Point) -> float:
    """Perpendicular distance squared in degrees from pt to line segment [line_start, line_end]."""
    dx = line_end.lon - line_start.lon
    dy = line_end.lat - line_start.lat

    line_len_sq = dx * dx + dy * dy
    if line_len_sq == 0:
        pdx = pt.lon - line_start.lon
        pdy = pt.lat - line_start.lat
        return pdx * pdx + pdy * pdy

    t = ((pt.lon - line_start.lon) * dx + (pt.lat - line_start.lat) * dy) / line_len_sq
    t = max(0.0, min(1.0, t))

    proj_lon = line_start.lon + t * dx
    proj_lat = line_start.lat + t * dy

    pdx = pt.lon - proj_lon
    pdy = pt.lat - proj_lat
    return pdx * pdx + pdy * pdy


def _rdp_recursive(points: Sequence[Point], epsilon_sq: float) -> list[Point]:
    """Internal recursive Ramer-Douglas-Peucker step."""
    if len(points) <= 2:
        return list(points)

    dmax_sq = 0.0
    index = 0
    start = points[0]
    end = points[-1]

    for i in range(1, len(points) - 1):
        d_sq = _perpendicular_distance_sq(points[i], start, end)
        if d_sq > dmax_sq:
            index = i
            dmax_sq = d_sq

    if dmax_sq > epsilon_sq:
        rec1 = _rdp_recursive(points[: index + 1], epsilon_sq)
        rec2 = _rdp_recursive(points[index:], epsilon_sq)
        return rec1[:-1] + rec2

    return [start, end]


def simplify_polyline(
    points: Sequence[Point],
    max_points: int = MAX_DISPLAY_GEOMETRY_POINTS,
    base_epsilon_deg: float = 0.0001,
) -> list[Point]:
    """Simplify polyline coordinates using Ramer-Douglas-Peucker algorithm.

    Guarantees the resulting coordinate list has <= max_points for smooth frontend rendering.
    If the input already has <= max_points, it is returned without decimation.
    """
    if len(points) <= max_points:
        return list(points)

    epsilon = base_epsilon_deg
    simplified = list(points)

    # Iteratively increase epsilon until point count is below max_points
    for _ in range(10):
        simplified = _rdp_recursive(points, epsilon * epsilon)
        if len(simplified) <= max_points:
            break
        epsilon *= 1.8

    return simplified
