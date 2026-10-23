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
- [x] **Step 9 — Trip form**
- [x] **Step 10 — Results: route cards + recommendation**
- [x] **Step 11 — Map: routes + checkpoints**
- [x] **Step 12 — Heatmap + 0–48h slider**
- [x] **Step 13 — Checkpoint table + risk strip**
- [x] **Step 14 — UX & visual polish**
- [x] **Step 15 — Docker, Redis (OPTIONAL), CI**
- [x] **Step 16 — Deploy**
- [x] **Step 17 — Documentation & Loom prep**
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

### Step 9 — Trip form
- **What changed:** Created custom debounce hook (`lib/useDebounce.js`), debounced location autocomplete component (`components/LocationAutocomplete.jsx`) with async geocode search, loading indicators, and empty states; built comprehensive trip configuration form (`components/TripForm.jsx`) with origin/destination autocompletes, bounded `DateTimePicker` (`[now - 1h, now + 7 days]`), validated cargo load weight field (1–120,000 lb) with quick weight preset chips and hazard elevation warning banners, sampling interval selector (10/25/50 mi), one-click **"Try example trip"** button, submit button with disabled/loading spinner states, and inline server error alerts; wired `TripForm` into `pages/Planner.jsx` with `usePlanTrip` mutation.
- **Files touched:** `frontend/src/lib/useDebounce.js`, `frontend/src/api/client.js`, `frontend/src/components/LocationAutocomplete.jsx`, `frontend/src/components/TripForm.jsx`, `frontend/src/pages/Planner.jsx`, `PROGRESS.md`, `docs/LEARNING.md`.
- **How to verify:** Run `npm --prefix frontend run lint` (0 warnings), `npm --prefix frontend run build` (builds successfully), and `pytest backend` (113 passing). In browser: invalid inputs show clear inline errors (e.g. past departure, invalid weight, identical origin/destination), "Try example trip" button pre-fills Chicago → Denver in one click, and keyboard navigation works smoothly.

### Step 10 — Results: route cards + recommendation
- **What changed:** Created `RouteCard` component displaying evaluated route distance, duration, arrival ETA, Severe/High miles, avg risk score, max risk badge, prominent "Recommended" star badge, and dedicated "Why this route" comparative callout box; built `RouteComparison` view displaying the side-by-side trade-off between the fastest and recommended route (extra minutes vs severe storm miles bypassed); built `RouteCardSkeleton` placeholders for zero-CLS loading states; added empty and error states; synchronized card selection and hover state with corridor previews in `Planner.jsx`.
- **Files touched:** `frontend/src/components/RouteCard.jsx`, `frontend/src/components/RouteComparison.jsx`, `frontend/src/components/RouteCardSkeleton.jsx`, `frontend/src/pages/Planner.jsx`, `PROGRESS.md`, `docs/LEARNING.md`.
- **How to verify:** Run `npm --prefix frontend run lint` (0 warnings), `npm --prefix frontend run build` (builds successfully), and `pytest backend` (113 passing). In browser: recommended route is visually prominent; numbers match API data exactly; comparative trade-off card shows extra time vs hazard avoided; skeletons render smoothly during calculation with zero layout shift.

