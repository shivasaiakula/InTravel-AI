# External Integrations

**Analysis Date:** 2026-03-22

## AI Integrations

### Google Gemini AI
- **Purpose:** Power the AI Trip Planner and Travel Chatbot features.
- **Provider:** Google AI (`@google/generative-ai` package).
- **Service Model:** `gemini-pro`.
- **Key Files:** `server/routes.js` (initializes with `GEMINI_API_KEY`).

## Database Integrations

### MySQL Server
- **Purpose:** Persistent storage for user authentication, travel destinations, transport info, hotel details, and saved trips.
- **Provider:** Local/Remote MySQL instance.
- **Key Files:** `server/db.js` (manages connections with `mysql2`).

## External Assets

### Unsplash Images
- **Purpose:** Provide high-quality visual representation for travel destinations.
- **Provider:** Unsplash API (links hardcoded in database/mock data).

## Future/Planned Integrations

### Weather API
- **Purpose:** Provide real-time weather information for travel destinations (referenced in `Conversation 13b203ce-7d7d-4db4-aa58-9737cf2c5b8e`).
- **Target:** TBD (e.g., OpenWeatherMap).

---

*Integration analysis: 2026-03-22*
*Update after adding new external services*
