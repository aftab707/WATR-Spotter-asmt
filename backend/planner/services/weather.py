"""Weather Service for Weather-Aware Truck Routing.

Implements Open-Meteo batch client:
- Multi-coordinate batch querying chunked into batches of <= 50 coordinates.
- Concurrent execution across chunks via ThreadPoolExecutor.
- Per-call timeout (8s) and 2 retries with exponential backoff.
- UpstreamError handling on network/upstream failures (HTTP 502).
- Django cache integration keyed by (round(lat, 2), round(lon, 2), date_window).
- Nearest-hour lookup via value_at(target_time) for ETA matching.
"""

import logging
import time
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import requests
from django.core.cache import cache
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
MAX_BATCH_CHUNK_SIZE = 50
DEFAULT_TIMEOUT_SECONDS = 8.0
MAX_RETRIES = 2
CACHE_TTL_SECONDS = 3600  # 1 hour cache TTL


class UpstreamError(Exception):
    """Raised when an external API provider fails, times out, or returns invalid data."""

    def __init__(
        self,
        message: str = "Weather service unavailable, try again",
        status_code: int = 502,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class HourlyWeather:
    """Weather metrics for a specific hour at a geographic coordinate.

    Attributes:
        time_iso: Timestamp formatted as 'YYYY-MM-DDTHH:00'.
        wind_mph: Sustained 10m wind speed in miles per hour.
        rain_in_hr: Rain plus showers precipitation in inches/hour.
        snow_in_hr: Snowfall precipitation in inches/hour.
    """

    time_iso: str
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float


@dataclass
class LocationWeather:
    """Hourly forecast series for a specific coordinate.

    Attributes:
        lat: Latitude in degrees.
        lon: Longitude in degrees.
        hourly: Dictionary mapping ISO hour string ('YYYY-MM-DDTHH:00') to HourlyWeather.
    """

    lat: float
    lon: float
    hourly: dict[str, HourlyWeather]

    def value_at(self, target_time: datetime) -> HourlyWeather:
        """Find the weather matching the nearest top-of-the-hour to target_time.

        Args:
            target_time: Checkpoint arrival datetime.

        Returns:
            HourlyWeather matching target_time, or closest available hour.
        """
        if not self.hourly:
            # Fallback safe default
            return HourlyWeather(
                time_iso=target_time.strftime("%Y-%m-%dT%H:00"),
                wind_mph=0.0,
                rain_in_hr=0.0,
                snow_in_hr=0.0,
            )

        # Normalize target_time to UTC
        if target_time.tzinfo is None:
            utc_time = target_time.replace(tzinfo=UTC)
        else:
            utc_time = target_time.astimezone(UTC)

        # Round to nearest hour
        base = utc_time.replace(minute=0, second=0, microsecond=0)
        if utc_time.minute >= 30:
            from datetime import timedelta

            base = base + timedelta(hours=1)

        nearest_key = base.strftime("%Y-%m-%dT%H:00")
        if nearest_key in self.hourly:
            return self.hourly[nearest_key]

        # If exact nearest key is missing, find the chronologically closest key
        sorted_keys = sorted(self.hourly.keys())

        # Binary search / min difference
        closest_key = min(
            sorted_keys,
            key=lambda k: abs(
                datetime.fromisoformat(k).replace(tzinfo=UTC).timestamp() - base.timestamp()
            ),
        )
        return self.hourly[closest_key]

    def get_49h_series(self, departure_time: datetime) -> list[HourlyWeather]:
        """Generate the 49-hour weather series (departure + 0h to 48h) for heatmap computation."""
        from datetime import timedelta

        if departure_time.tzinfo is None:
            dep_utc = departure_time.replace(tzinfo=UTC)
        else:
            dep_utc = departure_time.astimezone(UTC)

        base = dep_utc.replace(minute=0, second=0, microsecond=0)
        series: list[HourlyWeather] = []
        for h in range(49):
            target = base + timedelta(hours=h)
            series.append(self.value_at(target))
        return series


def make_weather_cache_key(lat: float, lon: float, date_window: str | None = None) -> str:
    """Generate cache key: (round(lat, 2), round(lon, 2), date-window)."""
    if date_window is None:
        date_window = datetime.now(UTC).strftime("%Y-%m-%d-%H")
    return f"watr:weather:{round(lat, 2):.2f}:{round(lon, 2):.2f}:{date_window}"


def _create_http_session() -> requests.Session:
    """Create requests Session with retry logic."""
    session = requests.Session()
    retries = Retry(
        total=MAX_RETRIES,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def parse_open_meteo_item(item: dict[str, Any], query_lat: float, query_lon: float) -> LocationWeather:
    """Parse a single Open-Meteo location forecast object."""
    hourly_raw = item.get("hourly", {})
    times = hourly_raw.get("time", [])
    winds = hourly_raw.get("wind_speed_10m", [])
    rains = hourly_raw.get("rain", [])
    showers = hourly_raw.get("showers", [])
    snows = hourly_raw.get("snowfall", [])

    hourly_dict: dict[str, HourlyWeather] = {}
    for i in range(len(times)):
        t_iso = times[i]
        # Open-Meteo returns '2026-10-22T00:00'
        wind = float(winds[i]) if i < len(winds) and winds[i] is not None else 0.0
        rain = float(rains[i]) if i < len(rains) and rains[i] is not None else 0.0
        shower = float(showers[i]) if i < len(showers) and showers[i] is not None else 0.0
        snow = float(snows[i]) if i < len(snows) and snows[i] is not None else 0.0

        hourly_dict[t_iso] = HourlyWeather(
            time_iso=t_iso,
            wind_mph=round(wind, 2),
            rain_in_hr=round(rain + shower, 4),
            snow_in_hr=round(snow, 4),
        )

    return LocationWeather(
        lat=query_lat,
        lon=query_lon,
        hourly=hourly_dict,
    )


def fetch_weather_chunk(
    chunk_coords: list[tuple[float, float]],
    session: requests.Session | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> list[LocationWeather]:
    """Fetch weather for a chunk of <= 50 coordinates from Open-Meteo.

    Args:
        chunk_coords: List of (lat, lon) pairs.
        session: Optional requests.Session instance.
        timeout: HTTP request timeout in seconds.

    Returns:
        List of LocationWeather objects matching chunk_coords order.

    Raises:
        UpstreamError: If the HTTP request fails or server returns error status.
    """
    if not chunk_coords:
        return []

    lats_str = ",".join(f"{c[0]:.4f}" for c in chunk_coords)
    lons_str = ",".join(f"{c[1]:.4f}" for c in chunk_coords)

    params = {
        "latitude": lats_str,
        "longitude": lons_str,
        "hourly": "wind_speed_10m,rain,showers,snowfall",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "UTC",
    }

    req_session = session or _create_http_session()
    start_time = time.perf_counter()
    try:
        response = req_session.get(
            OPEN_METEO_BASE_URL,
            params=params,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        logger.error("Open-Meteo request failed: %s", exc)
        raise UpstreamError(f"Weather service request failed: {exc}") from exc

    latency_ms = (time.perf_counter() - start_time) * 1000
    logger.debug("Open-Meteo chunk response (%d points): %d in %.1f ms", len(chunk_coords), response.status_code, latency_ms)

    if response.status_code != 200:
        logger.error("Open-Meteo returned HTTP %d: %s", response.status_code, response.text[:200])
        raise UpstreamError(
            f"Weather service unavailable (HTTP {response.status_code})",
            status_code=502,
        )

    try:
        data = response.json()
    except Exception as exc:
        raise UpstreamError(f"Invalid JSON returned by weather service: {exc}") from exc

    # Open-Meteo returns a single dict if len(chunk_coords) == 1, else a list of dicts
    if isinstance(data, list):
        items = data
    else:
        items = [data]

    if len(items) != len(chunk_coords):
        logger.warning(
            "Open-Meteo response count mismatch: expected %d, got %d",
            len(chunk_coords),
            len(items),
        )

    results: list[LocationWeather] = []
    for i, coord in enumerate(chunk_coords):
        item = items[i] if i < len(items) else items[-1]
        results.append(parse_open_meteo_item(item, query_lat=coord[0], query_lon=coord[1]))

    return results


class WeatherService:
    """High-level Weather Service managing batching, caching, and parallel fetches."""

    def __init__(
        self,
        base_url: str = OPEN_METEO_BASE_URL,
        chunk_size: int = MAX_BATCH_CHUNK_SIZE,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        use_cache: bool = True,
    ):
        self.base_url = base_url
        self.chunk_size = chunk_size
        self.timeout = timeout
        self.use_cache = use_cache
        self.session = _create_http_session()

    def get_corridor_weather(
        self,
        coordinates: Sequence[tuple[float, float]],
        date_window: str | None = None,
    ) -> list[LocationWeather]:
        """Fetch hourly weather for an arbitrary number of route coordinates.

        Workflow:
        1. Query cache for each coordinate (using 2-decimal rounded coordinates).
        2. Identify cache misses and group unique coordinates into chunks of <= 50.
        3. Parallel-fetch missing chunks via ThreadPoolExecutor.
        4. Populate cache for newly fetched items.
        5. Return results assembled in original coordinate sequence.
        """
        if not coordinates:
            return []

        if date_window is None:
            date_window = datetime.now(UTC).strftime("%Y-%m-%d-%H")

        results_by_coord: dict[tuple[float, float], LocationWeather] = {}
        missing_coords_dict: dict[tuple[float, float], str] = {}

        # Check cache
        for coord in coordinates:
            lat, lon = coord
            rounded_key = (round(lat, 2), round(lon, 2))
            if rounded_key in results_by_coord:
                continue

            cache_key = make_weather_cache_key(lat, lon, date_window)
            if self.use_cache:
                cached_data = cache.get(cache_key)
                if cached_data is not None:
                    results_by_coord[rounded_key] = cached_data
                    continue

            missing_coords_dict[rounded_key] = cache_key

        unique_missing = list(missing_coords_dict.keys())

        # If any cache misses, fetch them in chunks
        if unique_missing:
            chunks = [
                unique_missing[i : i + self.chunk_size]
                for i in range(0, len(unique_missing), self.chunk_size)
            ]

            max_workers = min(len(chunks), 4)
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(
                        fetch_weather_chunk,
                        chunk,
                        session=self.session,
                        timeout=self.timeout,
                    ): chunk
                    for chunk in chunks
                }

                for future in as_completed(futures):
                    chunk_weather_list = future.result()  # Will re-raise UpstreamError if any chunk failed
                    for loc_weather in chunk_weather_list:
                        key = (round(loc_weather.lat, 2), round(loc_weather.lon, 2))
                        results_by_coord[key] = loc_weather
                        if self.use_cache:
                            c_key = missing_coords_dict.get(key)
                            if c_key:
                                cache.set(c_key, loc_weather, CACHE_TTL_SECONDS)

        # Assemble output matching input order
        ordered_results: list[LocationWeather] = []
        for coord in coordinates:
            key = (round(coord[0], 2), round(coord[1], 2))
            if key in results_by_coord:
                cached_item = results_by_coord[key]
                ordered_results.append(
                    LocationWeather(lat=coord[0], lon=coord[1], hourly=cached_item.hourly)
                )
            else:
                # Should not happen, but safe fallback
                ordered_results.append(
                    LocationWeather(lat=coord[0], lon=coord[1], hourly={})
                )

        return ordered_results
