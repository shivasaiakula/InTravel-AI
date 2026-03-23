const mysql = require('mysql2');
require('dotenv').config();

let pool;
let isMock = false;

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
    console.warn("MySQL connection failed. Falling back to MOCK mode.");
    isMock = true;
}

// Simple wrapper to handle pool errors
const db = {
    execute: async (query, params) => {
        if (!pool) {
            console.error("Database not initialized. Using MOCK fallback.");
            return [[]]; // Return empty for now, routes.js will handle specific mocks
        }
        try {
            return await pool.execute(query, params);
        } catch (err) {
            console.error("Database query failed:", err.message);
            throw err;
        }
    },
    isMock: () => isMock
};

module.exports = db;
