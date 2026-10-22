"""Pure ETA and Time Interpolation Engine for Weather-Aware Truck Routing.

Implements:
- Monotonic ETA interpolation at distance milestones.
- Piecewise linear interpolation over route duration profile with constant average speed fallback.
- Nearest forecast hour resolution for checkpoint weather matching.
"""

from collections.abc import Sequence
from datetime import datetime, timedelta


def calculate_checkpoint_eta(
    departure_time: datetime,
    target_mile: float,
    total_distance_miles: float,
    total_duration_minutes: float,
    distance_duration_profile: Sequence[tuple[float, float]] | None = None,
) -> datetime:
    """Calculate the estimated time of arrival (ETA) at a given distance milestone.

    Uses piecewise linear interpolation when a distance-duration profile is provided
    (from routing engine steps/legs); otherwise falls back to a constant average speed
    profile across the total route.

    Guarantees:
    - Monotonicity: ETA strictly non-decreasing with target_mile.
    - Clamped target: target_mile < 0 treated as 0; target_mile > total clamped to total.

    Args:
        departure_time: Trip departure datetime (timezone-aware recommended).
        target_mile: Distance in miles from start to evaluate.
        total_distance_miles: Overall route distance in miles.
        total_duration_minutes: Overall travel duration in minutes.
        distance_duration_profile: Optional sequence of (cumulative_miles, cumulative_minutes).

    Returns:
        Datetime of expected checkpoint arrival.
    """
    if total_distance_miles <= 0.0 or total_duration_minutes <= 0.0 or target_mile <= 0.0:
        return departure_time

    clamped_mile = min(target_mile, total_distance_miles)

    elapsed_minutes: float
    if distance_duration_profile and len(distance_duration_profile) >= 2:
        # Piecewise linear interpolation across profile segments
        profile = list(distance_duration_profile)
        # Ensure profile covers the query point
        if clamped_mile <= profile[0][0]:
            elapsed_minutes = profile[0][1]
        elif clamped_mile >= profile[-1][0]:
            elapsed_minutes = profile[-1][1]
        else:
            elapsed_minutes = 0.0
            for i in range(len(profile) - 1):
                d0, t0 = profile[i]
                d1, t1 = profile[i + 1]
                if d0 <= clamped_mile <= d1:
                    span = d1 - d0
                    fraction = (clamped_mile - d0) / span if span > 0 else 0.0
                    elapsed_minutes = t0 + fraction * (t1 - t0)
                    break
    else:
        # Fallback: constant average speed across the total route
        fraction = clamped_mile / total_distance_miles
        elapsed_minutes = fraction * total_duration_minutes

    return departure_time + timedelta(minutes=elapsed_minutes)


def calculate_etas_for_checkpoints(
    departure_time: datetime,
    checkpoint_miles: Sequence[float],
    total_distance_miles: float,
    total_duration_minutes: float,
    distance_duration_profile: Sequence[tuple[float, float]] | None = None,
) -> list[datetime]:
    """Calculate monotonic ETAs for an ordered list of checkpoint miles.

    Guarantees that ETA[i] >= ETA[i-1] for all checkpoints.
    """
    etas: list[datetime] = []
    last_eta = departure_time

    for mile in checkpoint_miles:
        eta = calculate_checkpoint_eta(
            departure_time=departure_time,
            target_mile=mile,
            total_distance_miles=total_distance_miles,
            total_duration_minutes=total_duration_minutes,
            distance_duration_profile=distance_duration_profile,
        )
        # Enforce strict monotonicity against potential floating-point regression
        if eta < last_eta:
            eta = last_eta
        etas.append(eta)
        last_eta = eta

    return etas


def get_nearest_forecast_hour(eta: datetime) -> datetime:
    """Round a datetime to the nearest top-of-the-hour for forecast matching.

    Example:
        08:29:59 -> 08:00:00
        08:30:00 -> 09:00:00
    """
    # Truncate seconds and microseconds
    base = eta.replace(minute=0, second=0, microsecond=0)
    if eta.minute >= 30:
        return base + timedelta(hours=1)
    return base


def get_forecast_hour_offset(departure_time: datetime, eta: datetime, max_hours: int = 48) -> int:
    """Compute the zero-based hour index (0 to max_hours) after departure for an ETA.

    Used by the 0-48 hour heatmap series and checkpoint forecast lookups.
    """
    diff_seconds = (eta - departure_time).total_seconds()
    if diff_seconds <= 0:
        return 0
    hour_index = round(diff_seconds / 3600.0)
    return min(max(0, hour_index), max_hours)
