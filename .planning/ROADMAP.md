# Roadmap

## Execution Roadmap (v1 + post-v1)

**6 phases** | **20 total requirements mapped (v1 + Phase 4 + Phase 5 + Phase 6)** | **Current focus: Phase 5 closure and Phase 6 kickoff prep**

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 1 | Core & Auth | Finalize authentication, destination browsing, and basic AI trip generation. | AUTH-01, AUTH-02, TRIP-01, TRIP-02, DEST-01 |
| 2 | Ecosystem & Bonus | Complete transport, hotels, and bonus integrations (Weather, Charts, Maps). | TRAN-01, HOTL-01, FEAT-01, FEAT-02, FEAT-03 |
| 3 | v1 Readiness Gate | Close v1 with full traceability, smoke validation, and gate decision. | AUTH-01, AUTH-02, TRIP-01, TRIP-02, DEST-01, TRAN-01, HOTL-01, FEAT-01, FEAT-02, FEAT-03 |
| 4 | Community & Payments | Deliver social reviews and premium checkout simulation with planner gating. | COMM-01, PAY-01 |
| 5 | Unique Experience Engine | Deliver differentiation features for planning quality, reliability, and recovery workflows. | UNI-01, UNI-02, UNI-03, UNI-04, UNI-05 |
| 6 | Intelligence & Collaboration Layer | Add proactive guidance and explainable decisioning for budget and recovery workflows. | INT-01, INT-02, INT-03 |

## Current Status

- Phase 1 status: Closed with external blocker (TRIP-02 Gemini quota dependency)
- Phase 2 status: Verified complete for mapped requirements (TRAN-01, HOTL-01, FEAT-01/02/03)
- Phase 3 status: Closed with external blocker after Day 2 rerun + Day 3 gate decision
- Phase 4 status: Passed (COMM-01 and PAY-01 complete)
- Phase 5 status: Active (M5 planning complete, execution starting)
- Phase 6 status: Planned (M6 mini-plan drafted)
- Release target: v1 freeze pending TRIP-02 unblock (Gemini quota/billing restoration)

## Milestones

### M1 - Core API Stability
Target: 2026-04-05
Scope:
1. Confirm registration/login behavior (hashing, token issuance, duplicate-email handling).
2. Confirm AI plan generation request/response contract.
3. Confirm destination browse endpoint data shape and fallback behavior.
Exit criteria:
1. AUTH-01, AUTH-02, TRIP-01, TRIP-02, DEST-01 verified end-to-end.
2. No P1/P2 defects in auth and planner API paths.

### M2 - Ecosystem Integration Closure
Target: 2026-04-09
Scope:
1. Transport and hotels flow validated with backend fallback paths.
2. Budget chart and optimizer persistence behavior validated.
3. Weather and maps integration validated in destination exploration flow.
Exit criteria:
1. TRAN-01, HOTL-01, FEAT-01, FEAT-02, FEAT-03 verified end-to-end.
2. UI integration checks pass on desktop and mobile breakpoints.

### M3 - v1 Readiness Gate
Target: 2026-04-11
Scope:
1. Requirement checklist sweep and traceability audit.
2. Smoke test critical user journeys (register -> login -> plan -> explore -> budget -> transport/hotel).
3. Update planning docs for v1 closure and v2 handoff.
Exit criteria:
1. All v1 requirements marked done.
2. `.planning/STATE.md` updated to next phase context.

## Requirement Traceability

| Requirement | Planned Phase | Primary Plan File | Verification Artifact |
|-------------|---------------|-------------------|-----------------------|
| AUTH-01 | Phase 1 | `.planning/phases/01-core-auth/01-PLAN.md` | Auth register endpoint check |
| AUTH-02 | Phase 1 | `.planning/phases/01-core-auth/01-PLAN.md` | Auth login + JWT check |
| TRIP-01 | Phase 1 | `.planning/phases/01-core-auth/01-PLAN.md` | Planner request contract check |
| TRIP-02 | Phase 1 + Phase 3 | `.planning/phases/01-core-auth/01-PLAN.md`, `.planning/phases/03-v1-readiness/03-PLAN.md` | Gemini itinerary response check + blocker disposition |
| DEST-01 | Phase 1 | `.planning/phases/01-core-auth/01-PLAN.md` | Destination list endpoint check |
| TRAN-01 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` | Transport query integration check |
| HOTL-01 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` | Hotel listings integration check |
| FEAT-01 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` | Budget chart rendering check |
| FEAT-02 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` | Weather data integration check |
| FEAT-03 | Phase 2 | `.planning/phases/02-ecosystem-bonus/02-PLAN.md` | Maps link/embed integration check |
| COMM-01 | Phase 4 | `.planning/phases/04-community-payments/04-PLAN.md` | Reviews API + Explore submission UX |
| PAY-01 | Phase 4 | `.planning/phases/04-community-payments/04-PLAN.md` | Checkout contract + premium planner gate |
| UNI-01 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` | Mood route itinerary shaping check |
| UNI-02 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` | Transport reliability score check |
| UNI-03 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` | Crowd-climate window integration check |
| UNI-04 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` | Family-friendly itinerary adaptation check |
| UNI-05 | Phase 5 | `.planning/phases/05-unique-experience/05-PLAN.md` | Recover-day endpoint + UI workflow check |
| INT-01 | Phase 6 | `.planning/phases/06-intelligence-collab/06-PLAN.md` | Budget drift alert and correction check |
| INT-02 | Phase 6 | `.planning/phases/06-intelligence-collab/06-PLAN.md` | Day-level decision note and confidence check |
| INT-03 | Phase 6 | `.planning/phases/06-intelligence-collab/06-PLAN.md` | Multi-day recovery segment replacement check |

## Success Criteria (v1)

1. Users can register and log in successfully.
2. Users can generate and view day-by-day AI itineraries.
3. Users can browse destinations and related ecosystem data.
4. Budget charts, weather, and maps are visible and functional.
5. Transport and hotel queries return useful results in fallback or DB mode.

## Post-v1 Pipeline

- Phase 4: Community Reviews & Premium Payments (completed)
- Plan file: `.planning/phases/04-community-payments/04-PLAN.md`
- Phase 5: Unique Experience Engine (active)
- Plan file: `.planning/phases/05-unique-experience/05-PLAN.md`
- Phase 6: Intelligence & Collaboration Layer (planned)
- Plan file: `.planning/phases/06-intelligence-collab/06-PLAN.md`
- Next action: Close M5 evidence and start M6 Day 1 API contract setup while continuing TRIP-02 unblock monitoring.
