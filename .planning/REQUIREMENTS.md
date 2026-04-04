# Requirements

## v1 Requirements

### Authentication
- [ ] **AUTH-01**: User can securely register for a new account.
- [ ] **AUTH-02**: User can log in with their credentials and receive a JWT session token.

### Trip Planning (Core)
- [ ] **TRIP-01**: User can input destination, duration, and budget to plan a trip.
- [ ] **TRIP-02**: System uses Gemini AI to generate a structured, day-by-day travel itinerary.

### Destinations & Ecosystem
- [ ] **DEST-01**: User can browse curated Indian destinations with tips.
- [ ] **TRAN-01**: User can search for transport options (flight/train/bus) between cities.
- [ ] **HOTL-01**: User can find hotel recommendations for specific cities.

### Bonus Features (Active additions)
- [ ] **FEAT-01**: User can view budget analysis charts for a graphical cost breakdown.
- [ ] **FEAT-02**: User can check live/mock weather for destinations.
- [ ] **FEAT-03**: User can click out to Google Maps for locations.

## v2 Requirements
- OAuth Authentication (Google Login)
- Social sharing of itineraries

## Phase 4 Requirements
- [x] **COMM-01**: Users can read and submit community reviews per destination with DB/local fallback resilience.
- [x] **PAY-01**: Users can trigger a premium checkout simulation before premium itinerary generation.

## Phase 5 Requirements
- [x] **UNI-01**: Users can select a mood route and receive mood-shaped day plans.
- [x] **UNI-02**: Users can compare transport options using a reality score and risk factors.
- [x] **UNI-03**: Users can view crowd + climate best-time windows per destination.
- [x] **UNI-04**: Users can enable family-friendly planning constraints in itinerary generation.
- [x] **UNI-05**: Users can recover a single disrupted day without regenerating the full itinerary.

## Phase 6 Requirements
- [ ] **INT-01**: Users can receive budget drift alerts with actionable correction suggestions.
- [ ] **INT-02**: Users can see explainable "why this day" notes with confidence.
- [ ] **INT-03**: Users can recover a 2-3 day range without regenerating the full itinerary.

## Out of Scope
- Direct booking and payments — Redirects to providers instead to minimize compliance risk.
- Non-Indian destinations — Strictly focusing on domestic India travel for quality density.

## Traceability

| Requirement | Planned Phase | Plan File |
|-------------|---------------|-----------|
| AUTH-01 | Phase 1 | `.planning/phases/01-core-auth/01-PLAN.md` |
| AUTH-02 | Phase 1 | `.planning/phases/01-core-auth/01-PLAN.md` |
| TRIP-01 | Phase 1 | `.planning/phases/01-core-auth/01-PLAN.md` |
| TRIP-02 | Phase 1 + Phase 3 | `.planning/phases/01-core-auth/01-PLAN.md`, `.planning/phases/03-v1-readiness/03-PLAN.md` |
| DEST-01 | Phase 1 | `.planning/phases/01-core-auth/01-PLAN.md` |
| TRAN-01 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` |
| HOTL-01 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` |
| FEAT-01 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` |
| FEAT-02 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` |
| FEAT-03 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` |
| COMM-01 | Phase 4 | `.planning/phases/04-community-payments/04-PLAN.md` |
| PAY-01 | Phase 4 | `.planning/phases/04-community-payments/04-PLAN.md` |
| UNI-01 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` |
| UNI-02 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` |
| UNI-03 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` |
| UNI-04 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` |
| UNI-05 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` |
| INT-01 | Phase 6 | `.planning/phases/06-intelligence-collab/06-PLAN.md` |
| INT-02 | Phase 6 | `.planning/phases/06-intelligence-collab/06-PLAN.md` |
| INT-03 | Phase 6 | `.planning/phases/06-intelligence-collab/06-PLAN.md` |

## Verification Tracker (v1)

Use this as the single execution sheet while validating requirements.

