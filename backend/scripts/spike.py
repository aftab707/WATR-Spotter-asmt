"""API Spike Script — Step 1.

Proves providers before building on them:
1. Routing: OSRM (and Mapbox if token set) on Chicago -> Denver (long) and Chicago -> Milwaukee (short).
2. Geocoding: Photon (komoot) and Nominatim (with custom User-Agent).
3. Weather: Open-Meteo batch (5 points) with hourly wind_speed_10m, rain, showers, snowfall.

Saves raw fixture JSONs into backend/planner/tests/fixtures/.
"""

import json
import os
import time
from pathlib import Path

import requests

# Set up paths
BASE_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = BASE_DIR / "planner" / "tests" / "fixtures"
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

# Coordinates
CHICAGO = {"lat": 41.8781, "lon": -87.6298, "name": "Chicago, IL"}
DENVER = {"lat": 39.7392, "lon": -104.9903, "name": "Denver, CO"}
MILWAUKEE = {"lat": 43.0389, "lon": -87.9065, "name": "Milwaukee, WI"}

# 5 points along the Chicago -> Denver corridor
CORRIDOR_5_POINTS = [
    {"lat": 41.8781, "lon": -87.6298, "name": "Chicago, IL"},
    {"lat": 41.5236, "lon": -90.5776, "name": "Davenport, IA"},
    {"lat": 41.2565, "lon": -95.9345, "name": "Omaha, NE"},
    {"lat": 40.8258, "lon": -99.0820, "name": "Kearney, NE"},
    {"lat": 39.7392, "lon": -104.9903, "name": "Denver, CO"},
]


def test_osrm_routing(origin, destination, label):
    """Test OSRM public routing API."""
    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{origin['lon']},{origin['lat']};{destination['lon']},{destination['lat']}"
        f"?overview=full&geometries=geojson&alternatives=true"
    )
    headers = {"User-Agent": "WATR-Truck-Router-Spike/1.0"}
    start = time.perf_counter()
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        duration_ms = (time.perf_counter() - start) * 1000
        resp.raise_for_status()
        data = resp.json()
        routes = data.get("routes", [])
        print(f"[OSRM] {label}:")
        print(f"  - Status Code: {resp.status_code}")
        print(f"  - Latency: {duration_ms:.1f} ms")
        print(f"  - Routes Returned: {len(routes)}")
        for idx, r in enumerate(routes):
            dist_mi = r.get("distance", 0) / 1609.344
            dur_min = r.get("duration", 0) / 60
            coords_count = len(r.get("geometry", {}).get("coordinates", []))
            print(f"    * Route #{idx + 1}: {dist_mi:.1f} mi, {dur_min:.0f} min, {coords_count} geometry points")

        fixture_path = FIXTURES_DIR / f"osrm_{label.lower().replace(' ', '_')}.json"
        with open(fixture_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"  - Saved fixture to: {fixture_path.name}")
        return data
    except Exception as exc:
        print(f"[OSRM] {label} FAILED: {exc}")
        return None


def test_mapbox_routing(origin, destination, label, token):
    """Test Mapbox Directions API if token provided."""
    if not token:
        print(f"[Mapbox] {label}: Skipped (MAPBOX_ACCESS_TOKEN not set)")
        return None
    url = (
        f"https://api.mapbox.com/directions/v5/mapbox/driving/"
        f"{origin['lon']},{origin['lat']};{destination['lon']},{destination['lat']}"
        f"?alternatives=true&geometries=geojson&overview=full&access_token={token}"
    )
    start = time.perf_counter()
    try:
        resp = requests.get(url, timeout=15)
        duration_ms = (time.perf_counter() - start) * 1000
        resp.raise_for_status()
        data = resp.json()
        routes = data.get("routes", [])
        print(f"[Mapbox] {label}:")
        print(f"  - Latency: {duration_ms:.1f} ms")
        print(f"  - Routes Returned: {len(routes)}")
        fixture_path = FIXTURES_DIR / f"mapbox_{label.lower().replace(' ', '_')}.json"
        with open(fixture_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"  - Saved fixture to: {fixture_path.name}")
        return data
    except Exception as exc:
        print(f"[Mapbox] {label} FAILED: {exc}")
        return None


def test_photon_geocoding(query):
    """Test Komoot Photon geocoding API."""
    url = f"https://photon.komoot.io/api/?q={query}&limit=6"
    headers = {"User-Agent": "WATR-Truck-Router-Spike/1.0"}
    start = time.perf_counter()
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        duration_ms = (time.perf_counter() - start) * 1000
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        print(f"[Photon] Geocode '{query}':")
        print(f"  - Latency: {duration_ms:.1f} ms")
        print(f"  - Results: {len(features)}")
        for idx, f in enumerate(features[:3]):
            props = f.get("properties", {})
            coords = f.get("geometry", {}).get("coordinates", [])
            label = ", ".join(
                str(v)
                for v in [props.get("name"), props.get("state"), props.get("country")]
                if v
            )
            print(f"    * Result #{idx + 1}: {label} ({coords[1]}, {coords[0]})")

        fixture_path = FIXTURES_DIR / f"photon_geocode_{query.lower().replace(' ', '_')}.json"
        with open(fixture_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"  - Saved fixture to: {fixture_path.name}")
        return data
    except Exception as exc:
        print(f"[Photon] Geocode '{query}' FAILED: {exc}")
        return None


