# Project Progress — Weather-Aware Truck Routing

## Checklist

- [x] **Step 0 — Bootstrap & conventions**
- [x] **Step 1 — API spike (prove the providers before building on them)**
- [ ] **Step 2 — Risk engine (pure) + tests**
- [ ] **Step 3 — Geometry: sampling, ETA, segments, summaries (pure) + tests**
- [ ] **Step 4 — Weather service**
- [ ] **Step 5 — Routing + geocoding services**
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
