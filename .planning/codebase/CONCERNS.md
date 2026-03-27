# Technical Concerns & Debt

**Analysis Date:** 2026-03-22

## High Priority

### Hardcoded Secret & Keys
The `server/routes.js` file contains hardcoded placeholder strings like `"YOUR_GEMINI_KEY"` and `"secret"` for critical security settings.
- **Risk:** Potential for accidentally committing credentials or using insecure defaults in production.
- **Fix:** Ensure `GEMINI_API_KEY` and `JWT_SECRET` are strictly loaded from `.env` and missing values throw a configuration error.

### Project Redundancy
The project contains duplicate application code in both the root directory (`client/`, `server/`) and the `travel-planner/` subdirectory.
- **Risk:** Confusion about which code is the "canonical" version, potential for inconsistent updates, and increased repo size.
- **Fix:** Consolidate the codebase into a single clear structure (e.g., root `client` and `server` folders) and remove or archive the duplicate `travel-planner` folder.

## Medium Priority

### Monolithic Routes
Most of the backend business logic, including database execution and AI model interfacing, is directly inlined in `server/routes.js`.
- **Risk:** Harder to test and maintain as the project grows.
- **Fix:** Refactor business logic into separate controllers (e.g., `server/controllers/authController.js`, `server/controllers/aiController.js`).

### Missing Automated Testing
The project lacks unit, integration, and end-to-end tests for both frontend and backend.
- **Risk:** Higher risk of regressions during refactoring and feature additions.
- **Fix:** Initialize a testing suite using Vitest (frontend) and Jest/Supertest (backend).

### Backend Error Handling
Error handling in backend routes is basic, often just returning `res.status(500).json({ error: error.message })`.
- **Risk:** Inconsistent error responses and potential for leaking system details to clients.
- **Fix:** Implement a centralized error-handling middleware.

## Low Priority

### Fallback Data Strategy
The project relies on hardcoded mock data in `server/routes.js` as a fallback when database queries fail.
- **Risk:** Tying data tightly to application code.
- **Fix:** Move mock data to separate JSON files or ensure the database has sensible default records.

### CSS Organization
All styling for the application is in a single large `index.css` file.
- **Risk:** Difficult to maintain as the number of pages and components grows.
- **Fix:** Move component-specific styles to dedicated CSS files (e.g., `Chatbot.css`, `Navbar.css`).

---

*Concerns analysis: 2026-03-22*
*Update as issues are addressed and new ones emerge*