def test_nominatim_geocoding(query):
    """Test Nominatim OSM geocoding API."""
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=6&countrycodes=us"
    headers = {"User-Agent": "WATR-Truck-Router-Spike/1.0 (contact: aftabali.deve@gmail.com)"}
    start = time.perf_counter()
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        duration_ms = (time.perf_counter() - start) * 1000
        resp.raise_for_status()
        data = resp.json()
        print(f"[Nominatim] Geocode '{query}':")
        print(f"  - Latency: {duration_ms:.1f} ms")
        print(f"  - Results: {len(data)}")
        for idx, item in enumerate(data[:3]):
            print(f"    * Result #{idx + 1}: {item.get('display_name')} (lat: {item.get('lat')}, lon: {item.get('lon')})")

        fixture_path = FIXTURES_DIR / f"nominatim_geocode_{query.lower().replace(' ', '_')}.json"
        with open(fixture_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"  - Saved fixture to: {fixture_path.name}")
        return data
    except Exception as exc:
        print(f"[Nominatim] Geocode '{query}' FAILED: {exc}")
        return None


def test_open_meteo_batch(points):
    """Test Open-Meteo batch weather forecast."""
    lats = ",".join(str(p["lat"]) for p in points)
    lons = ",".join(str(p["lon"]) for p in points)
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lats}&longitude={lons}"
        f"&hourly=wind_speed_10m,rain,showers,snowfall"
        f"&wind_speed_unit=mph&precipitation_unit=inch&timezone=UTC"
    )
    start = time.perf_counter()
    try:
        resp = requests.get(url, timeout=15)
        duration_ms = (time.perf_counter() - start) * 1000
        resp.raise_for_status()
        data = resp.json()
        print(f"[Open-Meteo] Batch Forecast ({len(points)} locations):")
        print(f"  - Latency: {duration_ms:.1f} ms")
        is_list = isinstance(data, list)
        items_count = len(data) if is_list else 1
        print(f"  - Response type: {'List of ' + str(items_count) + ' items' if is_list else 'Single object'}")

        first_item = data[0] if is_list else data
        hourly = first_item.get("hourly", {})
        hourly_units = first_item.get("hourly_units", {})
        print("  - Weather units returned:")
        for field, unit in hourly_units.items():
            print(f"    * {field}: {unit}")

        hours_count = len(hourly.get("time", []))
        print(f"  - Forecast hours per point: {hours_count} hours (e.g. 7 days = 168 hours)")
        if hours_count > 0:
            sample_time = hourly.get("time", [])[0]
            sample_wind = hourly.get("wind_speed_10m", [])[0]
            sample_rain = hourly.get("rain", [])[0]
            sample_showers = hourly.get("showers", [])[0]
            sample_snow = hourly.get("snowfall", [])[0]
            print(f"  - Sample first hour ({sample_time}): wind={sample_wind} mph, rain={sample_rain} in, showers={sample_showers} in, snow={sample_snow} in")

        fixture_path = FIXTURES_DIR / "open_meteo_batch_5pts.json"
        with open(fixture_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"  - Saved fixture to: {fixture_path.name}")
        return data
    except Exception as exc:
        print(f"[Open-Meteo] Batch Forecast FAILED: {exc}")
        return None


def main():
    print("=" * 60)
    print("STEP 1: API SPIKE EXECUTION")
    print("=" * 60)

    # 1. Routing
    print("\n--- 1. ROUTING SPIKE ---")
    test_osrm_routing(CHICAGO, DENVER, "Chicago to Denver")
    test_osrm_routing(CHICAGO, MILWAUKEE, "Chicago to Milwaukee")
    mapbox_token = os.environ.get("MAPBOX_ACCESS_TOKEN", "").strip()
    test_mapbox_routing(CHICAGO, DENVER, "Chicago to Denver", mapbox_token)

    # 2. Geocoding
    print("\n--- 2. GEOCODING SPIKE ---")
    test_photon_geocoding("Chicago")
    test_nominatim_geocoding("Chicago")

    # 3. Weather
    print("\n--- 3. WEATHER SPIKE (OPEN-METEO BATCH) ---")
    test_open_meteo_batch(CORRIDOR_5_POINTS)

    print("\n" + "=" * 60)
    print("SPIKE COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
