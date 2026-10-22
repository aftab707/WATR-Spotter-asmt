# PROJECT_SPEC.md — Weather-Aware Truck Routing (React + MUI + Django DRF)

> **Audience:** any AI coding agent (Claude Code, Cursor, Antigravity, etc.) and the human developer (Aftab).
> **This is a job-application take-home for Spotter AI** (Remote FullStack Engineer — React + Django). Quality bar = "production-ready, fast, pixel-careful".
Use JavaScript (.jsx), NOT TypeScript. Wherever the spec says TypeScript or .ts/.tsx, use JS/.jsx instead. Document the API response shape with JSDoc comments in src/api/types.js.
---

## 0. AGENT OPERATING RULES (read first, obey always)

1. **Work ONE step at a time** (Section 7). Do not start step N+1 until step N's *Acceptance* checks pass and the human says `next`.
2. **Context discipline:** each session read only Sections 0–6 + the *current* step. Do not re-read or implement future steps.
3. **No scope creep.** Spec says: *"Prioritize correctness and clarity over extra features."* Anything not in this file = ask first. Optional items are marked `OPTIONAL`.
4. **Locked decisions (Section 3) are final.** If something is ambiguous, use the documented assumption — do not silently invent a new one. If you must deviate, stop and explain.
5. **Tests first for logic** (risk, sampling, ETA, recommendation). Business logic = pure functions, no I/O, fully unit-tested.
6. **Readable code over clever code.** The human must be able to explain every file in an interview: small functions, type hints/TS types, docstrings explaining *why*, no metaprogramming, no unexplained magic numbers (use named constants).
7. **After every step, in this exact order:**
   a. Run tests/lint/build; fix failures.
   b. Tick the step in `PROGRESS.md` and add 3 lines: what changed, files touched, how to verify.
   c. Append to `docs/LEARNING.md` a **Roman Urdu** section (5–8 lines): kya banaya, kyun banaya, kaise kaam karta hai, interview mein kaise samjhaoge.
   d. Make one git commit (`feat(step-N): ...`).
   e. Print a short summary and **STOP**.
8. **Never commit secrets.** Keys live in `.env` (gitignored) + `.env.example` with placeholders.
9. **Never fake data in production paths.** Mock fixtures are allowed only behind `VITE_USE_MOCK=true`.
10. Resuming in a new chat? Paste this: *"Read PROJECT_SPEC.md Sections 0–6 and PROGRESS.md. Continue with the first unchecked step only."*

---

## 1. THE TASK (source of truth — from Spotter's PDF)

Build a **React + Django** web app that helps a truck driver choose the safest route based on **weather, load weight, and travel time**.

**User inputs:** origin & destination · departure date/time · load weight.

**App must:**
- Generate **3 route options** via a routing API (no custom routing engine).
- Sample weather every **10 / 25 / 50 miles** using the truck's **ETA at each checkpoint**.
- Compute weather risk using the risk + load rules below.
- **Recommend the best route**, balancing weather risk and travel time.
- Show **all routes, checkpoints, risk levels, ETAs, route summaries on a map**.
- Show a **weather heatmap along the trip corridor** with a **0–48 hour forecast slider**.

**Risk thresholds (per checkpoint):**

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | <25 | 25–34 | 35–44 | 45–54 | ≥55 |
| Rain (in/hr) | <0.10 | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | >1.00 |
| Snow (in/hr) | <0.5 | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | >3.0 |

**Load rules:**
- wind ≥55 mph → **No Travel** for any load
- wind 45–54 mph AND load >30,000 lb → **No Travel**
- wind 35–44 mph AND load >40,000 lb → **Severe**

**Recommendation preference order:** 1) fewest Severe miles 2) fewest High miles 3) lowest average risk 4) shortest travel time.

**Deliverables:** GitHub repo · hosted app · 5–10 min Loom.
**Grading:** 40% routes/weather/risk/recommendation logic · 40% UI, map & heatmap smoothness/performance · 15% code quality · 5% docs & walkthrough.

**Job post signals to satisfy** (they read the code with this lens): **React + Material UI (MUI)**; attention to alignment/spacing/feel; DRF REST API; non-trivial scoring/ranking logic surfaced in the UI; performance instincts (query behaviour, caching); bonus: Redis, Docker, AI-assisted workflow, shipped-product mindset.

