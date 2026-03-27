# Directory Structure

**Analysis Date:** 2026-03-22

## Top-Level Layout

The project appears to have two parallel directory structures with similar content, possibly representing a development root and a separate project folder.

```text
.
├── client/                 # Root Frontend application (Vite/React)
│   ├── src/                # Frontend source code
│   │   ├── components/     # UI components (Navbar, Chatbot, etc.)
│   │   ├── context/        # React context (e.g., AuthContext)
│   │   ├── pages/          # Application pages (Home, Dashboard, etc.)
│   │   ├── utils/          # Utility functions
│   │   ├── App.jsx         # Main application component
│   │   └── index.css       # Core design system (Glassmorphism)
│   └── package.json        # Frontend configuration
├── server/                 # Root Backend API (Express)
│   ├── index.js            # Main entry point (starts server)
│   ├── routes.js           # API route definitions and logic
│   ├── db.js               # Database connection manager
│   ├── .env.example        # Environment variable template
│   └── package.json        # Backend configuration
├── travel-planner/         # Parallel project directory (Highly Redundant)
│   ├── backend/            # Copy of backend (main: server.js)
│   ├── frontend/           # Copy of frontend
│   └── database/           # Database schema/sql files
├── database/               # Root Database folder (SQL scripts)
├── run-app.bat             # Script to start the entire app
└── README.md               # Basic project documentation
```

## Key Locations

### Frontend Components
- **Core Styles:** `client/src/index.css` - Defines the global design variables and key styles (e.g., `.glass-card`).
- **Chatbot:** `client/src/components/Chatbot.jsx` - Main interface for AI assistance.
- **Pages:** `client/src/pages/` - Contains primary views like `Dashboard`, `Home`, `Authentication`, and `AIPlan`.

### Backend Components
- **Main Entry:** `server/index.js` - Starts the Express server and mounts the `/api` route.
- **Business Logic:** `server/routes.js` - Currently contains most of the core logic, including AI integration and database operations.
- **Database Access:** `server/db.js` - Shared connection pool for MySQL queries.

### Redundancy Note
The project contains duplicate application code in both the root (`client/`, `server/`) and the `travel-planner/` subdirectory. This redundancy is a key area of concern for development clarity and version control.

---

*Structure analysis: 2026-03-22*
*Update after moving or renaming major directories*
