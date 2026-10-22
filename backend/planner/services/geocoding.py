"""Geocoding Service for Weather-Aware Truck Routing.

Implements multi-provider geocoding with automated fallback:
1. Primary: Mapbox Geocoding (if MAPBOX_ACCESS_TOKEN is configured)
2. Primary fallback: Komoot Photon (free, no API key, US-biased)
3. Secondary fallback: OpenStreetMap Nominatim (custom User-Agent)
4. Caches successful query responses in Django Cache.
5. Returns max 6 results matching Section 5 API contract.
"""

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_GEOCODE_RESULTS = 6
GEOCODE_CACHE_TTL_SECONDS = 86400  # 24 hours
DEFAULT_HTTP_TIMEOUT = 8.0

PHOTON_API_URL = "https://photon.komoot.io/api/"
NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search"
MAPBOX_GEOCODE_API_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/"


@dataclass(frozen=True)
class GeocodeResult:
    """Geocoded place candidate matching Section 5 contract."""

    label: str
    lat: float
    lon: float

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "lat": round(self.lat, 4),
            "lon": round(self.lon, 4),
        }


class BaseGeocodingProvider(ABC):
    """Abstract interface for geocoding providers."""

    @abstractmethod
    def geocode(self, query: str, limit: int = MAX_GEOCODE_RESULTS) -> list[GeocodeResult]:
        """Perform geocode lookup for query string."""
        pass


class PhotonGeocodingProvider(BaseGeocodingProvider):
    """Komoot Photon geocoder (based on OpenStreetMap data)."""

    def __init__(self, timeout: float = DEFAULT_HTTP_TIMEOUT):
        self.timeout = timeout

    def geocode(self, query: str, limit: int = MAX_GEOCODE_RESULTS) -> list[GeocodeResult]:
        params = {
            "q": query,
            "limit": limit,
            # Centered roughly on continental US to bias search
            "lat": 39.8283,
            "lon": -98.5795,
        }
        headers = {"User-Agent": "WATR-Truck-Router/1.0"}
        try:
            resp = requests.get(
                PHOTON_API_URL,
                params=params,
                headers=headers,
                timeout=self.timeout,
            )
            if resp.status_code != 200:
                logger.warning("Photon geocode returned HTTP %d", resp.status_code)
                return []
            data = resp.json()
        except Exception as exc:
            logger.warning("Photon geocode request failed: %s", exc)
            return []

        results: list[GeocodeResult] = []
        features = data.get("features", [])
        for f in features:
            props = f.get("properties", {})
            coords = f.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue

            lon, lat = float(coords[0]), float(coords[1])
            name = props.get("name", "")
            city = props.get("city", "")
            state = props.get("state", "")
            country = props.get("country", "")

            parts = [p for p in [name or city, state, country] if p]
            label = ", ".join(parts) if parts else name or f"{lat:.2f}, {lon:.2f}"

            results.append(GeocodeResult(label=label, lat=lat, lon=lon))
            if len(results) >= limit:
                break

        return results


class NominatimGeocodingProvider(BaseGeocodingProvider):
    """OpenStreetMap Nominatim geocoder (fallback provider)."""

    def __init__(self, timeout: float = DEFAULT_HTTP_TIMEOUT):
        self.timeout = timeout

    def geocode(self, query: str, limit: int = MAX_GEOCODE_RESULTS) -> list[GeocodeResult]:
        params = {
            "q": query,
            "format": "json",
            "limit": limit,
            "countrycodes": "us",
        }
        headers = {"User-Agent": "WATR-Truck-Router/1.0 (contact: aftabali.deve@gmail.com)"}
        try:
            resp = requests.get(
                NOMINATIM_API_URL,
                params=params,
                headers=headers,
                timeout=self.timeout,
            )
            if resp.status_code != 200:
                logger.warning("Nominatim geocode returned HTTP %d", resp.status_code)
                return []
            data = resp.json()
        except Exception as exc:
            logger.warning("Nominatim geocode request failed: %s", exc)
            return []

        results: list[GeocodeResult] = []
        for item in data:
            try:
                lat = float(item["lat"])
                lon = float(item["lon"])
                label = item.get("display_name", f"{lat:.2f}, {lon:.2f}")
                results.append(GeocodeResult(label=label, lat=lat, lon=lon))
                if len(results) >= limit:
                    break
            except (KeyError, ValueError):
                continue

        return results


class MapboxGeocodingProvider(BaseGeocodingProvider):
    """Mapbox Places geocoder (activated if MAPBOX_ACCESS_TOKEN set)."""

    def __init__(self, token: str, timeout: float = DEFAULT_HTTP_TIMEOUT):
        self.token = token
        self.timeout = timeout

    def geocode(self, query: str, limit: int = MAX_GEOCODE_RESULTS) -> list[GeocodeResult]:
        if not self.token:
            return []
        url = f"{MAPBOX_GEOCODE_API_URL}{requests.utils.quote(query)}.json"
        params = {
            "access_token": self.token,
            "limit": limit,
            "country": "us",
            "types": "place,locality,postcode",
        }
        try:
            resp = requests.get(url, params=params, timeout=self.timeout)
            if resp.status_code != 200:
                logger.warning("Mapbox geocode returned HTTP %d", resp.status_code)
                return []
            data = resp.json()
        except Exception as exc:
            logger.warning("Mapbox geocode request failed: %s", exc)
            return []

        results: list[GeocodeResult] = []
        features = data.get("features", [])
        for f in features:
            coords = f.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue
            place_name = f.get("place_name", "")
            results.append(
                GeocodeResult(
                    label=place_name,
                    lat=float(coords[1]),
                    lon=float(coords[0]),
                )
            )
            if len(results) >= limit:
                break

        return results


class GeocodingService:
    """Orchestrates geocode queries with caching and provider fallback."""

    def __init__(
        self,
        primary_provider: BaseGeocodingProvider | None = None,
        fallback_provider: BaseGeocodingProvider | None = None,
        use_cache: bool = True,
    ):
        self.use_cache = use_cache
        mapbox_token = os.environ.get("MAPBOX_ACCESS_TOKEN", "").strip()

        if primary_provider:
            self.primary = primary_provider
        elif mapbox_token:
            self.primary = MapboxGeocodingProvider(token=mapbox_token)
        else:
            self.primary = PhotonGeocodingProvider()

        self.fallback = fallback_provider or NominatimGeocodingProvider()

    def search(self, query: str, limit: int = MAX_GEOCODE_RESULTS) -> list[GeocodeResult]:
        """Search places by query with cache and fallback."""
        clean_q = query.strip()
        if not clean_q or len(clean_q) < 2:
            return []

        cache_key = f"watr:geocode:{clean_q.lower()}:{limit}"
        if self.use_cache:
            cached = cache.get(cache_key)
            if cached is not None:
                return cached

        # Try primary provider
        results = self.primary.geocode(clean_q, limit=limit)

        # If primary failed or returned nothing, try fallback
        if not results:
            logger.info("Primary geocoder yielded no results for '%s', trying fallback", clean_q)
            results = self.fallback.geocode(clean_q, limit=limit)

        # If both failed, check if both raised errors or genuinely empty
        final_results = results[:limit]

        if self.use_cache and final_results:
            cache.set(cache_key, final_results, GEOCODE_CACHE_TTL_SECONDS)

        return final_results