---

## 2. LESSONS FROM 20 OTHER SUBMISSIONS (evaluator sheet, similar Spotter task)

Graders scored: logic accuracy, UI aesthetics, UX, bugs. What killed submissions → our rule:

| What failed | Our rule |
|---|---|
| ~40% had backend down / 500 / "Failed to fetch" | Reliable host, `/api/health/`, keep-alive, warm-up call, graceful errors, tested in incognito |
| Map API key missing/expired (watermark) | Basemap needs **no key**; paid keys only server-side; fallbacks exist |
| Forced login/signup | **No auth. No landing gate.** Form is the first screen |
| Geocoder failed on step 1 | Provider fallback + caching + friendly error |
| Rules violated / wrong numbers | Pure risk engine with boundary tests |
| Data lost on backend restart | Core flow is **stateless**; no DB dependency for a plan |
| Basic/outdated UI | Premium dark MUI dashboard, consistent spacing |
| Top scorers | Correct rules + works first click + polished dark UI + clear timeline |

---

## 3. LOCKED DECISIONS & ASSUMPTIONS (document all of them in README)

**Stack**
- Frontend: React 18 + Vite + TypeScript, **MUI v5+ (dark theme)**, `@mui/x-date-pickers` + dayjs, TanStack Query, `react-map-gl` (MapLibre) for map + heatmap.
- Backend: Python 3.11+, Django 5 + Django REST Framework, `requests`, `concurrent.futures.ThreadPoolExecutor`, `pytest`, `requests-mock`, `ruff`, `gunicorn`, `whitenoise`, `django-cors-headers`.
- Repo: monorepo `/backend`, `/frontend`, `/docs`.

**Providers (behind interfaces so they are swappable)**
- Weather: **Open-Meteo** (no key). Hourly: `wind_speed_10m`, `rain`, `showers`, `snowfall`; params `wind_speed_unit=mph`, `precipitation_unit=inch`, `timezone=UTC`. Batch many coordinates per call (chunks of ≤50).
- Routing: primary **Mapbox Directions** (`driving`, `alternatives=true`, `geometries=geojson`, `overview=full`) — token **server-side only**. Fallback: **OSRM** (`alternatives=3`). If fewer than 3 distinct routes come back, create extra alternatives via a **via-waypoint offset** (perpendicular offset from the route midpoint, re-route through it) and drop routes sharing >90% of geometry. If truly fewer than 3 distinct routes exist, return what exists + a warning.
  - Step 1 (API spike) must verify on a long trip (e.g. Chicago → Denver) which provider really returns alternatives. If Mapbox is unavailable, OSRM + via-waypoint is the default.
  - Note in README: car profile used, not a truck (HGV) profile — known limitation.
- Geocoding: Mapbox Geocoding if token set, else **Photon** (komoot) with **Nominatim** as backup (set a `User-Agent`, ≤1 req/s).
- Basemap: free no-key vector style (CARTO dark-matter GL style) with an OSM raster fallback. Attribution visible.

