"""Unit tests for pure route summary and segment miles allocation functions."""

import pytest

from planner.logic.risk import RiskLevel
from planner.logic.summary import (
    CheckpointRiskInput,
    calculate_segment_miles,
    compute_route_summary,
)


def test_segment_miles_sum_equals_distance_regular():
    """Acceptance check: segment miles sum == distance on 100-mile route with 25-mile intervals."""
    miles = [0.0, 25.0, 50.0, 75.0, 100.0]
    total_distance = 100.0

    segments = calculate_segment_miles(miles, total_distance)

    assert len(segments) == 5
    assert segments[0] == 12.5
    assert segments[1] == 25.0
    assert segments[2] == 25.0
    assert segments[3] == 25.0
    assert segments[4] == 12.5

    assert pytest.approx(sum(segments), abs=1e-6) == total_distance


def test_segment_miles_sum_equals_distance_non_multiple():
    """Acceptance check: segment miles sum == distance on non-multiple route (e.g. 105.4 miles)."""
    miles = [0.0, 25.0, 50.0, 75.0, 100.0, 105.4]
    total_distance = 105.4

    segments = calculate_segment_miles(miles, total_distance)
    assert len(segments) == 6
    assert pytest.approx(sum(segments), abs=1e-6) == total_distance


def test_segment_miles_single_and_empty():
    """Single checkpoint gets the entire distance; empty returns empty."""
    assert calculate_segment_miles([0.0], 50.0) == [50.0]
    assert calculate_segment_miles([], 50.0) == []


def test_weighted_avg_risk_on_hand_made_data():
    """Acceptance check: weighted avg risk correct on hand-made data."""
    checkpoints = [
        CheckpointRiskInput(mile=0.0, risk_level=RiskLevel.LOW, segment_miles=12.5),
        CheckpointRiskInput(mile=25.0, risk_level=RiskLevel.MODERATE, segment_miles=25.0),
        CheckpointRiskInput(mile=50.0, risk_level=RiskLevel.HIGH, segment_miles=25.0),
        CheckpointRiskInput(mile=75.0, risk_level=RiskLevel.SEVERE, segment_miles=25.0),
        CheckpointRiskInput(mile=100.0, risk_level=RiskLevel.NO_TRAVEL, segment_miles=12.5),
    ]

    summary = compute_route_summary(checkpoints, total_distance_miles=100.0)

    assert summary.low_miles == 12.5
    assert summary.moderate_miles == 25.0
    assert summary.high_miles == 25.0
    assert summary.severe_miles == 25.0
    assert summary.no_travel_miles == 12.5
    assert summary.avg_risk == 3.00
    assert summary.max_risk == 5
    assert summary.max_risk_label == "NO_TRAVEL"

    tier_sum = (
        summary.low_miles
        + summary.moderate_miles
        + summary.high_miles
        + summary.severe_miles
        + summary.no_travel_miles
    )
    assert pytest.approx(tier_sum, abs=1e-1) == 100.0


def test_summary_calculates_segments_if_missing():
    """If segment_miles is None, compute_route_summary automatically computes them."""
    checkpoints = [
        CheckpointRiskInput(mile=0.0, risk_level=RiskLevel.LOW, segment_miles=None),
        CheckpointRiskInput(mile=50.0, risk_level=RiskLevel.HIGH, segment_miles=None),
        CheckpointRiskInput(mile=100.0, risk_level=RiskLevel.SEVERE, segment_miles=None),
    ]
    summary = compute_route_summary(checkpoints, total_distance_miles=100.0)
    assert summary.max_risk == 4
    assert summary.max_risk_label == "SEVERE"
    assert summary.low_miles == 25.0
    assert summary.high_miles == 50.0
    assert summary.severe_miles == 25.0


def test_summary_zero_distance():
    """Zero total distance with non-empty checkpoint returns checkpoint risk as avg_risk."""
    checkpoints = [CheckpointRiskInput(mile=0.0, risk_level=RiskLevel.HIGH, segment_miles=0.0)]
    summary = compute_route_summary(checkpoints, total_distance_miles=0.0)
    assert summary.avg_risk == 3.0
    assert summary.max_risk == 3


def test_empty_checkpoints_summary():
    """Empty checkpoints list returns safe default summary."""
    summary = compute_route_summary([], total_distance_miles=0.0)
    assert summary.avg_risk == 1.0
    assert summary.max_risk == 1
    assert summary.max_risk_label == "LOW"
    assert summary.low_miles == 0.0