### Step 11 — Map: routes + checkpoints
- **What changed:** Installed `maplibre-gl` and `react-map-gl`; implemented GPU-accelerated interactive MapLibre map component (`components/RouteMap.jsx`) using free no-key CARTO dark matter vector style; rendered 3 distinct colored route lines with active line width/opacity emphasis; rendered 300+ checkpoints via GeoJSON circle layer dynamically styled by risk level (ensuring smooth 60fps pan/zoom without DOM node bloat or layer recreation); built rich interactive checkpoint popup surfacing ETA, sustained wind speed, rain/showers, snowfall, hazard drivers, and heavy cargo load rule elevation banners; implemented automatic corridor camera fit-to-bounds with manual refit button, scale, fullscreen controls, and interactive map legend; wired route selection and hover callbacks into `Planner.jsx`.
- **Files touched:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/components/RouteMap.jsx`, `frontend/src/pages/Planner.jsx`, `PROGRESS.md`, `docs/LEARNING.md`.
- **How to verify:** Run `npm --prefix frontend run lint` (0 warnings), `npm --prefix frontend run build` (builds successfully), and `pytest backend` (113 passing). In browser: map renders dark matter style; 3 routes visible with selected route highlighted; checkpoints colored by risk level (green/yellow/orange/red/purple); clicking a checkpoint displays detail popup with weather, ETA, and load rule alert; clicking route selects it; fit-to-bounds automatically frames the corridor.

### Step 12 — Heatmap + 0–48h slider
- **What changed:** Built dedicated forecast timeline slider component (`components/HeatmapSlider.jsx`) with 0–48h range, 6-hour interval milestone marks, local timezone clock time formatting (`departure + h`), automated play/pause timeline animation, fast-forward/rewind/reset controls, `requestAnimationFrame` update throttling for 60fps drag performance, explicit distinction labels ("Area forecast at this time" vs "Weather at your ETA"), and on/off layer toggles; integrated MapLibre `heatmap` layer with density gradient matching our unified risk palette and zoom-interpolated radii; rendered corridor points styled by risk at the slider hour; all timeline calculations computed 100% client-side from the loaded series with zero network calls.
- **Files touched:** `frontend/src/components/HeatmapSlider.jsx`, `frontend/src/components/RouteMap.jsx`, `frontend/src/pages/Planner.jsx`, `PROGRESS.md`, `docs/LEARNING.md`.
- **How to verify:** Run `npm --prefix frontend run lint` (0 warnings), `npm --prefix frontend run build` (builds successfully), and `pytest backend` (113 passing). In browser: dragging the slider is smooth at 60fps with zero network requests (verifiable in Network DevTools tab); play button animates through 48 hours; heatmap overlay renders color gradient across the corridor; clicking heatmap point reveals area forecast popup; legend explicitly defines area forecast vs truck ETA.

### Step 13 — Checkpoint table + risk strip
- **What changed:** Implemented distance-proportional `RiskStrip` component where each segment width equals `(checkpoint.segment_miles / total_distance) * 100%` and is colored by its risk tier with interactive tooltips and camera focus click handlers; built responsive, sticky-header `CheckpointTable` guaranteed sorted ascending by mile, displaying mile, ETA, risk badge, wind speed, precipitation (rain/snow), hazard drivers, gross cargo load rule alerts, segment miles, and map focus action buttons; added instant risk filter chips ("All", "High / Severe", "Load Rule") and zero-CLS `TablePagination` (10, 25, 50, All); embedded mini `RiskStrip` in each `RouteCard` and integrated a clean bottom drawer tab switcher in `pages/Planner.jsx` enabling drivers to seamlessly toggle between the 0–48h timeline slider and the route checkpoints table with two-way map camera centering via MapLibre `flyTo`.
- **Files touched:** `frontend/src/components/RiskStrip.jsx`, `frontend/src/components/CheckpointTable.jsx`, `frontend/src/components/RouteCard.jsx`, `frontend/src/components/RouteMap.jsx`, `frontend/src/pages/Planner.jsx`, `PROGRESS.md`, `docs/LEARNING.md`.
- **How to verify:** Run `npm --prefix frontend run lint` (0 warnings), `npm --prefix frontend run build` (builds successfully), and `pytest backend` (113 passing). In browser: clicking any segment in the risk strip or clicking "Focus" on any table row smoothly flies the MapLibre camera to that exact checkpoint coordinate and opens its weather popup; table rows are strictly sorted ascending by mile; values match API data exactly; pagination and sticky header ensure zero cumulative layout shift (CLS).

### Step 14 — UX & visual polish
- **What changed:** Conducted a comprehensive design system and accessibility pass across the frontend: enforced strict 8px spacing, unified 8px border radius, and max 2 font weights (400 regular, 600 semi-bold) across MUI theme; integrated `prefers-reduced-motion` media query and universal `:focus-visible` accessibility indicators in `MuiCssBaseline`; created custom commercial truck and storm SVG favicon (`public/favicon.svg`), updated `index.html` with description/theme-color meta tags and `<title>WATR — Weather-Aware Truck Routing</title>`; built responsive mobile layout switcher in `ShellLayout.jsx` allowing phones and tablets (<900px) to seamlessly toggle between "Routes & Setup" and "Map & Weather" with automatic view transitions upon route calculation; added friendly "Server waking up…" cold-start chip and subtext in `AppHeader.jsx` and `TripForm.jsx` to gracefully communicate free-tier backend spin-up delays.
- **Files touched:** `frontend/index.html`, `frontend/public/favicon.svg`, `frontend/src/theme/theme.js`, `frontend/src/components/ShellLayout.jsx`, `frontend/src/components/AppHeader.jsx`, `frontend/src/components/TripForm.jsx`, `frontend/src/components/HeatmapSlider.jsx`, `frontend/src/pages/Planner.jsx`, `PROGRESS.md`, `docs/LEARNING.md`.
- **How to verify:** Run `npm --prefix frontend run lint` (0 warnings), `npm --prefix frontend run build` (builds cleanly), and `pytest backend` (113 passing). In browser: inspect at 375px (mobile), 768px (tablet), and 1440px (desktop)—all layouts align with zero overflow or crushed maps; tab navigation works on mobile; favicon renders in browser tab; focus outlines appear on keyboard tab navigation; motion honors `prefers-reduced-motion`.

### Step 15 — Docker, Redis (OPTIONAL), CI
- **What changed:** Containerized full application stack with production `backend/Dockerfile` (Python 3.12-slim, WhiteNoise collectstatic, Gunicorn WSGI workers, curl healthchecks) and multi-stage `frontend/Dockerfile` (Node 20 Vite build + Nginx alpine reverse proxy with SPA fallback and gzip compression); authored root `docker-compose.yml` linking backend, frontend, and healthchecked Redis service with shared bridge network and environment defaults; created `.dockerignore` files; added GitHub Actions CI pipeline (`.github/workflows/ci.yml`) running Ruff linter + Pytest with coverage on backend and ESLint + Vite production build on frontend.
- **Files touched:** `backend/Dockerfile`, `backend/.dockerignore`, `backend/requirements.txt`, `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/ci.yml`, `PROGRESS.md`.
- **How to verify:** Run `ruff check backend`, `pytest backend` (113 passed), `npm --prefix frontend run lint`, and `npm --prefix frontend run build`. Full stack can be launched via `docker compose up --build`.

### Step 16 — Deploy
- **What changed:** Deployed backend REST API on Render (`https://watr-spotter-asmt.onrender.com`) using Python 3 runtime, Gunicorn WSGI server, and CORS integration; deployed frontend on Vercel (`https://watr-spotter-asmt.vercel.app`) using Vite production preset with `vercel.json` SPA routing; solved production MapLibre Web Worker bundling by statically serving `maplibre-gl-worker.mjs` (518 KB) from `/` with `setWorkerUrl` and explicit `mapLib={maplibregl}` binding, enabling high-performance GPU GeoJSON route lines, checkpoint circles, and heatmap rendering on Vercel without silent worker failures.
- **Files touched:** `frontend/public/maplibre-gl-worker.mjs`, `frontend/src/components/RouteMap.jsx`, `frontend/vercel.json`, `backend/config/settings.py`, `PROGRESS.md`.
- **How to verify:** Query live backend health check `https://watr-spotter-asmt.onrender.com/api/health/` (200 OK); open live frontend `https://watr-spotter-asmt.vercel.app/` in browser; click "Try example trip" or search origin/destination and click "Calculate Safe Routes"; verify 3 candidate routes, colored route polylines, white checkpoint dots with risk halos, and 0-48h heatmap slider render smoothly on the map canvas.

### Step 17 — Documentation & Loom prep
- **What changed:** Authored comprehensive, industry-grade root `README.md` featuring live production deployment links, system architecture Mermaid workflow, quickstart 1-command Docker and 5-command native local setup, detailed 5-level risk engine and gross cargo rollover downgrade specifications, 5-tier lexicographical recommendation algorithm, interactive web UI walkthrough, API request/response documentation with worked payload examples, and testing commands; updated `docs/ARCHITECTURE.md` and `PROGRESS.md`.
- **Files touched:** `README.md`, `docs/ARCHITECTURE.md`, `PROGRESS.md`.
- **How to verify:** Inspect `README.md` in repository root; verify all Markdown links, Mermaid diagrams, code blocks, and math equations render correctly.




