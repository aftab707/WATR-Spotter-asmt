# Learning Log & Interview Prep Notes

> Yeh document har step ke baad update hota hai Roman Urdu mein taake interview ke waqt architectural decisions aur technical details clear aur zabani yaad hon.

## Step 0 — Monorepo, Django Backend & React Frontend Setup

- **Kya banaya:** Humne ek monorepo initialize kiya jismein Django 5 REST Framework backend (`config`, `planner`), Vite + React 18 + MUI dark theme frontend, linting (Ruff, ESLint, Prettier), aur testing setup (pytest) shamil hain.
- **Kyun banaya:** Project ki solid foundation aur consistency ke liye — taake backend aur frontend clean folder structure mein alag rahen aur API contract pehle din se strictly typed aur verifiable ho.
- **Kaise kaam karta hai:** Backend pe `/api/health/` lightweight keep-alive endpoint hai jo bina external calls ke status ok return karta hai. Frontend Vite proxy ke zariye local dev mein backend se seamless connect karta hai aur MUI dark theme tokens ke sath render hota hai.
- **Interview mein kaise samjhaoge:** "Pehle step mein maine monorepo architecture establish ki jahan backend stateless DRF service hai aur frontend React 18 + Material UI design tokens use karta hai. Maine `/api/health/` keep-alive ping banaya jo cloud deployment (jaise Render/Railway) par cold starts aur uptime monitor karne mein help karega. Saath hi TypeScript ki jagah clean JavaScript + JSDoc type contracts configure kiye."


