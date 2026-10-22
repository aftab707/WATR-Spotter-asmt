# Project Progress — Weather-Aware Truck Routing

## Checklist

- [x] **Step 0 — Bootstrap & conventions**
- [ ] **Step 1 — API spike (prove the providers before building on them)**
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
