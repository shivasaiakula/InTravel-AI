const mysql = require('mysql2');
require('dotenv').config();

let pool;
let isMock = false;

// In-Memory Mock Store for Users and Trips (Resilience)
const mockStore = {
    users: [],
    trips: [],
    sessions: new Map()
};

try {
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'indian_travel_platform',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    }).promise();
    console.log("MySQL connection pool initialized.");
} catch (err) {
    console.warn("MySQL connection failed initialization. Falling back to MOCK mode.");
    isMock = true;
}

// Simple wrapper to handle pool errors and provide mock fallbacks
const db = {
    execute: async (query, params) => {
        // If we know we're in mock mode, handle common queries
        if (isMock || !pool) {
            return handleMockQuery(query, params);
        }

        try {
            return await pool.execute(query, params);
        } catch (err) {
            console.error("Database query failed:", err.message);
            // If it's a connection or auth error, switch to mock mode permanently for this session
            if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ECONNREFUSED' || err.code === 'ER_BAD_DB_ERROR') {
                console.warn("DB Connection lost or refused. Switching to MOCK mode.");
                isMock = true;
                return handleMockQuery(query, params);
            }
            throw err;
        }
    },
    isMock: () => isMock
};

/**
 * Basic Mock Query Handler to support Auth and Trips without MySQL
 */
async function handleMockQuery(query, params) {
    const q = query.toLowerCase();
    
    // ── AUTH: SELECT users ──
    if (q.includes('select * from users where email = ?')) {
        const user = mockStore.users.find(u => u.email === params[0]);
        return [user ? [user] : []];
    }
    
    // ── AUTH: INSERT INTO users ──
    if (q.includes('insert into users')) {
        const [username, email, password] = params;
        const id = mockStore.users.length + 1;
        mockStore.users.push({ id, username, email, password });
        return [{ insertId: id }];
    }
    
    // ── TRIPS: SELECT trips ──
    if (q.includes('select * from user_trips')) {
        const userId = params[0];
        const userTrips = mockStore.trips.filter(t => t.user_id == userId);
        return [userTrips];
    }
    
    // ── TRIPS: INSERT INTO trips ──
    if (q.includes('insert into user_trips')) {
        const [userId, dest, start, end, budget, itinerary] = params;
        const id = mockStore.trips.length + 1;
        mockStore.trips.push({ id, user_id: userId, destination_name: dest, start_date: start, end_date: end, budget_estimate: budget, itinerary_json: JSON.parse(itinerary || '{}'), created_at: new Date() });
        return [{ insertId: id }];
    }

    // Default: empty results for other tables (destinations, hotels, etc will use the routes.js fallbacks)
    return [[]];
}

module.exports = db;
