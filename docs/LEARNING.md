# Learning Log & Interview Prep Notes

> Yeh document har step ke baad update hota hai Roman Urdu mein taake interview ke waqt architectural decisions aur technical details clear aur zabani yaad hon.

## Step 0 — Monorepo, Django Backend & React Frontend Setup

- **Kya banaya:** Humne ek monorepo initialize kiya jismein Django 5 REST Framework backend (`config`, `planner`), Vite + React 18 + MUI dark theme frontend, linting (Ruff, ESLint, Prettier), aur testing setup (pytest) shamil hain.
- **Kyun banaya:** Project ki solid foundation aur consistency ke liye — taake backend aur frontend clean folder structure mein alag rahen aur API contract pehle din se strictly typed aur verifiable ho.
- **Kaise kaam karta hai:** Backend pe `/api/health/` lightweight keep-alive endpoint hai jo bina external calls ke status ok return karta hai. Frontend Vite proxy ke zariye local dev mein backend se seamless connect karta hai aur MUI dark theme tokens ke sath render hota hai.
- **Interview mein kaise samjhaoge:** "Pehle step mein maine monorepo architecture establish ki jahan backend stateless DRF service hai aur frontend React 18 + Material UI design tokens use karta hai. Maine `/api/health/` keep-alive ping banaya jo cloud deployment (jaise Render/Railway) par cold starts aur uptime monitor karne mein help karega. Saath hi TypeScript ki jagah clean JavaScript + JSDoc type contracts configure kiye."

## Step 1 — API Spike & Provider Verification

- **Kya banaya:** Humne `backend/scripts/spike.py` script banayi jisne OSRM (routing), Photon aur Nominatim (geocoding), aur Open-Meteo (batch weather) APIs ko live call karke measure kiya aur unke raw responses fixtures directory mein save kiye.
- **Kyun banaya:** Taake providers ki real capabilities aur limitations code likhne se pehle prove ho sakein — taake baad mein unexpected breaking issues na aayen.
- **Kaise kaam karta hai:** Spike ne prove kiya ke public OSRM long trip par sirf 2 routes deta hai, isliye humein 3rd route ke liye via-waypoint offset generator banana padega. Geocoding mein Photon fast hai aur unstructured search mein rich results deta hai, jabke Open-Meteo batch mode mein ek call mein multiple coordinates ka 7 din (168 hours) ka hourly forecast mph aur inches mein reliably deta hai.
- **Interview mein kaise samjhaoge:** "Step 1 mein maine blind assumptions lene ke bajaye ek empirical API spike run kiya. Maine dekha ke OSRM sirf 2 alternatives return karta hai, jiski wajah se humne Section 3 mein perpendicular midpoint offset via-waypoint strategy validate ki. Saath hi Open-Meteo ke multi-coordinate batching ko verify kiya jahan 5 points ka data sirf 1 second mein bina API key ke aa gaya."

## Step 2 — Pure Risk Classification Engine & Boundary Testing

- **Kya banaya:** Humne `backend/planner/logic/risk.py` mein pure mathematical risk classification engine banaya jismein `RiskLevel` IntEnum (1 to 5), half-open wind bands `[25, 35)`, upper-inclusive rain/snow bands `(0.25, 0.50]`, aur truck load weight hazard rules shamil hain. Saath hi 42 parametrized unit tests likhe.
- **Kyun banaya:** Commercial routing aur safety evaluation mein ek decimal point ki ghalti ya galat boundary comparison driver ki jaan risk mein daal sakti hai. Is logic ko network aur database se bilkul alag (pure function) rakhna zaroori tha taake har boundary condition 100% deterministic test ho sake.
- **Kaise kaam karta hai:** Engine pehle teeno weather metrics (wind, rain, snow) ka individual level nikalta hai aur highest ko base risk banata hai. Phir load rules (>30,000 lb aur >40,000 lb par high wind) check hoti hain. Agar load rule risk ko badhata hai toh elevate karta hai, lekin yeh rule kabhi bhi weather risk ko kam (lower) nahi kar sakta.
- **Interview mein kaise samjhaoge:** "Risk engine ko maine purely functional pattern par build kiya hai: zero side-effects, zero external I/O. Maine half-open bands aur upper-inclusive bands ke exact mathematical edge cases handle kiye jaise 30,000 lb vs 30,001 lb ki strict boundary check. Code par 100% test coverage achieve ki gayi hai taake core safety logic production mein bilkul infallible rahe."

## Step 3 — Pure Geometry, ETA Progression, Segments & Route Summaries

