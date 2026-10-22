"""Unit tests for pure route recommendation and ranking engine."""

from planner.logic.recommend import (
    RouteRecommendationInput,
    rank_and_recommend_routes,
)
from planner.logic.summary import RouteSummary


def make_dummy_summary(
    no_travel_miles: float = 0.0,
    severe_miles: float = 0.0,
    high_miles: float = 0.0,
    moderate_miles: float = 0.0,
    low_miles: float = 0.0,
    avg_risk: float = 1.0,
    max_risk: int = 1,
) -> RouteSummary:
    """Helper to build RouteSummary instances for ranking tests."""
    return RouteSummary(
        no_travel_miles=no_travel_miles,
        severe_miles=severe_miles,
        high_miles=high_miles,
        moderate_miles=moderate_miles,
        low_miles=low_miles,
        avg_risk=avg_risk,
        max_risk=max_risk,
        max_risk_label="LOW",
    )


def test_severe_breaks_time_slower_route_wins():
    """Acceptance check: a route wins on Severe miles even if it is slower.

    Route A: 900 min, 40.0 Severe miles (Fastest)
    Route B: 925 min, 0.0 Severe miles (+25 min vs fastest, but zero severe)
    """
    route_a = RouteRecommendationInput(
        id="r1",
        label="Route A",
        distance_miles=1000.0,
        duration_minutes=900.0,
        summary=make_dummy_summary(severe_miles=40.0, high_miles=20.0, avg_risk=2.8),
    )
    route_b = RouteRecommendationInput(
        id="r2",
        label="Route B",
        distance_miles=1020.0,
        duration_minutes=925.0,
        summary=make_dummy_summary(severe_miles=0.0, high_miles=20.0, avg_risk=1.9),
    )

    result = rank_and_recommend_routes([route_a, route_b])

    assert result.recommended_route_id == "r2"
    assert result.routes[0].id == "r2"
    assert result.routes[0].rank == 1
    assert result.routes[0].is_recommended is True
    assert "+25 min vs fastest" in result.routes[0].recommendation_reason
    assert "40.0 fewer Severe miles" in result.routes[0].recommendation_reason

    assert result.routes[1].id == "r1"
    assert result.routes[1].rank == 2
    assert result.routes[1].is_recommended is False
    assert "adds 40.0 Severe miles" in result.routes[1].recommendation_reason


def test_high_breaks_severe_ties():
    """Acceptance check: High miles break ties when Severe miles are equal."""
    route_a = RouteRecommendationInput(
        id="r1",
        label="Route A",
        distance_miles=500.0,
        duration_minutes=500.0,
        summary=make_dummy_summary(severe_miles=10.0, high_miles=50.0, avg_risk=2.5),
    )
    route_b = RouteRecommendationInput(
        id="r2",
        label="Route B",
        distance_miles=510.0,
        duration_minutes=515.0,
        summary=make_dummy_summary(severe_miles=10.0, high_miles=10.0, avg_risk=2.0),
    )

    result = rank_and_recommend_routes([route_a, route_b])

    assert result.recommended_route_id == "r2"
    assert result.routes[0].id == "r2"
    assert result.routes[0].rank == 1
    assert "40.0 fewer High miles" in result.routes[0].recommendation_reason


def test_avg_risk_breaks_high_ties():
    """Acceptance check: distance-weighted average risk breaks ties when High miles are equal."""
    route_a = RouteRecommendationInput(
        id="r1",
        label="Route A",
        distance_miles=300.0,
        duration_minutes=300.0,
        summary=make_dummy_summary(severe_miles=0.0, high_miles=10.0, avg_risk=2.45),
    )
    route_b = RouteRecommendationInput(
        id="r2",
        label="Route B",
        distance_miles=305.0,
        duration_minutes=310.0,
        summary=make_dummy_summary(severe_miles=0.0, high_miles=10.0, avg_risk=1.85),
    )

    result = rank_and_recommend_routes([route_a, route_b])

    assert result.recommended_route_id == "r2"
    assert result.routes[0].id == "r2"
    assert "lower average risk" in result.routes[0].recommendation_reason


def test_time_breaks_all_risk_ties():
    """Acceptance check: travel duration breaks ties when all risk metrics are identical."""
    route_a = RouteRecommendationInput(
        id="r1",
        label="Route A",
        distance_miles=200.0,
        duration_minutes=220.0,
        summary=make_dummy_summary(severe_miles=0.0, high_miles=5.0, avg_risk=1.5),
    )
    route_b = RouteRecommendationInput(
        id="r2",
        label="Route B",
        distance_miles=205.0,
        duration_minutes=210.0,
        summary=make_dummy_summary(severe_miles=0.0, high_miles=5.0, avg_risk=1.5),
    )

    result = rank_and_recommend_routes([route_a, route_b])

    # Route B is 10 minutes faster, same risk -> Route B ranks #1
    assert result.recommended_route_id == "r2"
    assert result.routes[0].id == "r2"
    assert result.routes[0].rank == 1
    assert result.routes[1].id == "r1"
    assert result.routes[1].rank == 2