**Domain assumptions**
- Units: miles, minutes, lb, mph, in/hr. Risk scores: LOW=1, MODERATE=2, HIGH=3, SEVERE=4, NO_TRAVEL=5.
- **Boundaries:** wind uses half-open bands `[25,35) [35,45) [45,55) [55,∞)`. Rain/snow use **upper-inclusive** bands (e.g. rain 0.25 → Moderate, 0.2501 → High; rain 1.00 → Severe, >1.00 → No Travel). Below the Moderate floor = Low (`rain <0.10`, `snow <0.5`).
- Checkpoint risk = **max(wind, rain, snow)** levels, then load rules can only **raise** it, never lower it.
- Load comparisons are **strict**: exactly 30,000 lb does NOT trigger the >30,000 rule.
- Wind = sustained `wind_speed_10m` (gusts not used; mention in README).
- Snow = Open-Meteo `snowfall` in inches/hr (snow depth increment), rain = `rain + showers`.
- Checkpoints at miles `0, N, 2N, …` plus the final point at total distance. `N` ∈ {10, 25, 50}, default 25, user-selectable.
- **ETA at mile d** = departure + time at d, via linear interpolation over the route's (cumulative distance, cumulative duration) data; fallback = constant average speed. Weather value = nearest forecast hour to the ETA.
- **Segment miles per checkpoint:** from midpoint with previous checkpoint to midpoint with next (first starts at 0, last ends at total). Severe/High miles = sum of segment miles by level. Segment miles must sum to route distance (test it).
- **Average risk** = distance-weighted mean of risk scores (1–5).
- **Recommendation** = sort key `(no_travel_miles, severe_miles, high_miles, avg_risk, duration_min)` ascending, with miles rounded to 0.1 and avg risk to 0.01 to avoid float noise. Any route with `no_travel_miles > 0` is flagged "Not recommended"; if all have it, still rank them and warn. Provide a human-readable `recommendation_reason` comparing against the fastest route (e.g. "+25 min vs fastest, 40 fewer Severe miles").
- **Heatmap slider** = hours **after departure** (0–48). Value at hour *h* = forecast at that location at `departure + h` (area weather). Checkpoint cards = weather at the truck's **ETA**. Label these two differently in the UI.
- Validation: departure must be within `[now − 1h, now + 7 days]` (forecast availability) else HTTP 422 with a clear message. Load weight: integer, 1–120,000 lb.

---

## 4. ARCHITECTURE

```
backend/
  config/                  # Django settings (env-driven), urls
  planner/
    views.py               # thin: validate → call service → respond
    serializers.py         # request validation + response shape
    services/
      geocoding.py         # provider interface + Mapbox/Photon/Nominatim
      routing.py           # provider interface + Mapbox/OSRM + via-waypoint alternatives
      weather.py           # Open-Meteo batch client + cache
      orchestrator.py      # plan_trip(): glue, parallelism, warnings
    logic/                 # PURE functions (no network, no Django)
      risk.py              # classify wind/rain/snow, apply load rules
      geometry.py          # haversine, cumulative distance, sampling, simplify
      eta.py               # distance→time interpolation
      summary.py           # segment miles, per-level miles, avg risk
      recommend.py         # ranking + reason text
    tests/
frontend/
  src/
    api/                   # typed client + TanStack Query hooks + mock fixture
    theme/                 # MUI theme tokens
    components/            # TripForm, RouteCard, RouteMap, HeatmapSlider, CheckpointTable, RiskStrip, ...
    pages/Planner.tsx
    lib/                   # risk colors/labels, formatters
docs/  LEARNING.md  ARCHITECTURE.md  (diagram)
PROGRESS.md   README.md   docker-compose.yml   .github/workflows/ci.yml
```

**Request flow:** `POST /api/plan/` → validate → routing (≤3 routes) → sample checkpoints per route → **one batched, cached, parallel weather fetch** for the union of points → per checkpoint pick ETA-hour weather → risk → summaries → recommend → build heatmap series (49 hourly risk values per point, via the same risk engine with the same load weight) → JSON.

---

## 5. API CONTRACT

**`GET /api/health/`** → `{ "status": "ok" }` (no external calls; used for keep-alive).

**`GET /api/geocode/?q=chicago`** → `{ "results": [{ "label": "Chicago, IL, USA", "lat": 41.88, "lon": -87.63 }] }` (max 6, US-biased, cached).

