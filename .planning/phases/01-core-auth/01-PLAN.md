---
wave: 1
depends_on: []
files_modified: ["server/routes.js"]
autonomous: true
requirements: ["AUTH-01", "AUTH-02", "TRIP-01", "TRIP-02", "DEST-01"]
---

# Plan 1: Core & Auth Stabilization

<objective>
Ensure the existing authentication endpoints, trip generation, and destination exploration work flawlessly.
</objective>

## Tasks

<task>
<read_first>
- server/routes.js
- server/db.js
- .planning/REQUIREMENTS.md
</read_first>
<action>
Verify and stabilize the `/api/register` and `/api/login` endpoints in `server/routes.js`. Ensure they correctly hash passwords with bcryptjs, return a JWT token, and handle database insertion properly via `server/db.js`. Ensure graceful error handling (e.g., duplicate email returns 400). Ensure AUTH-01 and AUTH-02 are met.
</action>
<acceptance_criteria>
- `grep "bcrypt.hash" server/routes.js` finds the hashing logic.
- `grep "jwt.sign" server/routes.js` finds the token generation.
- The endpoints return `200` or `201` on success with a `token` in the JSON response.
</acceptance_criteria>
</task>

<task>
<read_first>
- server/routes.js
- .planning/PROJECT.md
</read_first>
<action>
Review and stabilize the `/api/ai/plan` endpoint in `server/routes.js`. It must accept `destination`, `duration`, and `budget` from the request body, call the Google Gemini Pro API, and return a JSON structured day-by-day itinerary. Ensure proper fallback or error handling if the API is unavailable. Ensure TRIP-01 and TRIP-02 are met.
</action>
<acceptance_criteria>
- `grep "/api/ai/plan" server/routes.js` exists.
- The route processes the `destination` and `duration` limits properly (supports custom durations).
</acceptance_criteria>
</task>

<task>
<read_first>
- server/routes.js
</read_first>
<action>
Verify that the `/api/destinations` endpoint exists and returns a static or database-driven list of Indian destinations for the frontend to render. Ensure DEST-01 is met.
</action>
<acceptance_criteria>
- `grep "/api/destinations" server/routes.js` exists and returns an array of objects containing destination details.
</acceptance_criteria>
</task>

## Verification
- Verify the server syntax is valid.
- Ensure all acceptance criteria are met using codebase search.
- Ensure all requirements (AUTH-01, AUTH-02, TRIP-01, TRIP-02, DEST-01) are completely supported by the `/api` routes.

<must_haves>
- User can register/login securely.
- User can generate an itinerary via the AI endpoint.
- User can fetch destinations.
- All endpoints must return proper status codes and JSON.
</must_haves>