def test_fastest_route_is_safest():
    """When the fastest route also has the lowest risk, it is recommended with clear text."""
    route_a = RouteRecommendationInput(
        id="r1",
        label="Route A",
        distance_miles=100.0,
        duration_minutes=90.0,
        summary=make_dummy_summary(severe_miles=0.0, high_miles=0.0, avg_risk=1.1),
    )
    route_b = RouteRecommendationInput(
        id="r2",
        label="Route B",
        distance_miles=110.0,
        duration_minutes=110.0,
        summary=make_dummy_summary(severe_miles=5.0, high_miles=10.0, avg_risk=1.8),
    )

    result = rank_and_recommend_routes([route_a, route_b])

    assert result.recommended_route_id == "r1"
    assert result.routes[0].id == "r1"
    assert "Fastest route with minimal weather risk." in result.routes[0].recommendation_reason


def test_fastest_route_higher_avg_risk_explanation():
    """When fastest route has 0 severe and 0 high, but higher avg_risk, reason explains hazard."""
    route_fast = RouteRecommendationInput(
        id="r1",
        label="Route A",
        distance_miles=100.0,
        duration_minutes=90.0,
        summary=make_dummy_summary(severe_miles=0.0, high_miles=0.0, avg_risk=2.0),
    )
    route_safe = RouteRecommendationInput(
        id="r2",
        label="Route B",
        distance_miles=105.0,
        duration_minutes=95.0,
        summary=make_dummy_summary(severe_miles=0.0, high_miles=0.0, avg_risk=1.2),
    )

    result = rank_and_recommend_routes([route_fast, route_safe])
    assert result.recommended_route_id == "r2"
    assert "Fastest route, but has higher weather hazard exposure." in result.routes[1].recommendation_reason


def test_no_travel_route_never_recommended():
    """Acceptance check: route with no_travel_miles > 0 is flagged unrecommended."""
    route_fast_hazardous = RouteRecommendationInput(
        id="r1",
        label="Route A",
        distance_miles=400.0,
        duration_minutes=350.0,
        summary=make_dummy_summary(no_travel_miles=15.0, severe_miles=0.0),
    )
    route_safe_longer = RouteRecommendationInput(
        id="r2",
        label="Route B",
        distance_miles=450.0,
        duration_minutes=420.0,
        summary=make_dummy_summary(no_travel_miles=0.0, severe_miles=10.0),
    )

    result = rank_and_recommend_routes([route_fast_hazardous, route_safe_longer])

    # Route B is recommended because Route A has No Travel
    assert result.recommended_route_id == "r2"
    assert result.routes[0].id == "r2"
    assert result.routes[0].is_recommended is True

    # Route A is unrecommended with reason
    assert result.routes[1].id == "r1"
    assert result.routes[1].is_recommended is False
    assert "Not recommended" in result.routes[1].recommendation_reason
    assert "15.0 miles of No Travel" in result.routes[1].recommendation_reason


def test_all_no_travel_routes_warning_and_none_recommended():
    """Acceptance check: if ALL routes encounter No Travel, none are recommended and warning emitted."""
    route_a = RouteRecommendationInput(
        id="r1",
        label="Route A",
        distance_miles=500.0,
        duration_minutes=500.0,
        summary=make_dummy_summary(no_travel_miles=10.0),
    )
    route_b = RouteRecommendationInput(
        id="r2",
        label="Route B",
        distance_miles=520.0,
        duration_minutes=530.0,
        summary=make_dummy_summary(no_travel_miles=30.0),
    )

    result = rank_and_recommend_routes([route_a, route_b])

    assert result.recommended_route_id is None
    assert all(r.is_recommended is False for r in result.routes)
    assert len(result.warnings) == 1
    assert "All routes encounter No Travel weather hazards" in result.warnings[0]


def test_empty_routes_input():
    """Empty route list handled gracefully."""
    result = rank_and_recommend_routes([])
    assert result.recommended_route_id is None
    assert result.routes == []
    assert len(result.warnings) == 1


def test_fallback_alternative_route_reason():
    """Fallback reason returned when no route is recommended."""
    from planner.logic.recommend import generate_recommendation_reason

    route = RouteRecommendationInput("r1", "Route A", 100.0, 100.0, make_dummy_summary())
    reason = generate_recommendation_reason(route, is_recommended=False, fastest_route=route, recommended_route=None)
    assert reason == "Alternative route option."
