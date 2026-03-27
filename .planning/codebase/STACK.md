# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- JavaScript (ESM on Frontend, CommonJS on Backend) - React frontend and Node.js backend logic.

**Secondary:**
- SQL - Database schema and queries.
- CSS - Application styling (Vanilla CSS with glassmorphism).

## Runtime

**Environment:**
- Node.js (v18+ recommended) - Backend API and development tooling.
- Browser - React application execution.

**Package Manager:**
- npm (v10+) - Dependency management.
- Lockfile: `package-lock.json` present in root directories (`client`, `server`).

## Frameworks

**Core:**
- React (v18.3.1) - Frontend UI framework.
- Express (v4.19.2) - Backend web server.

**Testing:**
- None detected - No dedicated test framework configured for application code.

**Build/Dev:**
- Vite (v5.2.11) - Frontend build system and dev server.
- Nodemon (v3.1.0) - Backend development with auto-restart.

## Key Dependencies

**Critical:**
- `react-router-dom` (v6.23.0) - Frontend routing.
- `framer-motion` (v11.1.7) - UI animations and transitions.
- `@google/generative-ai` (v0.11.0) - Google Gemini AI integration.
- `mysql2` (v3.9.7) - MySQL database driver.
- `bcryptjs` (v2.4.3) - Password hashing and security.
- `jsonwebtoken` (v9.0.2) - Authentication token management.

**Infrastructure:**
- `axios` (v1.6.8) - HTTP client for API communication.
- `cors` (v2.8.5) - Cross-origin resource sharing.
- `dotenv` (v16.4.5) - Environment variable management.
- `chart.js` (v4.4.2) & `react-chartjs-2` (v5.2.0) - Data visualization.

## Configuration

**Environment:**
- `.env` files - Configuration for `GEMINI_API_KEY`, `JWT_SECRET`, and database credentials.
- `server/.env.example` provides a template for required variables.

**Build:**
- `client/vite.config.js` - Configuration for the Vite build system.

## Platform Requirements

**Development:**
- Windows (Current OS) - Local development environment.
- MySQL Server - Required for data persistence.

**Production:**
- Deployment target: Likely a Node.js compatible host (e.g., Vercel for frontend, Heroku/Render for backend) with a MySQL instance.

---

*Stack analysis: 2026-03-22*
*Update after major dependency changes*
