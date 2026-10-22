"""Unit tests for pure ETA and time calculation functions."""

from datetime import UTC, datetime

from planner.logic.eta import (
    calculate_checkpoint_eta,
    calculate_etas_for_checkpoints,
    get_forecast_hour_offset,
    get_nearest_forecast_hour,
)


def test_eta_constant_speed_monotonic_and_correct():
    """Acceptance check: ETA monotonic and correct across constant average speed route."""
    departure = datetime(2026, 11, 2, 8, 0, 0, tzinfo=UTC)
    total_dist = 100.0
    total_dur = 120.0
    miles = [0.0, 25.0, 50.0, 75.0, 100.0]

    etas = calculate_etas_for_checkpoints(
        departure_time=departure,
        checkpoint_miles=miles,
        total_distance_miles=total_dist,
        total_duration_minutes=total_dur,
    )

    assert len(etas) == 5
    assert etas[0] == datetime(2026, 11, 2, 8, 0, 0, tzinfo=UTC)
    assert etas[1] == datetime(2026, 11, 2, 8, 30, 0, tzinfo=UTC)
    assert etas[2] == datetime(2026, 11, 2, 9, 0, 0, tzinfo=UTC)
    assert etas[3] == datetime(2026, 11, 2, 9, 30, 0, tzinfo=UTC)
    assert etas[4] == datetime(2026, 11, 2, 10, 0, 0, tzinfo=UTC)

    # Strictly monotonic
    for i in range(1, len(etas)):
        assert etas[i] > etas[i - 1]


def test_eta_with_distance_duration_profile():
    """ETA linearly interpolates within profile segments when provided."""
    departure = datetime(2026, 11, 2, 8, 0, 0, tzinfo=UTC)
    profile = [(10.0, 10.0), (50.0, 30.0), (100.0, 120.0)]

    # Below profile start
    eta_below = calculate_checkpoint_eta(departure, 5.0, 100.0, 120.0, profile)
    assert eta_below == datetime(2026, 11, 2, 8, 10, 0, tzinfo=UTC)

    # Above profile end (clamped to total)
    eta_above = calculate_checkpoint_eta(departure, 105.0, 100.0, 120.0, profile)
    assert eta_above == datetime(2026, 11, 2, 10, 0, 0, tzinfo=UTC)

    # Intermediate interpolations
    eta_25 = calculate_checkpoint_eta(departure, 30.0, 100.0, 120.0, profile)
    # Between 10mi (10m) and 50mi (30m): span 40mi, time 20m -> 30mi is halfway -> 20m elapsed
    assert eta_25 == datetime(2026, 11, 2, 8, 20, 0, tzinfo=UTC)


def test_calculate_etas_for_checkpoints_monotonic_clamp():
    """calculate_etas_for_checkpoints enforces monotonicity even if miles slightly regress."""
    departure = datetime(2026, 11, 2, 8, 0, 0, tzinfo=UTC)
    # Regressive mile list [50, 40]
    etas = calculate_etas_for_checkpoints(departure, [50.0, 40.0], 100.0, 100.0)
    assert len(etas) == 2
    assert etas[0] == etas[1]


def test_eta_edge_cases():
    """Edge cases: zero/negative mile returns departure, clamped above total distance."""
    departure = datetime(2026, 11, 2, 8, 0, 0, tzinfo=UTC)
    assert (
        calculate_checkpoint_eta(
            departure, target_mile=-5.0, total_distance_miles=100.0, total_duration_minutes=60.0
        )
        == departure
    )
    eta_clamped = calculate_checkpoint_eta(
        departure, target_mile=150.0, total_distance_miles=100.0, total_duration_minutes=60.0
    )
    assert eta_clamped == datetime(2026, 11, 2, 9, 0, 0, tzinfo=UTC)
    assert (
        calculate_checkpoint_eta(
            departure, target_mile=10.0, total_distance_miles=0.0, total_duration_minutes=60.0
        )
        == departure
    )


def test_nearest_forecast_hour():
    """Rounds to nearest top of the hour."""
    t1 = datetime(2026, 11, 2, 8, 29, 59, tzinfo=UTC)
    assert get_nearest_forecast_hour(t1) == datetime(2026, 11, 2, 8, 0, 0, tzinfo=UTC)

    t2 = datetime(2026, 11, 2, 8, 30, 0, tzinfo=UTC)
    assert get_nearest_forecast_hour(t2) == datetime(2026, 11, 2, 9, 0, 0, tzinfo=UTC)

    t3 = datetime(2026, 11, 2, 8, 59, 0, tzinfo=UTC)
    assert get_nearest_forecast_hour(t3) == datetime(2026, 11, 2, 9, 0, 0, tzinfo=UTC)


def test_forecast_hour_offset():
    """Offset in hours calculated and clamped to [0, 48]."""
    dep = datetime(2026, 11, 2, 8, 0, 0, tzinfo=UTC)
    eta1 = datetime(2026, 11, 2, 10, 45, 0, tzinfo=UTC)
    assert get_forecast_hour_offset(dep, eta1, max_hours=48) == 3

    eta_past = datetime(2026, 11, 2, 7, 0, 0, tzinfo=UTC)
    assert get_forecast_hour_offset(dep, eta_past, max_hours=48) == 0

    eta_far = datetime(2026, 11, 5, 8, 0, 0, tzinfo=UTC)
    assert get_forecast_hour_offset(dep, eta_far, max_hours=48) == 48
