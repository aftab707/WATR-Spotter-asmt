# System Architecture & Provider Decisions

## 1. System Overview

Weather-Aware Truck Routing (WATR) is a decoupled, high-performance web application designed to evaluate corridor weather hazards and compute optimal routing choices for commercial freight.

```
backend/
  config/                  # Django settings (env-driven), urls
  planner/
    views.py               # Thin controller: validate -> orchestrate -> serialize
    serializers.py         # Request validation & strict response typing
    services/              # External provider integrations behind unified interfaces
      geocoding.py         # Photon (komoot) primary, Nominatim fallback, Mapbox optional
      routing.py           # OSRM / Mapbox Directions + via-waypoint generator for 3 routes
      weather.py           # Open-Meteo multi-coordinate batch client (<= 50 per chunk)
      orchestrator.py      # Parallel coordination, ETA matching, heatmap matrix
    logic/                 # Pure functions: zero network I/O, 100% deterministic & testable
      risk.py              # Wind, rain, snow classification & gross load weight rules
      geometry.py          # Haversine distance, checkpoint sampling, polyline simplify
      eta.py               # Monotonic time interpolation across cumulative route distance
      summary.py           # Segment distance allocation, per-level miles, distance-weighted risk
      recommend.py         # 4-stage lexicographical ranking & comparative reason generator
    tests/
      fixtures/            # Raw upstream responses from spike & contract testing
frontend/
  src/
    api/                   # Typed API client, JSDoc definitions (types.js), TanStack Query hooks
    theme/                 # MUI v5 dark theme tokens (8px grid, risk palette)
    components/            # TripForm, RouteCard, RouteMap, HeatmapSlider, CheckpointTable, RiskStrip
    pages/Planner.jsx
    lib/                   # Risk color constants, formatters, unit helpers
```

---

## 2. Provider Decisions (Step 1 Spike Findings)

An API spike was executed across real-world long-haul (Chicago, IL -> Denver, CO; ~1,005 mi) and regional corridors (Chicago, IL -> Milwaukee, WI; ~89 mi) to empirically evaluate latency, payload structures, route counts, and units. Raw fixtures are preserved in `backend/planner/tests/fixtures/`.

### 2.1 Routing Providers

| Provider | Query / Corridor | HTTP Status | Latency | Routes Returned | Details / Fixture |
|---|---|---|---|---|---|
| **OSRM Public** | Chicago -> Denver | 200 OK | ~1540 ms | **2 routes** | Route #1: 1,005.1 mi, 1,068 min (9,215 coords)<br>Route #2: 1,115.7 mi, 1,196 min (10,932 coords)<br>Saved: `osrm_chicago_to_denver.json` |
| **OSRM Public** | Chicago -> Milwaukee | 200 OK | ~1035 ms | **2 routes** | Route #1: 88.9 mi, 112 min (1,557 coords)<br>Route #2: 101.7 mi, 127 min (1,487 coords)<br>Saved: `osrm_chicago_to_milwaukee.json` |
| **Mapbox Directions** | Chicago -> Denver | N/A | Skipped | N/A | Server-side token optional. Ready when `MAPBOX_ACCESS_TOKEN` is configured. |

**Key Finding & Architecture Decision:**
- The public OSRM engine returns at most **2 alternatives** even when `alternatives=true` is requested.
- Therefore, our decision in **Section 3** is confirmed and essential: the backend routing service must implement a **via-waypoint offset generator** (calculating a perpendicular offset from the route midpoint to query an additional route option, then pruning any candidate sharing >90% geometry).
- Geometry is provided as GeoJSON `[lon, lat]` LineStrings with fine-grained coordinates, making cumulative distance calculation and uniform checkpoint sampling (10/25/50 miles) straightforward.

---

### 2.2 Geocoding Providers

| Provider | Query | HTTP Status | Latency | Results Count | Key Properties / Fixture |
|---|---|---|---|---|---|
| **Photon (komoot)** | "Chicago" | 200 OK | ~1279 ms | 6 results | Structured OSM features: city, state, country, coordinates `[lon, lat]`. No API key required.<br>Saved: `photon_geocode_chicago.json` |
| **Nominatim (OSM)** | "Chicago" | 200 OK | ~1645 ms | 1 result | Standard OSM search, requires custom `User-Agent`. Complies with rate limits.<br>Saved: `nominatim_geocode_chicago.json` |

**Key Finding & Architecture Decision:**
- **Photon** serves as our **primary geocoding provider** due to its fast response time, rich structured address properties, and multiple candidate matches.
- **Nominatim** is retained as an automated **fallback provider** in case Photon experiences downtime or rate limits.
- Geocode results will be cached locally by query string to prevent redundant network trips.

---

### 2.3 Weather Provider: Open-Meteo Batch

| Query | Batch Size | Latency | Response Shape | Forecast Depth | Fixture |
|---|---|---|---|---|---|
| 5 corridor checkpoints (IL -> IA -> NE -> CO) | 5 coordinates | ~1019 ms | Array of 5 forecast JSON objects | 168 hours (7 days) hourly data | `open_meteo_batch_5pts.json` |

**Units Verification:**
- `wind_speed_10m`: `mp/h` (matches spec wind thresholds)
- `rain`: `inch` (accumulated per hour)
- `showers`: `inch` (accumulated per hour)
- `snowfall`: `inch` (accumulated per hour)
- `time`: ISO 8601 UTC timestamps

**Key Finding & Architecture Decision:**
- Open-Meteo's multi-coordinate endpoint accepts comma-separated lists of `latitude` and `longitude` and returns an array of forecast objects in the exact coordinate order requested.
- Total rain will be computed as `rain + showers` (both in inches/hour).
- Snow will be extracted directly from `snowfall` (in inches/hour).
- Batch chunks will be capped at $\le 50$ coordinates per call (per Section 3) executed in parallel via `concurrent.futures.ThreadPoolExecutor`.
- The 168-hour forecast window comfortably accommodates both the trip checkpoint ETAs and the 0–48 hour heatmap matrix.
