const express = require('express');
const cors = require('cors');
const routes = require('./routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

function startupConfigWarnings() {
    const missing = [];
    if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
    if (!process.env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
    if (!process.env.DB_HOST) missing.push('DB_HOST');
    if (!process.env.DB_USER) missing.push('DB_USER');
    if (!process.env.DB_NAME) missing.push('DB_NAME');

    if (missing.length > 0) {
        console.warn(JSON.stringify({
            ts: new Date().toISOString(),
            channel: 'startup_warning',
            message: 'Missing recommended environment variables',
            missing,
        }));
    }
}

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
        console.log(JSON.stringify({
            ts: new Date().toISOString(),
            channel: 'http_access',
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - startedAt,
        }));
    });
    next();
});

// Main Routes
app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('Indian Travel Platform API is running...');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});

startupConfigWarnings();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
