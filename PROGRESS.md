# Project Progress — Weather-Aware Truck Routing

## Checklist

- [x] **Step 0 — Bootstrap & conventions**
- [x] **Step 1 — API spike (prove the providers before building on them)**
- [x] **Step 2 — Risk engine (pure) + tests**
- [x] **Step 3 — Geometry: sampling, ETA, segments, summaries (pure) + tests**
- [x] **Step 4 — Weather service**
- [x] **Step 5 — Routing + geocoding services**
- [x] **Step 6 — Recommendation engine (pure) + tests**
- [x] **Step 7 — `/api/plan/` orchestrator**
- [x] **Step 8 — Frontend foundation**
- [ ] **Step 9 — Trip form**
- [ ] **Step 10 — Results: route cards + recommendation**
- [ ] **Step 11 — Map: routes + checkpoints**
- [ ] **Step 12 — Heatmap + 0–48h slider**
- [ ] **Step 13 — Checkpoint table + risk strip**
- [ ] **Step 14 — UX & visual polish**
- [ ] **Step 15 — Docker, Redis (OPTIONAL), CI**
- [ ] **Step 16 — Deploy**
- [ ] **Step 17 — Documentation & Loom prep**
- [ ] **Step 18 — Final QA (do not skip)**
- [ ] **Step 19 — OPTIONAL (TripPlan model + GET /api/plans/{id}/)**

---

## Step Execution Log

### Step 0 — Bootstrap & conventions
- **What changed:** Initialized monorepo with git, configured Django 5 REST Framework backend (`config`, `planner`, CORS, WhiteNoise, ruff, pytest) with `/api/health/` endpoint, and set up Vite React 18 + MUI dark theme frontend with ESLint, Prettier, JSDoc types in `src/api/types.js`, and `.env.example` templates.
- **Files touched:** `.gitignore`, `PROGRESS.md`, `docs/LEARNING.md`, `backend/*` (`manage.py`, `config/*`, `planner/*`, `ruff.toml`, `pytest.ini`, `requirements.txt`, `.env.example`), `frontend/*` (`package.json`, `vite.config.js`, `.eslintrc.cjs`, `.prettierrc`, `index.html`, `src/*`, `.env.example`).
- **How to verify:** Run `pytest backend` and `ruff check backend` for backend; run `npm --prefix frontend run lint` and `npm --prefix frontend run build` for frontend; verify `GET /api/health/` returns `{"status": "ok"}`.

### Step 1 — API spike (prove the providers before building on them)
- **What changed:** Built and executed `backend/scripts/spike.py` testing OSRM routing on long & short city corridors, Photon & Nominatim geocoding, and Open-Meteo multi-coordinate batch weather; verified latency, units, and route alternative limitations; saved raw fixture JSON files and documented provider decisions in `docs/ARCHITECTURE.md`.
- **Files touched:** `backend/scripts/spike.py`, `backend/planner/tests/fixtures/*` (`osrm_chicago_to_denver.json`, `osrm_chicago_to_milwaukee.json`, `photon_geocode_chicago.json`, `nominatim_geocode_chicago.json`, `open_meteo_batch_5pts.json`), `docs/ARCHITECTURE.md`, `PROGRESS.md`.
- **How to verify:** Run `python backend/scripts/spike.py` and inspect console outputs and generated fixtures in `backend/planner/tests/fixtures/`; review provider validation in `docs/ARCHITECTURE.md`.

### Step 2 — Risk engine (pure) + tests
- **What changed:** Implemented pure checkpoint risk classification engine (`logic/risk.py`) with `RiskLevel` IntEnum (1 to 5), half-open wind bands, upper-inclusive rain/snow bands, strict gross load rules (> 30k lb, > 40k lb), invariant that load rules only raise risk, and full test matrix with 100% test coverage.
- **Files touched:** `backend/planner/logic/risk.py`, `backend/planner/tests/test_risk.py`, `backend/requirements.txt`, `PROGRESS.md`.
- **How to verify:** Run `pytest backend/planner/tests/test_risk.py --cov=planner.logic.risk --cov-report=term-missing` to confirm 42 boundary tests pass with 100% line coverage and 0 missing lines.

### Step 3 — Geometry: sampling, ETA, segments, summaries (pure) + tests
- **What changed:** Implemented pure mathematical modules for route geometry (`logic/geometry.py`), ETA time progression (`logic/eta.py`), and corridor segment allocation/summary (`logic/summary.py`); verified Haversine distance, uniform interval checkpoint sampling (10/25/50 miles) with terminal milestone insertion, RDP polyline decimation (<= 2000 points), monotonic ETA interpolation, exact midpoint segment distance conservation (`sum(segments) == total_distance`), and distance-weighted average risk computation.
- **Files touched:** `backend/planner/logic/geometry.py`, `backend/planner/logic/eta.py`, `backend/planner/logic/summary.py`, `backend/planner/tests/test_geometry.py`, `backend/planner/tests/test_eta.py`, `backend/planner/tests/test_summary.py`, `PROGRESS.md`.
- **How to verify:** Run `pytest backend --cov=planner.logic --cov-report=term-missing` to verify all 71 unit tests pass with 99% coverage across all pure logic modules.

