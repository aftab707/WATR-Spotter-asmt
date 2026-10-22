"""Generate realistic plan.json mock fixture for frontend mock mode.

Simulates Chicago, IL to Denver, CO with 42,000 lb load and 25-mile checkpoint sampling.
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from planner.serializers import PlanTripResponseSerializer
from planner.services.orchestrator import plan_trip
from planner.services.routing import RouteCandidate, RoutingResult
from planner.services.weather import HourlyWeather, LocationWeather


def generate_plan_fixture():
    fixtures_dir = Path("frontend/src/api/fixtures")
    fixtures_dir.mkdir(parents=True, exist_ok=True)

    def make_route(rid, label, dist, dur, waypoints):
        coords = []
        for i in range(len(waypoints) - 1):
            p1, p2 = waypoints[i], waypoints[i + 1]
            for step in range(15):
                frac = step / 15.0
                lat = p1[0] + frac * (p2[0] - p1[0])
                lon = p1[1] + frac * (p2[1] - p1[1])
                coords.append([round(lon, 4), round(lat, 4)])
        coords.append([round(waypoints[-1][1], 4), round(waypoints[-1][0], 4)])
        return RouteCandidate(
            id=rid,
            label=label,
            distance_miles=dist,
            duration_minutes=dur,
            geometry_coords=coords,
        )

    chicago = (41.8781, -87.6298)
    denver = (39.7392, -104.9903)

    r1 = make_route(
        "r1",
        "Route A (I-80 W)",
        1003.4,
        905.0,
        [chicago, (41.5868, -93.6250), (40.8136, -96.7026), (41.1400, -100.7601), denver],
    )
    r2 = make_route(
        "r2",
        "Route B (I-74 W / I-70 W)",
        1028.5,
        930.0,
        [chicago, (40.4842, -88.9937), (39.7817, -89.6501), (39.0997, -94.5786), denver],
    )
    r3 = make_route(
        "r3",
        "Route C (I-88 W / US-34 W)",
        1060.0,
        975.0,
        [chicago, (41.5236, -90.5776), (41.0084, -94.3644), (40.1250, -101.5000), denver],
    )

    class MockRoutingService:
        def get_routes(self, origin, destination):
            return RoutingResult(routes=[r1, r2, r3], warnings=[])

    class MockWeatherService:
        def get_corridor_weather(self, coords, date_window=None):
            results = []
            base_time = datetime(2026, 11, 2, 8, 0, tzinfo=UTC)
            for lat, lon in coords:
                hourly = {}
                # Route A passes through Nebraska with 40 mph wind (elevated to Severe for 42k lb load)
                is_wind_corridor = 40.5 <= lat <= 41.5 and -101.0 <= lon <= -96.0
                for h in range(72):
                    t = base_time + timedelta(hours=h)
                    iso = t.strftime("%Y-%m-%dT%H:00")
                    wind = 40.0 if (is_wind_corridor and 4 <= h <= 18) else 18.0
                    rain = 0.15 if (-94.0 <= lon <= -92.0 and 2 <= h <= 6) else 0.0
                    hourly[iso] = HourlyWeather(
                        time_iso=iso,
                        wind_mph=wind,
                        rain_in_hr=rain,
                        snow_in_hr=0.0,
                    )
                results.append(LocationWeather(lat=lat, lon=lon, hourly=hourly))
            return results

    dept = datetime(2026, 11, 2, 8, 0, tzinfo=UTC)
    req = {
        "origin": {"label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298},
        "destination": {"label": "Denver, CO", "lat": 39.7392, "lon": -104.9903},
        "departure_time": dept,
        "load_weight_lb": 42000,
        "sampling_interval_miles": 25,
    }

    plan = plan_trip(req, routing_service=MockRoutingService(), weather_service=MockWeatherService())

    # Validate against DRF serializer
    ser = PlanTripResponseSerializer(data=plan)
    assert ser.is_valid(), f"Plan serializer errors: {ser.errors}"

    out_path = fixtures_dir / "plan.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2)

    print(f"Successfully wrote realistic plan fixture to {out_path} ({out_path.stat().st_size} bytes)")
    print(f"Recommended route: {plan['recommended_route_id']}")
    for r in plan["routes"]:
        print(f"  {r['id']}: {r['label']} - Rank {r['rank']} - {r['recommendation_reason']}")


if __name__ == "__main__":
    import os

    import django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()
    generate_plan_fixture()
