"""Trip Planning Orchestrator Service.

Glues routing, geometry sampling, monotonic ETA interpolation, batch weather retrieval,
checkpoint risk scoring with load weight rules, route summaries, recommendation ranking,
and the 0-48h forecast heatmap matrix into the unified Section 5 API contract.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from planner.logic.eta import calculate_etas_for_checkpoints
from planner.logic.geometry import (
    Point,
    sample_checkpoints,
    simplify_polyline,
)
from planner.logic.recommend import (
    RouteRecommendationInput,
    rank_and_recommend_routes,
)
from planner.logic.risk import (
    classify_checkpoint,
)
from planner.logic.summary import (
    CheckpointRiskInput,
    calculate_segment_miles,
    compute_route_summary,
)
from planner.services.routing import RouteCandidate, RoutingService
from planner.services.weather import (
    HourlyWeather,
    LocationWeather,
    UpstreamError,
    WeatherService,
)

logger = logging.getLogger(__name__)

# Maximum points allowed in simplified display geometry
MAX_DISPLAY_GEOMETRY_POINTS = 2000
HEATMAP_HOURS_COUNT = 49  # Hours 0 to 48 inclusive


def plan_trip(
    request_data: dict[str, Any],
    routing_service: RoutingService | None = None,
    weather_service: WeatherService | None = None,
) -> dict[str, Any]:
    """Execute end-to-end trip planning workflow.

    Workflow per Section 4 & 5 of PROJECT_SPEC.md:
    1. Query routing provider for <= 3 distinct route candidates.
    2. Simplify polyline geometries (<= 2000 pts) for display.
    3. Sample corridor checkpoints at sampling_interval_miles (10, 25, or 50 mi).
    4. Compute monotonic ETAs and midpoint segment miles per checkpoint.
    5. Deduplicate corridor checkpoint locations and execute a single batch weather fetch.
    6. Evaluate checkpoint risks applying gross cargo weight hazard rules.
    7. Aggregate route summaries (miles by risk tier, weighted avg risk).
    8. Rank candidates using 5-tier sort key and generate comparative reasons.
    9. Construct the 0-48h forecast heatmap series for all corridor coordinates.
    10. Return Section 5 JSON shape.
    """
    origin = request_data["origin"]
    destination = request_data["destination"]
    departure_time: datetime = request_data["departure_time"]
    if departure_time.tzinfo is None:
        departure_time = departure_time.replace(tzinfo=UTC)
    else:
        departure_time = departure_time.astimezone(UTC)

    load_weight_lb: int = int(request_data["load_weight_lb"])
    sampling_interval_miles: int = int(request_data.get("sampling_interval_miles", 25))

    # 1. Fetch routes
    router = routing_service or RoutingService()
    origin_coords = (float(origin["lat"]), float(origin["lon"]))
    dest_coords = (float(destination["lat"]), float(destination["lon"]))

    routing_result = router.get_routes(origin=origin_coords, destination=dest_coords)
    route_candidates: list[RouteCandidate] = routing_result.routes
    warnings: list[str] = list(routing_result.warnings)

    if not route_candidates:
        raise UpstreamError("No routes found between origin and destination.")

    # Emit warning if fewer than 3 distinct alternatives returned
    if len(route_candidates) < 3 and not any("fewer" in w.lower() or "only" in w.lower() for w in warnings):
        warnings.append(
            f"Only {len(route_candidates)} distinct route(s) found between origin and destination."
        )

    # 2. Geometry processing, checkpoint sampling, and ETA calculation
    route_points_map: dict[str, list[Point]] = {}
    simplified_geometry_map: dict[str, dict[str, Any]] = {}
    sampled_checkpoints_map: dict[str, list[Any]] = {}
    etas_map: dict[str, list[datetime]] = {}
    segments_map: dict[str, list[float]] = {}

    for route in route_candidates:
        pts = [Point.from_geojson_coord(c) for c in route.geometry_coords]
        route_points_map[route.id] = pts

        # Polyline simplification for lightweight UI rendering
        simplified_pts = simplify_polyline(pts, max_points=MAX_DISPLAY_GEOMETRY_POINTS)
        simplified_geometry_map[route.id] = {
            "type": "LineString",
            "coordinates": [p.to_geojson_coord() for p in simplified_pts],
        }

        # Checkpoint sampling
        checkpoints = sample_checkpoints(
            points=pts,
            interval_miles=sampling_interval_miles,
            provider_total_miles=route.distance_miles,
        )
        sampled_checkpoints_map[route.id] = checkpoints

        # ETAs
        checkpoint_miles = [cp.mile for cp in checkpoints]
        etas = calculate_etas_for_checkpoints(
            departure_time=departure_time,
            checkpoint_miles=checkpoint_miles,
            total_distance_miles=route.distance_miles,
            total_duration_minutes=route.duration_minutes,
            distance_duration_profile=route.duration_profile,
        )
        etas_map[route.id] = etas

        # Segment miles allocation (guaranteed sum == route.distance_miles)
        segments = calculate_segment_miles(
            checkpoint_miles=checkpoint_miles,
            total_distance_miles=route.distance_miles,
        )
        segments_map[route.id] = segments

        # Horizon warnings
        if route.duration_minutes > 48 * 60:
            warn = (
                f"{route.label} duration ({route.duration_minutes / 60:.1f}h) "
                f"extends beyond the 48-hour heatmap window."
            )
            if warn not in warnings:
                warnings.append(warn)

        arrival_time = departure_time + timedelta(minutes=route.duration_minutes)
        if arrival_time > departure_time + timedelta(days=7):
            warn = (
                f"{route.label} arrives beyond the 7-day forecast horizon; "
                f"weather for late segments uses nearest available forecast."
            )
            if warn not in warnings:
                warnings.append(warn)

    # 3. Deduplicate unique corridor coordinates for a single batch weather fetch
    unique_coords_dict: dict[tuple[float, float], tuple[float, float]] = {}
    coord_routes_map: dict[tuple[float, float], set[str]] = {}

    for route in route_candidates:
        for cp in sampled_checkpoints_map[route.id]:
            # Key by 2 decimals to match spatial cache resolution
            key = (round(cp.point.lat, 2), round(cp.point.lon, 2))
            if key not in unique_coords_dict:
                unique_coords_dict[key] = (cp.point.lat, cp.point.lon)
            if key not in coord_routes_map:
                coord_routes_map[key] = set()
            coord_routes_map[key].add(route.id)

    unique_query_coords = list(unique_coords_dict.values())

    weather = weather_service or WeatherService()
    weather_locations = weather.get_corridor_weather(unique_query_coords)

    # Build weather lookup table by rounded coordinate key
    weather_lookup: dict[tuple[float, float], LocationWeather] = {
        (round(loc.lat, 2), round(loc.lon, 2)): loc for loc in weather_locations
    }

    # 4. Evaluate checkpoint risk and aggregate route summaries
    evaluated_checkpoints_map: dict[str, list[dict[str, Any]]] = {}
    recommendation_inputs: list[RouteRecommendationInput] = []

    for route in route_candidates:
        checkpoints = sampled_checkpoints_map[route.id]
        etas = etas_map[route.id]
        segments = segments_map[route.id]

        route_eval_cps: list[dict[str, Any]] = []
        route_risk_inputs: list[CheckpointRiskInput] = []

        for cp, eta, seg_dist in zip(checkpoints, etas, segments, strict=False):
            key = (round(cp.point.lat, 2), round(cp.point.lon, 2))
            loc_weather = weather_lookup.get(key)
            if loc_weather:
                hw = loc_weather.value_at(eta)
            else:
                hw = HourlyWeather(
                    time_iso=eta.strftime("%Y-%m-%dT%H:00"),
                    wind_mph=0.0,
                    rain_in_hr=0.0,
                    snow_in_hr=0.0,
                )

            risk_result = classify_checkpoint(
                wind_mph=hw.wind_mph,
                rain_in_hr=hw.rain_in_hr,
                snow_in_hr=hw.snow_in_hr,
                load_lb=load_weight_lb,
            )

            route_eval_cps.append(
                {
                    "index": cp.index,
                    "mile": round(cp.mile, 1),
                    "lat": round(cp.point.lat, 2),
                    "lon": round(cp.point.lon, 2),
                    "eta": eta.isoformat(),
                    "risk": int(risk_result.level),
                    "risk_label": risk_result.level.name,
                    "wind_mph": round(hw.wind_mph, 1),
                    "rain_in_hr": round(hw.rain_in_hr, 2),
                    "snow_in_hr": round(hw.snow_in_hr, 2),
                    "drivers": risk_result.drivers,
                    "load_rule_applied": risk_result.load_rule_applied,
                    "segment_miles": round(seg_dist, 1),
                }
            )

            route_risk_inputs.append(
                CheckpointRiskInput(
                    mile=cp.mile,
                    risk_level=risk_result.level,
                    segment_miles=seg_dist,
                )
            )

        evaluated_checkpoints_map[route.id] = route_eval_cps

        summary = compute_route_summary(route_risk_inputs, route.distance_miles)
        recommendation_inputs.append(
            RouteRecommendationInput(
                id=route.id,
                label=route.label,
                distance_miles=route.distance_miles,
                duration_minutes=route.duration_minutes,
                summary=summary,
            )
        )

    # 5. Recommendation ranking
    rec_result = rank_and_recommend_routes(recommendation_inputs)
    for rec_warn in rec_result.warnings:
        if rec_warn not in warnings:
            warnings.append(rec_warn)

    ranked_by_id = {r.id: r for r in rec_result.routes}

    # 6. Assemble final route options preserving initial candidate order
    assembled_routes: list[dict[str, Any]] = []
    for route in route_candidates:
        ranked = ranked_by_id[route.id]
        arrival_time = (departure_time + timedelta(minutes=route.duration_minutes)).isoformat()

        assembled_routes.append(
            {
                "id": route.id,
                "label": route.label,
                "rank": ranked.rank,
                "is_recommended": ranked.is_recommended,
                "distance_miles": round(route.distance_miles, 1),
                "duration_minutes": round(route.duration_minutes, 1),
                "arrival_time": arrival_time,
                "geometry": simplified_geometry_map[route.id],
                "summary": {
                    "no_travel_miles": ranked.summary.no_travel_miles,
                    "severe_miles": ranked.summary.severe_miles,
                    "high_miles": ranked.summary.high_miles,
                    "moderate_miles": ranked.summary.moderate_miles,
                    "low_miles": ranked.summary.low_miles,
                    "avg_risk": ranked.summary.avg_risk,
                    "max_risk": ranked.summary.max_risk,
                    "max_risk_label": ranked.summary.max_risk_label,
                },
                "recommendation_reason": ranked.recommendation_reason,
                "checkpoints": evaluated_checkpoints_map[route.id],
            }
        )

    # 7. Construct 0-48h forecast heatmap series
    heatmap_points: list[dict[str, Any]] = []
    for coord_key, r_ids in coord_routes_map.items():
        loc_weather = weather_lookup.get(coord_key)
        risk_series: list[int] = []

        for h in range(HEATMAP_HOURS_COUNT):
            target_hour = departure_time + timedelta(hours=h)
            if loc_weather:
                hw = loc_weather.value_at(target_hour)
                risk_res = classify_checkpoint(
                    wind_mph=hw.wind_mph,
                    rain_in_hr=hw.rain_in_hr,
                    snow_in_hr=hw.snow_in_hr,
                    load_lb=load_weight_lb,
                )
                risk_series.append(int(risk_res.level))
            else:
                risk_series.append(1)

        heatmap_points.append(
            {
                "lat": coord_key[0],
                "lon": coord_key[1],
                "route_ids": sorted(r_ids),
                "risk": risk_series,
            }
        )

    # 8. Build Section 5 Response Payload
    return {
        "meta": {
            "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "departure_time": departure_time.isoformat(),
            "load_weight_lb": load_weight_lb,
            "sampling_interval_miles": sampling_interval_miles,
            "weather_source": "open-meteo",
            "warnings": warnings,
        },
        "recommended_route_id": rec_result.recommended_route_id,
        "routes": assembled_routes,
        "heatmap": {
            "hours": list(range(HEATMAP_HOURS_COUNT)),
            "points": heatmap_points,
        },
    }
