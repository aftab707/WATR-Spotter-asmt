"""Pure Route Summary and Segment Miles Allocation Engine.

Implements:
- Midpoint-based segment distance allocation per checkpoint:
    * First checkpoint covers [0, midpoint(m0, m1)]
    * Intermediate checkpoint i covers [midpoint(m_{i-1}, m_i), midpoint(m_i, m_{i+1})]
    * Final checkpoint covers [midpoint(m_{k-2}, m_{k-1}), total_route_distance]
    * Mathematically guaranteed: sum of all segment miles strictly equals total route distance.
- Aggregation of miles by risk tier: no_travel_miles, severe_miles, high_miles, moderate_miles, low_miles.
- Distance-weighted average risk score calculation (1.00 to 5.00).
- Peak corridor risk level identification.
"""

from collections.abc import Sequence
from dataclasses import dataclass

from planner.logic.risk import RiskLevel


@dataclass(frozen=True)
class CheckpointRiskInput:
    """Input representation of an evaluated checkpoint for summary computation."""

    mile: float
    risk_level: RiskLevel
    segment_miles: float | None = None


@dataclass(frozen=True)
class RouteSummary:
    """Aggregated route weather risk summary matching Section 5 API contract.

    Attributes:
        no_travel_miles: Total miles traversing NO_TRAVEL conditions (risk=5).
        severe_miles: Total miles traversing SEVERE conditions (risk=4).
        high_miles: Total miles traversing HIGH conditions (risk=3).
        moderate_miles: Total miles traversing MODERATE conditions (risk=2).
        low_miles: Total miles traversing LOW conditions (risk=1).
        avg_risk: Distance-weighted mean of risk scores (1.00 to 5.00).
        max_risk: Highest risk score encountered on the route (1 to 5).
        max_risk_label: Label for the highest risk score ('LOW', 'MODERATE', etc.).
    """

    no_travel_miles: float
    severe_miles: float
    high_miles: float
    moderate_miles: float
    low_miles: float
    avg_risk: float
    max_risk: int
    max_risk_label: str


def calculate_segment_miles(
    checkpoint_miles: Sequence[float],
    total_distance_miles: float,
) -> list[float]:
    """Calculate the segment distance represented by each checkpoint using midpoint Voronoi allocation.

    Rules:
    - First checkpoint (i=0): starts at 0, ends at midpoint with next checkpoint: (m0 + m1) / 2.
    - Intermediate checkpoint (0 < i < k-1): spans from midpoint with previous to midpoint with next:
      (m_{i+1} - m_{i-1}) / 2.
    - Last checkpoint (i = k-1): spans from midpoint with previous to route destination:
      total_distance_miles - (m_{k-2} + m_{k-1}) / 2.

    Mathematical guarantee:
        sum(segment_miles) == total_distance_miles.
    """
    k = len(checkpoint_miles)
    if k == 0:
        return []

    if k == 1:
        return [round(total_distance_miles, 4)]

    segments: list[float] = []

    # First checkpoint (i = 0)
    m0 = checkpoint_miles[0]
    m1 = checkpoint_miles[1]
    first_segment = (m0 + m1) / 2.0
    segments.append(first_segment)

    # Intermediate checkpoints (1 <= i <= k - 2)
    for i in range(1, k - 1):
        prev_m = checkpoint_miles[i - 1]
        next_m = checkpoint_miles[i + 1]
        seg = (next_m - prev_m) / 2.0
        segments.append(seg)

    # Last checkpoint (i = k - 1)
    prev_m = checkpoint_miles[k - 2]
    last_m = checkpoint_miles[k - 1]
    midpoint_prev = (prev_m + last_m) / 2.0
    last_segment = total_distance_miles - midpoint_prev
    segments.append(last_segment)

    return segments


def compute_route_summary(
    checkpoints: Sequence[CheckpointRiskInput],
    total_distance_miles: float,
) -> RouteSummary:
    """Aggregate per-checkpoint risk levels into route-level summary metrics.

    Calculates:
    - Miles per risk tier (No Travel, Severe, High, Moderate, Low).
    - Distance-weighted average risk score.
    - Maximum risk level encountered.
    """
    if not checkpoints:
        return RouteSummary(
            no_travel_miles=0.0,
            severe_miles=0.0,
            high_miles=0.0,
            moderate_miles=0.0,
            low_miles=0.0,
            avg_risk=1.0,
            max_risk=1,
            max_risk_label=RiskLevel.LOW.name,
        )

    # Ensure segment miles are assigned
    has_segments = all(cp.segment_miles is not None for cp in checkpoints)
    if not has_segments:
        miles_list = [cp.mile for cp in checkpoints]
        calculated_segments = calculate_segment_miles(miles_list, total_distance_miles)
    else:
        calculated_segments = [cp.segment_miles for cp in checkpoints]  # type: ignore

    no_travel_miles = 0.0
    severe_miles = 0.0
    high_miles = 0.0
    moderate_miles = 0.0
    low_miles = 0.0
    weighted_risk_sum = 0.0
    max_risk = RiskLevel.LOW

    for cp, seg_dist in zip(checkpoints, calculated_segments, strict=False):
        seg = max(0.0, seg_dist)
        risk = cp.risk_level
        weighted_risk_sum += seg * int(risk)

        if risk > max_risk:
            max_risk = risk

        if risk == RiskLevel.NO_TRAVEL:
            no_travel_miles += seg
        elif risk == RiskLevel.SEVERE:
            severe_miles += seg
        elif risk == RiskLevel.HIGH:
            high_miles += seg
        elif risk == RiskLevel.MODERATE:
            moderate_miles += seg
        elif risk == RiskLevel.LOW:
            low_miles += seg

    total_valid_dist = sum(calculated_segments)
    if total_valid_dist > 0.0:
        avg_risk = weighted_risk_sum / total_valid_dist
    else:
        avg_risk = float(max_risk)

    return RouteSummary(
        no_travel_miles=round(no_travel_miles, 1),
        severe_miles=round(severe_miles, 1),
        high_miles=round(high_miles, 1),
        moderate_miles=round(moderate_miles, 1),
        low_miles=round(low_miles, 1),
        avg_risk=round(avg_risk, 2),
        max_risk=int(max_risk),
        max_risk_label=max_risk.name,
    )
