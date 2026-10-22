"""Unit tests for pure geometry functions: Haversine, sampling, and polyline simplification."""

import math

from planner.logic.geometry import (
    Point,
    _perpendicular_distance_sq,
    calculate_cumulative_distances,
    haversine_distance_miles,
    interpolate_point,
    sample_checkpoints,
    simplify_polyline,
)


def create_straight_line(length_miles: float, num_points: int = 50) -> list[Point]:
    """Helper to generate an exact straight line along a meridian (due north).

    Each degree of latitude is approximately 69.04 miles.
    """
    start_lat = 40.0
    start_lon = -90.0
    delta_lat = length_miles / 69.046767
    points = []
    for i in range(num_points):
        fraction = i / (num_points - 1)
        lat = start_lat + fraction * delta_lat
        points.append(Point(lat=lat, lon=start_lon))
    return points


def test_haversine_zero_distance():
    """Distance between identical coordinates is 0.0."""
    p = Point(lat=41.8781, lon=-87.6298)
    assert haversine_distance_miles(p, p) == 0.0


def test_haversine_known_distance():
    """Known distance Chicago (41.8781, -87.6298) to Milwaukee (43.0389, -87.9065) is ~81.5 great-circle miles."""
    chicago = Point(lat=41.8781, lon=-87.6298)
    milwaukee = Point(lat=43.0389, lon=-87.9065)
    dist = haversine_distance_miles(chicago, milwaukee)
    assert 80.0 <= dist <= 83.0


def test_sampling_100_mile_line_at_25_miles():
    """Acceptance check: 100-mile straight line @25 -> miles [0, 25, 50, 75, 100]."""
    points = create_straight_line(100.0, num_points=100)
    checkpoints = sample_checkpoints(points, interval_miles=25.0, provider_total_miles=100.0)

    sampled_miles = [cp.mile for cp in checkpoints]
    assert sampled_miles == [0.0, 25.0, 50.0, 75.0, 100.0]
    assert len(checkpoints) == 5
    assert checkpoints[0].index == 0
    assert checkpoints[-1].index == 4


def test_sampling_non_multiple_adds_final_point():
    """Acceptance check: non-multiple distance (e.g. 105 miles @25) adds a final point."""
    points = create_straight_line(105.0, num_points=100)
    checkpoints = sample_checkpoints(points, interval_miles=25.0, provider_total_miles=105.0)

    sampled_miles = [cp.mile for cp in checkpoints]
    assert sampled_miles == [0.0, 25.0, 50.0, 75.0, 100.0, 105.0]
    assert len(checkpoints) == 6


def test_sampling_short_route_smaller_than_interval():
    """Route shorter than interval (e.g. 18.5 miles @25) produces [0, 18.5]."""
    points = create_straight_line(18.5, num_points=20)
    checkpoints = sample_checkpoints(points, interval_miles=25.0, provider_total_miles=18.5)

    sampled_miles = [cp.mile for cp in checkpoints]
    assert sampled_miles == [0.0, 18.5]


def test_sampling_single_point_graceful():
    """Single-point path produces a single checkpoint at distance 0.0 or provider distance."""
    p = Point(lat=40.0, lon=-90.0)
    checkpoints = sample_checkpoints([p], interval_miles=25.0, provider_total_miles=0.0)
    assert len(checkpoints) == 1
    assert checkpoints[0].mile == 0.0


def test_sampling_empty_points():
    """Empty coordinate list produces empty checkpoints."""
    assert sample_checkpoints([], interval_miles=25.0) == []


def test_sampling_zero_length_segments():
    """Route with identical sequential points (zero-length segment) handled cleanly."""
    points = [
        Point(lat=40.0, lon=-90.0),
        Point(lat=40.0, lon=-90.0),
        Point(lat=41.0, lon=-90.0),
    ]
    checkpoints = sample_checkpoints(points, interval_miles=25.0)
    assert len(checkpoints) >= 2


def test_interpolate_point_boundaries():
    """fraction <= 0 returns p1, fraction >= 1 returns p2."""
    p1 = Point(lat=40.0, lon=-90.0)
    p2 = Point(lat=41.0, lon=-89.0)
    assert interpolate_point(p1, p2, -0.5) == p1
    assert interpolate_point(p1, p2, 1.5) == p2


def test_cumulative_distances_monotonic():
    """Cumulative distances strictly non-decreasing."""
    points = [
        Point(lat=40.0, lon=-90.0),
        Point(lat=40.5, lon=-90.0),
        Point(lat=41.0, lon=-90.0),
        Point(lat=41.5, lon=-90.0),
    ]
    cum = calculate_cumulative_distances(points)
    assert len(cum) == len(points)
    assert cum[0] == 0.0
    for i in range(1, len(cum)):
        assert cum[i] > cum[i - 1]


def test_simplify_polyline_within_limit_unchanged():
    """Polylines already under max_points are not decimated."""
    points = create_straight_line(50.0, num_points=50)
    simplified = simplify_polyline(points, max_points=100)
    assert len(simplified) == 50


def test_simplify_polyline_two_points():
    """Polyline with 2 points returned directly."""
    points = [Point(lat=40.0, lon=-90.0), Point(lat=41.0, lon=-90.0)]
    assert simplify_polyline(points, max_points=10) == points


def test_simplify_polyline_large_decimated():
    """Polylines exceeding max_points (e.g. 3000 points) are reduced to <= 2000 points."""
    raw_points = []
    for i in range(3000):
        lat = 40.0 + (i / 3000.0) * 5.0
        lon = -90.0 + 0.1 * math.sin(i / 50.0)
        raw_points.append(Point(lat=lat, lon=lon))

    simplified = simplify_polyline(raw_points, max_points=2000)
    assert len(simplified) <= 2000
    assert simplified[0] == raw_points[0]
    assert simplified[-1] == raw_points[-1]


def test_perpendicular_distance_degenerate_line():
    """Perpendicular distance where segment start and end are identical point."""
    p = Point(lat=40.5, lon=-90.5)
    start = Point(lat=40.0, lon=-90.0)
    d_sq = _perpendicular_distance_sq(p, start, start)
    assert d_sq > 0.0


def test_point_geojson_conversion():
    """Point converts to and from GeoJSON coordinate pairs correctly."""
    coord = [-87.6298, 41.8781]
    p = Point.from_geojson_coord(coord)
    assert p.lat == 41.8781
    assert p.lon == -87.6298
    assert p.to_geojson_coord() == coord
