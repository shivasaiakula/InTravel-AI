# Testing Patterns

**Analysis Date:** 2026-03-22

## Current State

The codebase currently **lacks a dedicated testing framework** or suite for application logic. 
Most testing so far has likely been performed through manual conversational UAT (User Acceptance Testing) during the development process.

## Framework Selection (Proposed)

### Frontend (React)
- **Framework:** Vitest (Recommended for Vite projects).
- **Libraries:** React Testing Library for component testing.
- **Goal:** Verify UI responsiveness, routing, and critical form interactions.

### Backend (Node/Express)
- **Framework:** Supertest or Jest.
- **Goal:** Validate API endpoints, status codes, and database interaction reliability.

## Mocking Strategy

### Database Mocking
- The project already has **hardcoded mock data** (`mockDestinations`, `mockTransport`, `mockHotels`) in `server/routes.js` that acts as a fallback system.
- This could be adapted into a formal mocking strategy for unit and integration testing.

### AI Service Mocking
- Testing the trip planner and chatbot should follow a mocking pattern for Google Gemini responses to avoid unnecessary API costs during local development.

## Regression Testing

### Manual UAT
- Ensure that core features (Destinations, AI Plan, Chatbot, and Authentication) are manually verified after each significant change.

---

*Testing analysis: 2026-03-22*
*Update after implementing a formal testing suite*