**`POST /api/plan/`**
```json
{
  "origin": { "label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298 },
  "destination": { "label": "Denver, CO", "lat": 39.7392, "lon": -104.9903 },
  "departure_time": "2026-11-02T08:00:00-06:00",
  "load_weight_lb": 42000,
  "sampling_interval_miles": 25
}
```
**Response 200**
```json
{
  "meta": { "generated_at": "...", "departure_time": "...", "load_weight_lb": 42000,
            "sampling_interval_miles": 25, "weather_source": "open-meteo", "warnings": [] },
  "recommended_route_id": "r2",
  "routes": [{
    "id": "r1", "label": "Route A", "rank": 2, "is_recommended": false,
    "distance_miles": 1003.4, "duration_minutes": 905, "arrival_time": "...",
    "geometry": { "type": "LineString", "coordinates": [[-87.63, 41.88], "..."] },
    "summary": { "no_travel_miles": 0, "severe_miles": 12.5, "high_miles": 60.0,
                 "moderate_miles": 200.0, "low_miles": 730.9, "avg_risk": 1.74,
                 "max_risk": 4, "max_risk_label": "SEVERE" },
    "recommendation_reason": "…",
    "checkpoints": [{ "index": 0, "mile": 0, "lat": 41.88, "lon": -87.63, "eta": "...",
                      "risk": 2, "risk_label": "MODERATE", "wind_mph": 27.1,
                      "rain_in_hr": 0.0, "snow_in_hr": 0.0, "drivers": ["wind"],
                      "load_rule_applied": false, "segment_miles": 12.5 }]
  }],
  "heatmap": { "hours": [0,1,"...",48],
               "points": [{ "lat": 41.9, "lon": -88.1, "route_ids": ["r1","r2"], "risk": [1,1,2,"…49 values"] }] }
}
```
**Errors:** `422` `{ "error": "validation", "fields": {...} }` · `502` `{ "error": "upstream", "message": "Weather service unavailable, try again" }` · `504` on overall timeout. Never return an HTML error page or a stack trace.

Backend rules: per-call timeout 8 s, 2 retries with backoff, overall budget ≈ 25 s; DRF throttle (e.g. 30/min per IP); cache weather by `(round(lat,2), round(lon,2), date-window)` and geocode by query; use Redis if `REDIS_URL` is set, else local-memory cache.

---

## 6. RISK ENGINE & TEST MATRIX (Step 2 must implement exactly this)

Signature idea: `classify_checkpoint(wind_mph, rain_in_hr, snow_in_hr, load_lb) -> RiskResult(level, drivers, load_rule_applied)`.

Minimum parametrized tests:
- Wind: 24.9→LOW, 25→MOD, 34.9→MOD, 35→HIGH, 44.9→HIGH, 45→SEVERE, 54.9→SEVERE, 55→NO_TRAVEL (light load).
- Rain: 0.09→LOW, 0.10→MOD, 0.25→MOD, 0.26→HIGH, 0.50→HIGH, 0.51→SEVERE, 1.00→SEVERE, 1.01→NO_TRAVEL.
- Snow: 0.49→LOW, 0.5→MOD, 1.0→MOD, 1.1→HIGH, 2.0→HIGH, 2.1→SEVERE, 3.0→SEVERE, 3.1→NO_TRAVEL.
- Load rules: wind 50 with 30,000→SEVERE; 30,001→NO_TRAVEL; wind 40 with 40,000→HIGH; 40,001→SEVERE; wind 60 with 1,000→NO_TRAVEL; rule never lowers (wind 40 + rain severe + 41,000 → stays SEVERE; rain NO_TRAVEL stays NO_TRAVEL).
- Combined: highest of three wins; `drivers` lists which conditions produced the max.

---

## 7. STEPS (execute sequentially; STOP after each)

### Step 0 — Bootstrap & conventions
- Create monorepo, `backend` (Django project `config`, app `planner`, DRF, CORS, env settings), `frontend` (Vite React TS + MUI), `.gitignore`, `.env.example` (backend & frontend), `PROGRESS.md` (checklist of all steps), `docs/LEARNING.md`, ruff + eslint/prettier config.
- **Accept:** `GET /api/health/` works locally; frontend dev server shows a themed MUI page; lint passes.

### Step 1 — API spike (prove the providers before building on them)
- Script `backend/scripts/spike.py`: call routing (Chicago→Denver and a short city pair), geocoding, Open-Meteo batch (5 points). Save raw JSON to `backend/planner/tests/fixtures/`.
- Print: how many routes each provider returns, latency, units of weather fields.
- **Accept:** written findings in `docs/ARCHITECTURE.md` ("Provider decisions"); fixtures saved. Adjust Section 3 provider choice only if spike proves it necessary (explain).

### Step 2 — Risk engine (pure) + tests
- Implement `logic/risk.py` per Sections 3 & 6 with enums/constants, no magic numbers.
- **Accept:** full Section 6 matrix passes; 100% coverage of `risk.py`.