- **Kya banaya:** Humne teen pure mathematical modules banaye: `geometry.py` (Haversine distance, uniform checkpoint sampling, RDP simplification), `eta.py` (monotonic ETA progression aur nearest forecast hour lookup), aur `summary.py` (midpoint segment allocation, per-level miles, aur distance-weighted risk average).
- **Kyun banaya:** Truck route corridors ko accurately divide karna zaroori tha taake driver ko pata chale ke uski gaari kis mile par kab pahuchegi aur kaunsa weather face karegi. Midpoint allocation isliye use ki taake severe weather ke miles mathematically total route distance ke barabar rahen aur koi float drift na aaye.
- **Kaise kaam karta hai:** `sample_checkpoints` 10/25/50 miles par checkpoints generate karta hai aur aakhri destination checkpoint ko ensure karta hai. `eta.py` speed profile se monotonic time interpolate karta hai jo kabhi backwards nahi jaata. `calculate_segment_miles` telescoping midpoint formula use karta hai jiska sum strictly route distance ke barabar hota hai.
- **Interview mein kaise samjhaoge:** "Step 3 mein maine core geospatial aur temporal math implement kiya. Maine Haversine formula aur Ramer-Douglas-Peucker (RDP) algorithm use karke 10,000+ points ki geometry ko 2,000 points se kam mein simplify kiya taake MapLibre frontend smooth 60fps par pan/zoom kare. Checkpoints ke liye midpoint Voronoi-style segment division implement ki jahan `sum(segment_miles) == route_distance` mathematical guarantee hai, aur ETA interpolation strictly monotonic hai."

## Step 4 — Open-Meteo Batch Weather Service & Caching

- **Kya banaya:** Humne `backend/planner/services/weather.py` mein Open-Meteo batch weather client banaya jo route corridor ke multiple coordinates ko <= 50 ke chunks mein divide karke parallel fetch karta hai, Django cache integration use karta hai, aur ETA matching ke liye `value_at(time)` provide karta hai.
- **Kyun banaya:** Agar 1,000-mile trip ke 40 checkpoints ke liye 40 separate HTTP calls ki jaateen toh app 15-20 seconds slow ho jaati aur rate-limit hit ho sakti thi. Batching aur chunking se 50+ checkpoints 1 second mein single parallel call se fetch ho jaate hain.
- **Kaise kaam karta hai:** Service pehle coordinates ko 2 decimal places tak round karke cache check karti hai (`make_weather_cache_key`). Jo points cache mein na hon, unhein 50-point batches mein `ThreadPoolExecutor` ke through Open-Meteo se fetch kiya jaata hai. Per-call 8s timeout aur 2 retries configured hain. Hourly arrays se `rain + showers` aur `snowfall` extract hoti hain aur `value_at()` truck ke exact ETA ka nearest hour lookup karta hai.
- **Interview mein kaise samjhaoge:** "Weather service ko production-grade performance ke liye design kiya gaya hai. Maine Open-Meteo ka multi-coordinate batching endpoint use kiya jismein chunks maximum 50 points ke banaye jaate hain taake URL length limit cross na ho, aur unhein `ThreadPoolExecutor` se parallel fetch kiya jata hai. Network I/O ko minimise karne ke liye spatial caching implement ki jo `(round(lat,2), round(lon,2), date-window)` par key banti hai, taake nearby checkpoints aur repeated searches zero-latency return hon."

## Step 5 — Routing Providers, Via-Waypoint Alternatives & Geocoding Endpoint

- **Kya banaya:** Humne routing aur geocoding services ko abstract interfaces ke peeche implement kiya (`services/routing.py`, `services/geocoding.py`). Isme Mapbox + OSRM routing, automatic provider fallback, perpendicular via-waypoint offset generator, geometry overlap de-duplication (>90%), aur cached `GET /api/geocode/` endpoint banaya.
- **Kyun banaya:** Public OSRM routing engine long trips par sirf 2 alternatives return karta hai jabke humein 3 distinct options chahiye the. Saath hi geocoding search ko robust banana tha taake Mapbox key na hone par Photon aur Nominatim se address autocomplete seamlessly chale bina application crash kiye.
- **Kaise kaam karta hai:** Agar routing provider se 3 se kam routes aate hain, toh routing engine Route 1 ke midpoint se perpendicular vector calculate karke offset waypoint banata hai aur uske through re-route karta hai. Agar naya route pehle se mojood route se >90% overlap karta hai toh discard ho jata hai warna add ho jata hai. Geocode endpoint query ko 24 hours ke liye cache karta hai aur max 6 clean results deta hai.
- **Interview mein kaise samjhaoge:** "Step 5 mein maine Adapter Pattern use karke routing aur geocoding providers ko decoupled banaya. OSRM ki 2-route limitation ko solve karne ke liye maine midpoint perpendicular offset algorithm likha jo mathematical waypoint projection se legitimate 3rd alternative generate karta hai, aur point-proximity buffer se duplicate (>90% overlap) routes ko prune karta hai. Geocoding endpoint Photon aur Nominatim ke automatic fallback ke sath fail-safe banaya gaya hai."







