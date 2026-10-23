# WATR: Commercial Weather-Aware Truck Routing

[![Tests](https://img.shields.io/badge/tests-113%20passed-success)](file:///D:/WATR/backend/planner/tests)
[![Python](https://img.shields.io/badge/python-3.12-blue)](file:///D:/WATR/backend)
[![Django](https://img.shields.io/badge/django-5.0-green)](file:///D:/WATR/backend)
[![React](https://img.shields.io/badge/react-18.3-61dafb)](file:///D:/WATR/frontend)
[![MapLibre](https://img.shields.io/badge/maplibre--gl-v5-blueviolet)](file:///D:/WATR/frontend)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](file:///D:/WATR/LICENSE)

**WATR (Weather-Aware Truck Routing)** is an enterprise corridor intelligence system for long-haul freight operations. It calculates and evaluates multiple candidate highway routes between origin and destination, samples corridor checkpoints, queries high-resolution hourly weather forecasts aligned to the truck's cumulative time-of-arrival (ETA), applies DOT commercial rollover safety rules based on gross cargo load weight, and lexicographically ranks routes to recommend the safest path for commercial fleets.

---

## 🌐 Live Production Deployments

The system is deployed and active in production:

| Service | Environment | URL | Status Endpoint |
|---|---|---|---|
| **Frontend Web App** | Vercel (Edge CDN) | [https://watr-spotter-asmt.vercel.app](https://watr-spotter-asmt.vercel.app) | SPA Root |
| **Backend REST API** | Render (Docker Python 3.12) | [https://watr-spotter-asmt.onrender.com](https://watr-spotter-asmt.onrender.com) | [`GET /api/health/`](https://watr-spotter-asmt.onrender.com/api/health/) |

---

## 📐 Architecture & System Overview

WATR follows a strict decoupled, clean-architecture pattern. Heavy network I/O, geocoding, multi-route generation, and batch weather lookups are orchestrated on the backend, while all risk scoring, load downgrades, and ranking logic remain **100% pure functions** with zero external dependencies.

For complete architectural notes, spike benchmark logs, and provider trade-offs, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```mermaid
flowchart TD
    Client["React 18 SPA (Vite + MapLibre GL)"] -->|POST /api/plan/| API["Django REST Framework API"]
    API --> Orch["Corridor Orchestrator"]
    
    subgraph Parallel External Services
        Orch -->|1. Parallel Geocoding| Geocode["Photon / Nominatim OSM"]
        Orch -->|2. Multi-Route Engine| Routing["OSRM / Mapbox Directions + Via-Waypoint Generator"]
        Orch -->|3. Concurrent Batch Forecasts| Weather["Open-Meteo Multi-Coordinate API (<= 50 pts/chunk)"]
    end
    
    subgraph Pure Deterministic Logic
        Weather --> ETA["ETA Monotonic Interpolator"]
        ETA --> RiskEngine["Pure Risk Engine (Wind, Rain, Snow)"]
        RiskEngine --> LoadRules["Gross Cargo Weight Rollover Rules"]
        LoadRules --> SummaryEngine["Route Distance & Exposure Summarizer"]
        SummaryEngine --> Recommender["5-Tier Lexicographical Ranking Engine"]
    end
    
    Recommender --> API
    API -->|Ranked Routes + Heatmap Series| Client
```

---

## ⚡ Quickstart: Local Setup

### Option A: 1-Command Docker Compose (Recommended)
Clone the repository and spin up backend, frontend, and Redis caching in isolated containers:

```bash
git clone https://github.com/aftab707/WATR-Spotter-asmt.git
cd WATR
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api/health/`

---

### Option B: Native 5-Command Local Run

#### 1. Backend Setup (Terminal 1)
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | Unix: source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver 8000
```

#### 2. Frontend Setup (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛡️ Core Risk Engine & Rollover Safety Rules

WATR classifies each sampled route checkpoint into one of 5 distinct risk tiers based on sustained wind, precipitation rate, and snowfall accumulation.

### 1. Weather Hazard Thresholds

| Risk Level | Color Code | Sustained Wind (`wind_mph`) | Rain Accumulation (`rain_in_hr`) | Snowfall Rate (`snow_in_hr`) |
|:---|:---:|:---:|:---:|:---:|
| **1 - Low** | 🟢 Green | $0 \le v < 25\text{ mph}$ | $0.00 \le v < 0.10\text{ in/hr}$ | $0.00 \le v < 0.50\text{ in/hr}$ |
| **2 - Moderate** | 🟡 Yellow | $25 \le v < 35\text{ mph}$ | $0.10 \le v \le 0.25\text{ in/hr}$ | $0.50 \le v \le 1.00\text{ in/hr}$ |
| **3 - High** | 🟠 Orange | $35 \le v < 45\text{ mph}$ | $0.25 < v \le 0.50\text{ in/hr}$ | $1.00 < v \le 2.00\text{ in/hr}$ |
| **4 - Severe** | 🔴 Red | $45 \le v < 55\text{ mph}$ | $0.50 < v \le 1.00\text{ in/hr}$ | $2.00 < v \le 3.00\text{ in/hr}$ |
| **5 - No Travel** | 🟣 Purple | $v \ge 55\text{ mph}$ | $v > 1.00\text{ in/hr}$ | $v > 3.00\text{ in/hr}$ |

### 2. Commercial Vehicle Weight Downgrades
Empty and lightweight commercial trailers are highly vulnerable to catastrophic crosswind rollovers. WATR enforces strict load-based elevation rules:

- **Heavy / Loaded Trailers ($> 40,000\text{ lbs}$)**: Evaluated at standard wind thresholds.
- **Light Trailers ($\le 40,000\text{ lbs}$)**: Any sustained wind in the High band ($35 \le v < 45\text{ mph}$) is automatically elevated to **Severe (Level 4)**.
- **Empty / Bobtail Trailers ($\le 30,000\text{ lbs}$)**: Any sustained wind in the Severe band ($45 \le v < 55\text{ mph}$) is automatically elevated to **No Travel (Level 5)**.
- **Monotonic Safety Invariant**: Load rules **can only raise risk**, never lower it.

---

## 🏆 Recommendation Engine: 5-Tier Lexicographical Ranking

WATR avoids subjective scoring formulas by utilizing a strict deterministic sorting key:

$$\text{SortKey} = (\text{NoTravelMiles},\ \text{SevereMiles},\ \text{HighMiles},\ \text{AvgRiskScore},\ \text{DurationMinutes})$$

1. **Tier 1 (Safety Paramount)**: Lowest exposure miles in **No Travel (Level 5)**.
2. **Tier 2 (Severe Mitigation)**: Lowest exposure miles in **Severe (Level 4)**.
3. **Tier 3 (High Mitigation)**: Lowest exposure miles in **High (Level 3)**.
4. **Tier 4 (Distance-Weighted Risk)**: Lowest continuous average risk score across the trip:
   $$\bar{R} = \frac{\sum (R_i \times d_i)}{\sum d_i}$$
5. **Tier 5 (Efficiency)**: Shortest duration in minutes.

### Hard Safety Guarantee
- If a route encounters any **No Travel** conditions ($\text{NoTravelMiles} > 0$), it is disqualified from being recommended (`is_recommended: false`).
- If all candidate routes encounter **No Travel**, the engine marks all routes unrecommended and raises an explicit corridor hazard warning.

---

## 💻 Interactive Web Application Features

1. **Auto-Complete Geocoding**: Real-time address lookups powered by Photon/Nominatim with local caching and 350ms debounce.
2. **Route Visualizer**: MapLibre GL dark-gray canvas featuring WebGL line shaders with per-segment risk coloring and pure white checkpoint markers with risk halos.
3. **0–48 Hour Dynamic Forecast Heatmap**: Pre-calculated corridor weather matrix allows dispatchers to scrub forward in time to anticipate approaching storm fronts without making additional network calls.
4. **Interactive Checkpoint Table**: Sortable, filterable table detailing cumulative miles, truck ETA, primary/secondary weather drivers, and load elevation tags. Clicking any row pans and zooms the map directly to that coordinate.

---

## 📡 API Specification

### `POST /api/plan/`
Plans a multi-route trip, sampling corridor weather and returning ranked recommendations.

#### Sample Request:
```json
{
  "origin": "Chicago, IL",
  "destination": "Denver, CO",
  "departure_time": "2026-10-24T08:00:00Z",
  "load_weight_lb": 32000,
  "checkpoint_interval_miles": 25
}
```

#### Sample Response (Truncated):
```json
{
  "recommended_route_id": "route_1",
  "routes": [
    {
      "id": "route_1",
      "label": "I-80 W (via Des Moines)",
      "rank": 1,
      "is_recommended": true,
      "recommendation_reason": "Recommended: Avoids 48.5 mi of Severe weather vs fastest route.",
      "distance_miles": 1005.1,
      "duration_minutes": 985.0,
      "summary": {
        "avg_risk": 1.42,
        "miles_by_risk": {
          "low": 850.1,
          "moderate": 155.0,
          "high": 0.0,
          "severe": 0.0,
          "no_travel": 0.0
        }
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-87.6298, 41.8781], ...]
      },
      "checkpoints": [
        {
          "id": "cp_0",
          "mile": 0.0,
          "lat": 41.8781,
          "lon": -87.6298,
          "eta": "2026-10-24T08:00:00Z",
          "risk": 1,
          "risk_label": "LOW",
          "wind_mph": 12.4,
          "rain_in_hr": 0.0,
          "snow_in_hr": 0.0,
          "drivers": [],
          "load_rule_applied": false
        }
      ]
    }
  ]
}
```

---

## 🧪 Test Suite & Code Quality

```bash
# Backend unit & integration test suite (113 passing tests)
backend/.venv/Scripts/pytest backend -v

# Frontend linting (ESLint + strict rules)
cd frontend && npm run lint

# Frontend production bundle build
cd frontend && npm run build
```

---

## 📄 License
MIT License. Commercial use permitted.