### Step 3 — Geometry: sampling, ETA, segments, summaries (pure) + tests
- `geometry.py` (haversine, cumulative miles scaled to provider distance, sample at interval, polyline simplification for display ≤ ~2000 pts), `eta.py`, `summary.py`.
- **Accept:** tests: 100-mile straight line @25 → miles `[0,25,50,75,100]`; non-multiple distance adds a final point; ETA monotonic and correct; segment miles sum == distance; weighted avg risk correct on hand-made data.

### Step 4 — Weather service
- `services/weather.py`: batch client (chunks ≤50, parallel), parse hourly arrays, `value_at(time)` nearest-hour lookup, cache, timeouts/retries, error → `UpstreamError`.
- **Accept:** tests with `requests-mock` + saved fixture: unit conversions, chunking, cache hit avoids second call, failure raises clean error.

### Step 5 — Routing + geocoding services
- Provider interfaces, Mapbox + OSRM, fallback logic, via-waypoint alternative generator, overlap de-duplication, ≤3 routes; geocode endpoint.
- **Accept:** mocked tests: provider failure falls back; <3 routes triggers alternatives; duplicates removed; `/api/geocode/` returns max 6 results.

### Step 6 — Recommendation engine (pure) + tests
- `recommend.py`: sort key from Section 3, flags, `recommendation_reason` text.
- **Accept:** tests for each tie-break level (a route wins on Severe even if slower; High breaks Severe ties; avg risk breaks High ties; time breaks all); No-Travel route not recommended; all-No-Travel warning.

### Step 7 — `/api/plan/` orchestrator
- Serializers/validation, `plan_trip()` (parallel where useful), heatmap series via the same risk engine, warnings (fewer routes, beyond-forecast, etc.), error mapping, throttle.
- **Accept:** contract test returns Section 5 shape using mocked providers; invalid input → 422 with field errors; upstream failure → 502 JSON; export a realistic response to `frontend/src/api/fixtures/plan.json` (used by mock mode).

### Step 8 — Frontend foundation
- MUI dark theme tokens (spacing scale 8px, one radius, type scale, risk palette: Low green, Moderate yellow, High orange, Severe red, No Travel dark red/purple — never color-only: also text/icon), typed API client (types mirror Section 5), TanStack Query, `VITE_USE_MOCK`, app shell layout (left panel, map area, bottom/side panel), `/api/health/` warm-up call on load.
- **Accept:** app renders shell with mock data; no console errors.

### Step 9 — Trip form
- Origin/destination `Autocomplete` (debounced 300 ms, loading/empty/error states), `DateTimePicker` (bounded by validation rule), load weight field (lb, validated), interval selector (10/25/50), **"Try example trip"** button (pre-fills a real long trip), submit with disabled/loading state.
- **Accept:** invalid input shows inline errors; example button works in one click; keyboard accessible.

### Step 10 — Results: route cards + recommendation
- Cards for each route: distance, duration, arrival, Severe/High miles, avg risk, risk chip, "Recommended" badge, short **"Why this route"** text; select/hover syncs with map; compare view of fastest vs recommended trade-off.
- **Accept:** matches API data exactly; recommended route visually obvious; skeletons while loading; clear error/empty states.

### Step 11 — Map: routes + checkpoints
- MapLibre map, 3 distinguishable route lines (selected is emphasized), checkpoint markers colored by risk, popup with ETA + wind/rain/snow + risk + "load rule applied", fit-to-bounds, legend, attribution.
- **Accept:** smooth pan/zoom with 300+ checkpoints; no layer re-creation on state change (use sources + `setData`); works on mobile width.

### Step 12 — Heatmap + 0–48h slider
- MapLibre `heatmap` layer (weight from risk) plus corridor line colored by risk at the slider hour; MUI `Slider` 0–48 (marks every 6 h, shows clock time = departure + h), play/pause; toggle heatmap on/off. **All slider changes computed client-side from the already-loaded series — no network calls.** Throttle updates with `requestAnimationFrame`.
- **Accept:** dragging the slider is smooth (no jank, no refetch); legend explains colors; label states "Area forecast at this time" vs checkpoints "Weather at your ETA".

### Step 13 — Checkpoint table + risk strip
- Per-route checkpoint table (paginated or virtualized): mile, ETA, wind, rain, snow, risk, drivers. **Risk strip** (distance-proportional colored bar per route) for at-a-glance comparison; clicking focuses the map.
- **Accept:** sorted by mile, values equal API, no layout shift.