### Step 4 — Weather service
- **What changed:** Implemented Open-Meteo multi-coordinate batch weather client (`services/weather.py`) with automatic chunking (<= 50 points), `ThreadPoolExecutor` concurrency, per-call 8s timeout with 2 retries and backoff, `UpstreamError` mapping, Django cache integration keyed by `(round(lat,2), round(lon,2), date_window)`, `value_at(time)` nearest top-of-hour resolution, and 49-hour heatmap series generation.
- **Files touched:** `backend/planner/services/weather.py`, `backend/planner/tests/test_weather.py`, `backend/config/settings.py`, `PROGRESS.md`.
- **How to verify:** Run `pytest backend/planner/tests/test_weather.py --cov=planner.services.weather --cov-report=term-missing` to verify all 12 mock and fixture-driven tests pass with 98% coverage.

### Step 5 — Routing + geocoding services
- **What changed:** Implemented routing and geocoding services behind unified provider interfaces (`services/routing.py`, `services/geocoding.py`) with Mapbox + OSRM routing, automated provider fallback, perpendicular via-waypoint alternative generation, geometry overlap de-duplication (>90% threshold), and created the cached `/api/geocode/` endpoint returning max 6 results.
- **Files touched:** `backend/planner/services/routing.py`, `backend/planner/services/geocoding.py`, `backend/planner/views.py`, `backend/planner/urls.py`, `backend/planner/tests/test_routing.py`, `backend/planner/tests/test_geocoding.py`, `PROGRESS.md`.
- **How to verify:** Run `pytest backend/planner/tests/test_routing.py backend/planner/tests/test_geocoding.py` to verify provider fallback, via-waypoint trigger when <3 routes, duplicate pruning, and `/api/geocode/?q=chicago` 200 response.

### Step 6 — Recommendation engine (pure) + tests
- **What changed:** Implemented pure recommendation engine (`logic/recommend.py`) using the 5-tier ascending sort key `(no_travel_miles, severe_miles, high_miles, avg_risk, duration_minutes)` with jitter-free rounding, hazard invariants (`no_travel_miles > 0` unrecommended, all-hazard warning), and comparative human-readable reason generator vs fastest route.
- **Files touched:** `backend/planner/logic/recommend.py`, `backend/planner/tests/test_recommend.py`, `PROGRESS.md`.
- **How to verify:** Run `pytest backend/planner/tests/test_recommend.py --cov=planner.logic.recommend --cov-report=term-missing` to verify all 10 tie-break, hazard, and comparative reason scenarios pass with 100% coverage.

### Step 7 — `/api/plan/` orchestrator
- **What changed:** Implemented input validation and Section 5 response serializers (`serializers.py`), trip planning orchestrator service (`services/orchestrator.py`), DRF view endpoint with 30/min rate throttling, HTTP 422 validation mapping, HTTP 502 upstream failure handling, and HTTP 504 timeout mapping (`views.py`, `urls.py`); unified route simplification, uniform checkpoint sampling, monotonic ETAs, single batch cached weather fetch, checkpoint risk evaluation with gross load rules, route summaries, recommendation ranking, and 0-48h forecast heatmap series matrix; added comprehensive contract tests and exported realistic fixture `frontend/src/api/fixtures/plan.json`.
- **Files touched:** `backend/planner/serializers.py`, `backend/planner/services/orchestrator.py`, `backend/planner/views.py`, `backend/planner/urls.py`, `backend/config/settings.py`, `backend/planner/tests/test_orchestrator.py`, `backend/scripts/generate_plan_fixture.py`, `frontend/src/api/fixtures/plan.json`, `PROGRESS.md`, `docs/LEARNING.md`.
- **How to verify:** Run `pytest backend` (all 113 tests pass with 94% coverage), `ruff check backend`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build`.

### Step 8 — Frontend foundation
- **What changed:** Configured MUI dark theme tokens (8px spacing scale, single 8px border radius, 2 font weights, centralized risk palette in `theme/theme.js` and `lib/risk.js` enforcing text + icon accompaniment), implemented standard value formatters (`lib/formatters.js`), typed API client with `VITE_USE_MOCK` offline fixture support and error mapping (`api/client.js`), TanStack Query hooks with `/api/health/` warm-up query on load (`api/queries.js`), created reusable `RiskBadge`, `AppHeader`, responsive 3-panel `ShellLayout` (left panel, map area, bottom panel), and wired `pages/Planner.jsx` rendering the complete shell layout with mock data from `plan.json`.
- **Files touched:** `frontend/src/lib/risk.js`, `frontend/src/lib/formatters.js`, `frontend/src/theme/theme.js`, `frontend/src/api/client.js`, `frontend/src/api/queries.js`, `frontend/src/components/RiskBadge.jsx`, `frontend/src/components/AppHeader.jsx`, `frontend/src/components/ShellLayout.jsx`, `frontend/src/pages/Planner.jsx`, `frontend/src/App.jsx`, `PROGRESS.md`, `docs/LEARNING.md`.
- **How to verify:** Run `npm --prefix frontend run lint` (0 warnings), `npm --prefix frontend run build` (builds successfully), and `pytest backend` (113 passing). App renders responsive shell with mock data from `frontend/src/api/fixtures/plan.json` with 0 console errors.
