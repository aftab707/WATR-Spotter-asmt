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



