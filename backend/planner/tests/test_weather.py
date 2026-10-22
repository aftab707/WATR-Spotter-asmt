"""Unit tests for Open-Meteo weather service with requests-mock and saved fixtures."""

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from django.core.cache import cache
from requests_mock.mocker import Mocker

from planner.services.weather import (
    OPEN_METEO_BASE_URL,
    HourlyWeather,
    LocationWeather,
    UpstreamError,
    WeatherService,
    fetch_weather_chunk,
    make_weather_cache_key,
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True)
def clear_django_cache():
    """Clear Django test cache before each test."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def open_meteo_5pts_fixture():
    """Load saved Open-Meteo batch 5-points fixture from Step 1."""
    fixture_file = FIXTURES_DIR / "open_meteo_batch_5pts.json"
    with open(fixture_file, encoding="utf-8") as f:
        return json.load(f)


def test_unit_conversions_and_fixture_parsing(requests_mock: Mocker, open_meteo_5pts_fixture):
    """Acceptance check: parse saved fixture, verify unit calculations (rain + showers, snow, wind)."""
    requests_mock.get(OPEN_METEO_BASE_URL, json=open_meteo_5pts_fixture)

    coords = [
        (41.8781, -87.6298),  # Chicago
        (41.5236, -90.5776),  # Davenport
        (41.2565, -95.9345),  # Omaha
        (40.8258, -99.0820),  # Kearney
        (39.7392, -104.9903),  # Denver
    ]

    service = WeatherService(use_cache=False)
    results = service.get_corridor_weather(coords)

    assert len(results) == 5
    first_loc: LocationWeather = results[0]
    assert first_loc.lat == 41.8781
    assert first_loc.lon == -87.6298
    assert len(first_loc.hourly) == 168  # 7 days of hourly data

    # Verify value_at with known top-of-hour timestamp
    target_dt = datetime(2026, 10, 22, 0, 15, tzinfo=UTC)  # Rounds to 00:00
    weather_at_eta = first_loc.value_at(target_dt)
    assert isinstance(weather_at_eta, HourlyWeather)
    assert weather_at_eta.time_iso == "2026-10-22T00:00"
    assert weather_at_eta.wind_mph == 3.4
    assert weather_at_eta.rain_in_hr == 0.0
    assert weather_at_eta.snow_in_hr == 0.0

    # Test 49-hour heatmap series generation
    series_49 = first_loc.get_49h_series(datetime(2026, 10, 22, 0, 0, tzinfo=UTC))
    assert len(series_49) == 49
    assert series_49[0].time_iso == "2026-10-22T00:00"
    assert series_49[48].time_iso == "2026-10-24T00:00"


def test_chunking_large_coordinate_sets(requests_mock: Mocker, open_meteo_5pts_fixture):
    """Acceptance check: coordinates > chunk_size are split into parallel chunks of <= 50."""
    # Mock Open-Meteo endpoint returning a single-coordinate dummy item repeated
    single_dummy = open_meteo_5pts_fixture[0]

    def matcher(request, context):
        # Determine number of coordinates in query
        lats = request.qs.get("latitude", [""])[0].split(",")
        count = len(lats)
        return [single_dummy] * count

    requests_mock.get(OPEN_METEO_BASE_URL, json=matcher)

    # 120 coordinates with chunk_size 50 -> 3 chunks (50, 50, 20)
    coords = [(40.0 + i * 0.01, -90.0) for i in range(120)]

    service = WeatherService(chunk_size=50, use_cache=False)
    results = service.get_corridor_weather(coords)

    assert len(results) == 120
    assert requests_mock.call_count == 3


def test_cache_hit_avoids_second_call(requests_mock: Mocker, open_meteo_5pts_fixture):
    """Acceptance check: cache hit avoids second network call."""
    requests_mock.get(OPEN_METEO_BASE_URL, json=open_meteo_5pts_fixture[:2])

    coords = [(41.8781, -87.6298), (41.5236, -90.5776)]
    date_win = "2026-10-22-12"

    service = WeatherService(use_cache=True)

    # First call: cache miss, triggers HTTP request
    results_1 = service.get_corridor_weather(coords, date_window=date_win)
    assert len(results_1) == 2
    assert requests_mock.call_count == 1

    # Second call: cache hit, zero new HTTP requests
    results_2 = service.get_corridor_weather(coords, date_window=date_win)
    assert len(results_2) == 2
    assert requests_mock.call_count == 1  # Still 1!


def test_upstream_failure_raises_clean_error(requests_mock: Mocker):
    """Acceptance check: HTTP 500 or network failure raises clean UpstreamError (HTTP 502)."""
    requests_mock.get(OPEN_METEO_BASE_URL, status_code=500)

    service = WeatherService(use_cache=False)
    with pytest.raises(UpstreamError) as exc_info:
        service.get_corridor_weather([(41.8781, -87.6298)])

    assert exc_info.value.status_code == 502
    assert "Weather service unavailable" in str(exc_info.value)


def test_network_timeout_raises_upstream_error(requests_mock: Mocker):
    """Network connection timeout raises UpstreamError."""
    requests_mock.get(OPEN_METEO_BASE_URL, exc=requests.exceptions.ConnectTimeout("Connection timed out"))

    service = WeatherService(use_cache=False)
    with pytest.raises(UpstreamError) as exc_info:
        service.get_corridor_weather([(41.8781, -87.6298)])

    assert exc_info.value.status_code == 502
    assert "Weather service request failed" in str(exc_info.value)


def test_single_coordinate_open_meteo_response(requests_mock: Mocker, open_meteo_5pts_fixture):
    """Open-Meteo returns a single dictionary (not a list) when 1 point is requested."""
    single_dict = open_meteo_5pts_fixture[0]
    requests_mock.get(OPEN_METEO_BASE_URL, json=single_dict)

    service = WeatherService(use_cache=False)
    results = service.get_corridor_weather([(41.8781, -87.6298)])
    assert len(results) == 1
    assert results[0].lat == 41.8781


def test_empty_coordinates_returns_empty():
    """Empty coordinate list returns empty list without making requests."""
    service = WeatherService()
    assert service.get_corridor_weather([]) == []
    assert fetch_weather_chunk([]) == []


def test_weather_cache_key_generation():
    """Cache key rounds coordinates to 2 decimal places."""
    key1 = make_weather_cache_key(41.878123, -87.629812, "2026-10-22-10")
    key2 = make_weather_cache_key(41.880001, -87.630001, "2026-10-22-10")
    assert key1 == "watr:weather:41.88:-87.63:2026-10-22-10"
    assert key2 == "watr:weather:41.88:-87.63:2026-10-22-10"
    assert key1 == key2


def test_location_weather_value_at_edge_cases():
    """Test value_at: empty hourly, naive datetime, minute >= 30, and out-of-range fallback."""
    # 1. Empty hourly
    empty_loc = LocationWeather(lat=40.0, lon=-90.0, hourly={})
    res_empty = empty_loc.value_at(datetime(2026, 10, 22, 10, 0, tzinfo=UTC))
    assert res_empty.wind_mph == 0.0

    # 2. Naive datetime (tzinfo is None)
    dummy_hourly = {
        "2026-10-22T08:00": HourlyWeather("2026-10-22T08:00", 12.0, 0.1, 0.0),
        "2026-10-22T09:00": HourlyWeather("2026-10-22T09:00", 15.0, 0.2, 0.0),
    }
    loc = LocationWeather(lat=40.0, lon=-90.0, hourly=dummy_hourly)
    naive_dt = datetime(2026, 10, 22, 8, 10)  # Naive
    assert loc.value_at(naive_dt).wind_mph == 12.0

    # 3. Minute >= 30 rounds up
    round_up_dt = datetime(2026, 10, 22, 8, 45, tzinfo=UTC)
    assert loc.value_at(round_up_dt).wind_mph == 15.0

    # 4. Out of range selects closest available key
    future_dt = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)
    assert loc.value_at(future_dt).wind_mph == 15.0

    # 5. get_49h_series with naive departure datetime
    series = loc.get_49h_series(datetime(2026, 10, 22, 8, 0))
    assert len(series) == 49


def test_invalid_json_raises_upstream_error(requests_mock: Mocker):
    """Invalid non-JSON body from upstream raises UpstreamError."""
    requests_mock.get(OPEN_METEO_BASE_URL, text="<!DOCTYPE html><html>Internal Error</html>", status_code=200)
    service = WeatherService(use_cache=False)
    with pytest.raises(UpstreamError) as exc_info:
        service.get_corridor_weather([(41.88, -87.63)])
    assert "Invalid JSON" in str(exc_info.value)


def test_corridor_weather_default_date_window(requests_mock: Mocker, open_meteo_5pts_fixture):
    """When date_window is omitted, it defaults to current UTC hour."""
    requests_mock.get(OPEN_METEO_BASE_URL, json=open_meteo_5pts_fixture[0])
    service = WeatherService(use_cache=True)
    results = service.get_corridor_weather([(41.8781, -87.6298)])  # date_window=None
    assert len(results) == 1
