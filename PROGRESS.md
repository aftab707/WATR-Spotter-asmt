# Project Progress — Weather-Aware Truck Routing

## Checklist

- [x] **Step 0 — Bootstrap & conventions**
- [x] **Step 1 — API spike (prove the providers before building on them)**
- [x] **Step 2 — Risk engine (pure) + tests**
- [x] **Step 3 — Geometry: sampling, ETA, segments, summaries (pure) + tests**
- [x] **Step 4 — Weather service**
- [x] **Step 5 — Routing + geocoding services**
- [ ] **Step 6 — Recommendation engine (pure) + tests**
- [ ] **Step 7 — `/api/plan/` orchestrator**
- [ ] **Step 8 — Frontend foundation**
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
