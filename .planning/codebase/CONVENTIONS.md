# Coding Conventions

**Analysis Date:** 2026-03-22

## Language Standards

### Backend (Node.js/Express)
- **Module System:** CommonJS (`require`, `module.exports`).
- **Asynchronous Code:** `async/await` with `try...catch` blocks for error handling.
- **Naming:** camelCase for functions, variables, and database fields.
- **Logic Placement:** Currently, many business logic and database queries are inlined within `routes.js`.

### Frontend (React/Vite)
- **Module System:** ECMAScript Modules (`import`, `export default`).
- **Component Style:** Functional components with React Hooks (`useState`, `useEffect`, `useContext`).
- **Naming:** PascalCase for component filenames and function names (e.g., `Chatbot.jsx`).
- **Styling:** Vanilla CSS with global classes defined in `src/index.css`.

## Routing Practices

### Frontend Routing
- Using `react-router-dom` (v6.23.0) for standard SPA-style routing.
- Context-based authentication state to manage access to protected routes.

### Backend Routing
- Centralized `Express.Router()` instance in `server/routes.js` mounted at `/api` in `server/index.js`.
- HTTP status codes (200, 201, 401, 500) follow RESTful principles.

## Database Access

### SQL Interaction
- Using `mysql2`'s `execute` for prepared statement support to prevent SQL injection.
- Direct JSON stringification for complex nested data (e.g., the `itinerary_json` in the `user_trips` table).

## UI/UX Standards

### Glassmorphism System
- Unified CSS variables for primary and secondary colors (`--primary: #6366f1`, `--secondary: #a855f7`).
- Common styles for cards and buttons (`.glass-card`, `.button-primary`).
- Subtle animations (`fade-in`) for page transitions.

## Authentication & Security

### JSON Web Tokens (JWT)
- Backend issue JWT upon successful login.
- Authentication tokens should be used in subsequent client requests.

### Password Security
- Passwords must be hashed using `bcryptjs` before storage.

---

*Conventions analysis: 2026-03-22*
*Update after changing coding or naming standards*
