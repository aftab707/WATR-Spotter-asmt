"""Unit tests for Geocoding service and /api/geocode/ endpoint."""

import json
from pathlib import Path

import pytest
from django.core.cache import cache
from requests_mock.mocker import Mocker
from rest_framework.test import APIClient

from planner.services.geocoding import (
    NOMINATIM_API_URL,
    PHOTON_API_URL,
    GeocodingService,
    NominatimGeocodingProvider,
    PhotonGeocodingProvider,
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True)
def clear_django_cache():
    """Clear cache before each test."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def photon_fixture():
    with open(FIXTURES_DIR / "photon_geocode_chicago.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def nominatim_fixture():
    with open(FIXTURES_DIR / "nominatim_geocode_chicago.json", encoding="utf-8") as f:
        return json.load(f)


def test_photon_geocoding_success(requests_mock: Mocker, photon_fixture):
    """Photon parses features and returns formatted GeocodeResult list."""
    requests_mock.get(PHOTON_API_URL, json=photon_fixture)

    provider = PhotonGeocodingProvider()
    results = provider.geocode("Chicago", limit=6)

    assert len(results) == 6
    assert results[0].label == "Chicago, Illinois, United States"
    assert results[0].lat == 41.8755616
    assert results[0].lon == -87.6244212


def test_provider_failure_falls_back_to_nominatim(
    requests_mock: Mocker,
    nominatim_fixture,
):
    """Acceptance check: Primary provider failure falls back to Nominatim."""
    # Photon fails with HTTP 500
    requests_mock.get(PHOTON_API_URL, status_code=500)
    # Nominatim succeeds
    requests_mock.get(NOMINATIM_API_URL, json=nominatim_fixture)

    service = GeocodingService(
        primary_provider=PhotonGeocodingProvider(),
        fallback_provider=NominatimGeocodingProvider(),
        use_cache=False,
    )
    results = service.search("Chicago", limit=6)

    assert len(results) >= 1
    assert "Chicago" in results[0].label
    assert results[0].lat == 41.8755616


def test_geocode_api_endpoint_returns_max_6_results(
    requests_mock: Mocker,
    photon_fixture,
):
    """Acceptance check: GET /api/geocode/?q=chicago returns max 6 results with status 200."""
    requests_mock.get(PHOTON_API_URL, json=photon_fixture)

    client = APIClient()
    response = client.get("/api/geocode/?q=chicago")

    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) <= 6
    assert len(data["results"]) == 6

    first = data["results"][0]
    assert "label" in first
    assert "lat" in first
    assert "lon" in first


def test_geocode_api_endpoint_short_query_returns_empty():
    """Short query (<2 chars) returns empty list immediately without external calls."""
    client = APIClient()
    response = client.get("/api/geocode/?q=a")
    assert response.status_code == 200
    assert response.json() == {"results": []}


def test_geocoding_cache_hit_avoids_second_call(
    requests_mock: Mocker,
    photon_fixture,
):
    """Subsequent identical geocode queries are served from cache."""
    requests_mock.get(PHOTON_API_URL, json=photon_fixture)

    service = GeocodingService(use_cache=True)
    res1 = service.search("Chicago", limit=6)
    assert len(res1) == 6
    assert requests_mock.call_count == 1

    # Second call should hit cache
    res2 = service.search("Chicago", limit=6)
    assert len(res2) == 6
    assert requests_mock.call_count == 1