### Step 14 — UX & visual polish
- Pass over alignment/spacing/typography; responsive layout (mobile, tablet, desktop); empty/loading/error/offline-backend ("Server waking up…") states; focus rings, aria-labels, contrast; favicon/title; `prefers-reduced-motion`.
- **Accept:** Lighthouse performance/accessibility reasonable (no red); screenshots at 3 widths look aligned.

### Step 15 — Docker, Redis (OPTIONAL), CI
- `docker-compose.yml` (backend, frontend, optional redis), backend Dockerfile (gunicorn), GitHub Actions: backend ruff + pytest, frontend lint + build.
- **Accept:** `docker compose up` runs the full app; CI green.

### Step 16 — Deploy
- Frontend → Vercel (`VITE_API_BASE_URL`). Backend → a host with an always-on or quickly-waking instance (Render/Railway/Koyeb — verify current free-tier behaviour). Settings: `DEBUG=False`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, secrets via env, whitenoise, gunicorn. Add external uptime ping to `/api/health/` every ≤5 min.
- Avoid hosts that whitelist outbound domains (Open-Meteo must be reachable).
- **Accept:** from an incognito window and a phone: example trip works end-to-end; re-test after 1 hour idle; no CORS errors; no console errors.

### Step 17 — Documentation & Loom prep
- `README.md`: overview + screenshot/GIF, live link, run locally (5 commands), env vars, architecture diagram, **risk table + every assumption from Section 3**, recommendation algorithm explained with one worked example, performance notes (single batch fetch, caching, client-side slider), limitations, "built with AI assistants" note, how to run tests.
- `docs/LOOM_SCRIPT.md`: 7-minute script: 0:00 intro (30 s) · 0:30 live demo with example trip (2 min) · 2:30 risk rules + one worked checkpoint (2 min) · 4:30 architecture & performance (1.5 min) · 6:00 trade-offs & what next (1 min).
- **Accept:** a stranger can run the project from the README alone.

### Step 18 — Final QA (do not skip)
Checklist — all must be ✅:
- [ ] Exactly the spec'd inputs; 3 routes shown (or warning if impossible)
- [ ] Sampling interval 10/25/50 each tested
- [ ] ETA-based weather (change departure → results change)
- [ ] Boundary tests green; load-rule scenarios verified manually (e.g. 31k lb vs 29k lb with 50 mph wind)
- [ ] Recommended route follows the 4-level order; reason text correct
- [ ] Heatmap + slider smooth; no network call on slider move
- [ ] Hosted app works in incognito + mobile + after idle; `/api/health/` live
- [ ] Repo clean: no secrets, `.env.example` complete, CI green, README complete
- [ ] Loom recorded (5–10 min) and link added to README

### Step 19 — OPTIONAL (only if everything above is done)
`TripPlan` model + `GET /api/plans/{id}/` for shareable links (Postgres via `DATABASE_URL`; core flow must keep working without it).

---

## 8. UI/UX QUALITY BAR (the "attention to detail" screen)
- One spacing scale (multiples of 8), one border radius, max 2 font weights, consistent icon set (MUI icons).
- Risk colors identical everywhere (chips, markers, strip, heatmap legend) — defined once in `lib/risk.ts`.
- Numbers formatted consistently (miles 1 decimal, mph integer, in/hr 2 decimals, times in the user's local timezone with the zone shown).
- Every async region has loading, empty, and error states. No layout jumps.
- First screen = the form + map. **No login, no landing page.**

## 9. PERFORMANCE RULES
- One weather batch call per plan (chunked), parallel, cached; no per-checkpoint requests.
- Cap checkpoints sensibly (very long routes → warn or auto-raise interval, document it).
- Simplify route geometry for display; keep full precision only for distance math.
- Frontend: memoize derived data; map layers updated via `setData`; slider handled client-side; no unnecessary re-renders (React DevTools check).

## 10. DEFINITION OF DONE
All steps ticked in `PROGRESS.md`, Section 18 checklist ✅, hosted link verified, README + LEARNING.md complete, human can explain every module without the AI.