| Requirement | Status | Verified On | Evidence (file/test/API) | Notes |
|-------------|--------|-------------|---------------------------|-------|
| AUTH-01 | Done | 2026-04-01 | API smoke: POST /api/register => success; duplicate register => 400; code: server/routes.js (bcrypt.hash + duplicate guard) | Re-validated in M3 Day 2 smoke run (`REG_OK=True`, `DUP_STATUS=400`) |
| AUTH-02 | Done | 2026-04-01 | API smoke: POST /api/login => token returned; code: server/routes.js (bcrypt.compare + jwt.sign) | Re-validated in M3 Day 2 smoke run (`LOGIN_HAS_TOKEN=True`) |
| TRIP-01 | Done | 2026-04-01 | API smoke: POST /api/ai/plan with days and duration contracts; code: server/routes.js | Re-validated in M3 Day 2 smoke run (`PLAN_DAYS_DAY3=True`, `PLAN_DURATION_DAY4=True`) |
| TRIP-02 | Blocked | 2026-04-01 | Endpoint calls Gemini with model fallback chain in server/routes.js; runtime falls back when provider unavailable | M3 Day 2 rerun confirms fallback path (`PLAN_DAYS_FALLBACK=True`, `PLAN_DURATION_FALLBACK=True`); unblock requires active Gemini quota/billing |
| DEST-01 | Done | 2026-04-01 | API smoke: GET /api/destinations => expected dataset and required fields; frontend consumes via client/src/pages/Explore.jsx | Re-validated in M3 Day 2 smoke run (`DEST_COUNT=10`) |
| TRAN-01 | Done | 2026-04-01 | API smoke: GET /api/transport?from=Delhi&to=Mumbai; frontend integration in client/src/pages/Transport.jsx | Re-validated in M3 Day 2 smoke run (`TRAN_COUNT=3`) |
| HOTL-01 | Done | 2026-04-01 | API smoke: GET /api/hotels?city=Goa; frontend integration in client/src/pages/Explore.jsx | Re-validated in M3 Day 2 smoke run (`HOTEL_COUNT=3`) |
| FEAT-01 | Done | 2026-04-01 | Frontend build pass: npm.cmd run build; chart integration in client/src/pages/Budget.jsx (chart.js + Doughnut/Bar/Line) | Re-validated in M3 Day 2 build rerun (Vite build success) |
| FEAT-02 | Done | 2026-04-01 | API smoke: GET /api/weather/Goa; UI consumption in client/src/pages/Explore.jsx via axios.get('/api/weather/:city') | Re-validated in M3 Day 2 smoke run (`WEATHER_CITY=Goa`, `WEATHER_HAS_TEMP=True`) |
| FEAT-03 | Done | 2026-04-01 | Google Maps embed iframe present in client/src/pages/Explore.jsx using maps query URL for selected destination | Verified in prior UI/code checks; no regression observed during M3 Day 2 rerun |

Status values:
- Pending
- In Progress
- Done
- Blocked

## Verification Tracker (M4)

| Requirement | Status | Verified On | Evidence (file/test/API) | Notes |
|-------------|--------|-------------|---------------------------|-------|
| COMM-01 | Done | 2026-04-01 | Data/API: schema_update.sql + runtime smoke for GET/POST `/api/reviews` local fallback. UI: review list + submission form in client/src/pages/Explore.jsx; minimal styles in client/src/pages/Explore.css. Build: `npm.cmd run build` passed in client. | Day 1 and Day 2 complete with DB-fallback resilience and user submission UX |
| PAY-01 | Done | 2026-04-01 | API: POST `/api/checkout` returns success contract for valid payload and 400 for invalid payload. UI: premium toggle + checkout modal gating in client/src/pages/Planner.jsx and client/src/pages/Planner.css. Build: `npm.cmd run build` passed in client. | Premium itinerary generation now requires successful mock checkout (`premiumUnlocked` gate) while non-premium flow remains unchanged. |

## Verification Tracker (M5)

| Requirement | Status | Verified On | Evidence (file/test/API) | Notes |
|-------------|--------|-------------|---------------------------|-------|
| UNI-01 | Done | 2026-04-04 | API/UI: `moodRoute` support in `server/routes.js` `/api/ai/plan`; mood route selector + itinerary mood badge in `client/src/pages/Planner.jsx`; build: `npm.cmd run build` passed. | Itinerary prompts now include explicit mood-route guidance with fallback support. |
| UNI-02 | Done | 2026-04-04 | API/UI: `/api/transport` returns `realityScore` + `riskFactors` in `server/routes.js`; reliability pill + risk chips + sort in `client/src/pages/Transport.jsx`; build passed. | Users can sort by "Most reliable" and compare route risk signals at card level. |
| UNI-03 | Done | 2026-04-04 | API/UI: new `/api/crowd-windows/:city` in `server/routes.js`; window cards with "Best now" and low-confidence fallback label in `client/src/pages/Explore.jsx`; build passed. | Explore modal now surfaces actionable crowd+climate windows. |
| UNI-04 | Done | 2026-04-04 | API/UI: `familyFriendly` planner payload handled in `server/routes.js`; family-friendly toggle + "family adjusted" badge in `client/src/pages/Planner.jsx`; build passed. | Planner now injects low-friction constraints when family mode is enabled. |
| UNI-05 | Done | 2026-04-04 | API/UI: new `/api/ai/recover-day` endpoint in `server/routes.js`; "Recover this day" action + event modal in `client/src/pages/Planner.jsx`; build passed. | Single-day disruption recovery works without full itinerary regeneration. |

## Verification Tracker (M6)

| Requirement | Status | Verified On | Evidence (file/test/API) | Notes |
|-------------|--------|-------------|---------------------------|-------|
| INT-01 | Pending | - | - | Planned in Phase 6 plan Day 2-3 |
| INT-02 | Pending | - | - | Planned in Phase 6 plan Day 4-5 |
| INT-03 | Pending | - | - | Planned in Phase 6 plan Day 6-7 |
