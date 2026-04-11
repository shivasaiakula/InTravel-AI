const express = require('express');
const router = express.Router();
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// ── AI Setup (Gemini) ──
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_GEMINI_KEY");
const GEMINI_MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.0-flash,gemini-1.5-flash')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);

async function generateGeminiText(prompt) {
    let lastError;
    for (const modelName of GEMINI_MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result?.response?.text?.();
            if (text) return text;
        } catch (error) {
            lastError = error;
            const status = Number(error?.status);
            // Retry on model-not-found and similar compatibility errors.
            if (status === 404 || status === 400) continue;
            throw error;
        }
    }
    throw lastError || new Error('No Gemini models available');
}

// ── Simple In-Memory Cache ──
const cache = new Map();
function getCached(key) { const v = cache.get(key); if (v && Date.now() - v.ts < 600000) return v.data; }
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

// Local auth fallback to keep login/register working when DB is not configured.
const localUsersByEmail = new Map();
const resetOtpStore = new Map();
const localBudgetProfiles = new Map();
let localReviews = [];
let localBookings = [];
let budgetProfilesTableReady = false;
let bookingsTableReady = false;
const authRateStore = new Map();

const MIN_PASSWORD_LENGTH = 8;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_VERIFY_MAX_ATTEMPTS = 5;
const REQUEST_RESET_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };
const VERIFY_RESET_LIMIT = { max: 8, windowMs: 15 * 60 * 1000 };
let otpTransporter;

function logAuthAudit(event, details = {}) {
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        channel: 'auth_audit',
        event,
        ...details,
    }));
}

function budgetProfileKey(userId, destination) {
    return `${String(userId || 'guest')}:${String(destination || 'default').trim().toLowerCase()}`;
}

function buildSanitizedProfile(payload) {
    const categories = Array.isArray(payload?.categories)
        ? payload.categories.map((cat, index) => ({
            id: cat.id || Date.now() + index,
            name: String(cat.name || `Category ${index + 1}`),
            icon: String(cat.icon || '💰'),
            budget: Math.max(0, Number(cat.budget) || 0),
            actual: Math.max(0, Number(cat.actual) || 0),
            color: String(cat.color || 'rgba(99, 102, 241, 0.8)'),
        }))
        : [];

    return {
        userId: Number(payload?.userId) || 0,
        destination: String(payload?.destination || 'Unknown').slice(0, 100),
        mode: ['budget-first', 'balanced', 'comfort-first'].includes(payload?.mode)
            ? payload.mode
            : 'balanced',
        days: Math.max(1, Math.min(30, Number(payload?.days) || 1)),
        totalBudget: Math.max(1000, Number(payload?.totalBudget) || 1000),
        categories,
        recommendations: Array.isArray(payload?.recommendations) ? payload.recommendations : [],
        metrics: typeof payload?.metrics === 'object' && payload?.metrics !== null ? payload.metrics : {},
        updatedAt: new Date().toISOString(),
    };
}

async function ensureBudgetProfilesTable() {
    if (budgetProfilesTableReady) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS budget_optimizer_profiles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            destination_name VARCHAR(100) NOT NULL,
            mode VARCHAR(30) DEFAULT 'balanced',
            days INT DEFAULT 1,
            total_budget DECIMAL(12, 2) DEFAULT 0,
            payload_json JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_destination (user_id, destination_name)
        )
    `);
    budgetProfilesTableReady = true;
}

async function ensureBookingsTable() {
    if (bookingsTableReady) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS travel_bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            booking_type VARCHAR(20) NOT NULL,
            user_id INT NULL,
            title VARCHAR(180) NOT NULL,
            city VARCHAR(120) NOT NULL,
            amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
            details_json JSON,
            status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    bookingsTableReady = true;
}

function sanitizeBookingPayload(payload) {
    const type = String(payload?.type || '').trim().toLowerCase();
    const validType = ['hotel', 'transport'].includes(type) ? type : null;
    if (!validType) {
        return { error: 'Booking type must be hotel or transport' };
    }

    const title = String(payload?.title || '').trim().slice(0, 180);
    const city = String(payload?.city || '').trim().slice(0, 120);
    const amount = Math.max(0, Number(payload?.amount) || 0);
    const details = typeof payload?.details === 'object' && payload?.details !== null ? payload.details : {};
    const userIdRaw = Number(payload?.userId);
    const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? Math.floor(userIdRaw) : null;

    if (!title || !city) {
        return { error: 'Booking title and city are required' };
    }

    return {
        booking: {
            type: validType,
            userId,
            title,
            city,
            amount,
            details,
            status: 'CONFIRMED',
        }
    };
}

function isDatabaseUnavailable(error) {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('access denied')
        || msg.includes('connect')
        || msg.includes('econnrefused')
        || msg.includes('er_access_denied_error')
        || msg.includes('unknown database')
        || msg.includes('doesn\'t exist');
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function isStrongPassword(password) {
    const value = String(password || '');
    return value.length >= MIN_PASSWORD_LENGTH && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function extractClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (Array.isArray(xff) && xff.length > 0) return String(xff[0]).trim();
    if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
    return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function consumeRateLimit(key, config) {
    const now = Date.now();
    const entry = authRateStore.get(key);
    if (!entry || now > entry.resetAt) {
        authRateStore.set(key, { count: 1, resetAt: now + config.windowMs });
        return { limited: false, remaining: config.max - 1 };
    }

    if (entry.count >= config.max) {
        return { limited: true, retryAfterMs: Math.max(0, entry.resetAt - now), remaining: 0 };
    }

    entry.count += 1;
    authRateStore.set(key, entry);
    return { limited: false, remaining: Math.max(0, config.max - entry.count) };
}

function getOtpTransporter() {
    if (otpTransporter !== undefined) return otpTransporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        otpTransporter = null;
        return otpTransporter;
    }

    otpTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });

    return otpTransporter;
}

async function sendResetOtpEmail(email, otp) {
    const transporter = getOtpTransporter();
    if (!transporter) return false;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appName = process.env.APP_NAME || 'InTravel AI';

    await transporter.sendMail({
        from,
        to: email,
        subject: `${appName} password reset OTP`,
        text: `Your OTP is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
        html: `<p>Your OTP is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p><p>If you did not request this, ignore this email.</p>`,
    });

    return true;
}

async function sendBookingTicketEmail({ email, booking }) {
    const transporter = getOtpTransporter();
    if (!transporter) return false;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appName = process.env.APP_NAME || 'InTravel AI';
    const details = booking?.details || {};
    const payment = details?.payment || {};
    const lines = [
        `Booking ID: ${booking.id}`,
        `Type: ${booking.type}`,
        `Service: ${booking.title}`,
        `City: ${booking.city}`,
        `Amount: INR ${Number(booking.amount || 0).toFixed(2)}`,
        details?.from && details?.to ? `Route: ${details.from} -> ${details.to}` : null,
        details?.travelDate ? `Travel Date: ${details.travelDate}` : null,
        Array.isArray(details?.seats) && details.seats.length > 0 ? `Seats: ${details.seats.join(', ')}` : null,
        payment?.method ? `Payment Method: ${payment.method}` : null,
        payment?.status ? `Payment Status: ${payment.status}` : null,
    ].filter(Boolean);

    await transporter.sendMail({
        from,
        to: email,
        subject: `${appName} booking ticket #${booking.id}`,
        text: lines.join('\n'),
        html: `<p>${lines.join('</p><p>')}</p>`,
    });

    return true;
}

async function findUserByEmail(email) {
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length > 0) {
            return { source: 'db', user: users[0] };
        }
        return { source: 'db', user: null };
    } catch (error) {
        if (!isDatabaseUnavailable(error)) throw error;
        const local = localUsersByEmail.get(email) || null;
        return { source: 'local', user: local };
    }
}

// ── AUTH ROUTES ──
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const email = normalizeEmail(req.body?.email);
        const normalizedUsername = String(username || '').trim();

        if (!normalizedUsername || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({
                error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include letters and numbers`,
            });
        }

        // Check if user already exists
        const [existing] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existing && existing.length > 0) {
            logAuthAudit('register_rejected_existing_email', { email });
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [normalizedUsername, email, hashedPassword]);
        logAuthAudit('register_success', { email, source: 'db' });
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        if (isDatabaseUnavailable(error)) {
            const { username, password } = req.body;
            const email = normalizeEmail(req.body?.email);
            const normalizedUsername = String(username || '').trim();

            if (!normalizedUsername || !email || !password) {
                return res.status(400).json({ error: 'Username, email, and password are required' });
            }
            if (!isStrongPassword(password)) {
                return res.status(400).json({
                    error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include letters and numbers`,
                });
            }

            if (localUsersByEmail.has(email)) {
                logAuthAudit('register_rejected_existing_email', { email, source: 'local' });
                return res.status(400).json({ error: 'Email already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            localUsersByEmail.set(email, {
                id: Date.now(),
                username: normalizedUsername,
                email,
                password: hashedPassword,
            });
            logAuthAudit('register_success', { email, source: 'local' });
            return res.status(201).json({ message: 'User registered successfully (local mode)' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const { password } = req.body;
        const loginRateKey = `login:${extractClientIp(req)}:${email}`;
        const loginRate = consumeRateLimit(loginRateKey, LOGIN_LIMIT);

        if (loginRate.limited) {
            const retryAfterSeconds = Math.ceil((loginRate.retryAfterMs || 0) / 1000);
            logAuthAudit('login_rate_limited', { email, retryAfterSeconds });
            return res.status(429).json({
                error: 'Too many login attempts. Please try again later.',
                retryAfterSeconds,
            });
        }

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            logAuthAudit('login_failed', { email, reason: 'user_not_found' });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, users[0].password);
        if (!valid) {
            logAuthAudit('login_failed', { email, reason: 'invalid_password' });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: users[0].id, username: users[0].username }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        logAuthAudit('login_success', { email, source: 'db' });
        res.json({ token, user: { id: users[0].id, username: users[0].username } });
    } catch (error) {
        if (isDatabaseUnavailable(error)) {
            const email = normalizeEmail(req.body?.email);
            const { password } = req.body;
            const user = localUsersByEmail.get(email);
            if (!user) {
                logAuthAudit('login_failed', { email, reason: 'user_not_found', source: 'local' });
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                logAuthAudit('login_failed', { email, reason: 'invalid_password', source: 'local' });
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
            logAuthAudit('login_success', { email, source: 'local' });
            return res.json({ token, user: { id: user.id, username: user.username } });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/auth/request-reset', async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const resetRateKey = `request-reset:${extractClientIp(req)}:${email}`;
        const resetRate = consumeRateLimit(resetRateKey, REQUEST_RESET_LIMIT);
        if (resetRate.limited) {
            const retryAfterSeconds = Math.ceil((resetRate.retryAfterMs || 0) / 1000);
            logAuthAudit('request_reset_rate_limited', { email, retryAfterSeconds });
            return res.status(429).json({
                error: 'Too many reset requests. Please try again later.',
                retryAfterSeconds,
            });
        }

        const { user } = await findUserByEmail(email);
        // Return generic response to avoid leaking account existence.
        if (!user) {
            logAuthAudit('request_reset_accepted', { email, accountFound: false });
            return res.json({ message: 'If an account exists for this email, an OTP has been generated.' });
        }

        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        resetOtpStore.set(email, {
            otpHash,
            attempts: 0,
            expiresAt: Date.now() + OTP_EXPIRY_MS,
        });
        logAuthAudit('request_reset_accepted', { email, accountFound: true });

        const response = {
            message: 'If an account exists for this email, an OTP has been generated.',
        };

        try {
            const emailSent = await sendResetOtpEmail(email, otp);
            if (!emailSent && process.env.NODE_ENV !== 'production') {
                response.devNote = 'SMTP not configured. Using debug OTP response.';
            }
        } catch {
            if (process.env.NODE_ENV !== 'production') {
                response.devNote = 'SMTP delivery failed. Using debug OTP response.';
            }
        }

        // OTP email provider can be plugged in here. Only expose OTP in non-production mode.
        if (process.env.NODE_ENV !== 'production') {
            response.debugOtp = otp;
        }

        return res.json(response);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/auth/verify-reset', async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const { otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, otp, and newPassword are required' });
        }
        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({
                error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters and include letters and numbers`,
            });
        }

        const verifyRateKey = `verify-reset:${extractClientIp(req)}:${email}`;
        const verifyRate = consumeRateLimit(verifyRateKey, VERIFY_RESET_LIMIT);
        if (verifyRate.limited) {
            const retryAfterSeconds = Math.ceil((verifyRate.retryAfterMs || 0) / 1000);
            logAuthAudit('verify_reset_rate_limited', { email, retryAfterSeconds });
            return res.status(429).json({
                error: 'Too many OTP verification attempts. Please try again later.',
                retryAfterSeconds,
            });
        }

        const otpEntry = resetOtpStore.get(email);
        if (!otpEntry) {
            logAuthAudit('verify_reset_failed', { email, reason: 'missing_otp_session' });
            return res.status(400).json({ error: 'No OTP request found for this email' });
        }
        if (Date.now() > otpEntry.expiresAt) {
            resetOtpStore.delete(email);
            logAuthAudit('verify_reset_failed', { email, reason: 'otp_expired' });
            return res.status(400).json({ error: 'OTP expired. Request a new one.' });
        }

        if (otpEntry.attempts >= OTP_VERIFY_MAX_ATTEMPTS) {
            resetOtpStore.delete(email);
            logAuthAudit('verify_reset_failed', { email, reason: 'max_attempts_reached' });
            return res.status(429).json({
                error: 'Too many invalid attempts. Request a new OTP.',
                retryAfterSeconds: 0,
            });
        }

        const validOtp = await bcrypt.compare(String(otp), otpEntry.otpHash);
        if (!validOtp) {
            otpEntry.attempts += 1;
            resetOtpStore.set(email, otpEntry);
            logAuthAudit('verify_reset_failed', { email, reason: 'invalid_otp', attempts: otpEntry.attempts });
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        try {
            await db.execute('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
        } catch (error) {
            if (!isDatabaseUnavailable(error)) throw error;
            const user = localUsersByEmail.get(email);
            if (!user) return res.status(404).json({ error: 'Account not found for this email' });
            localUsersByEmail.set(email, { ...user, password: hashedPassword });
        }

        resetOtpStore.delete(email);
        logAuthAudit('verify_reset_success', { email });
        return res.json({ message: 'Password reset successful. Please login.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// ── DESTINATION ROUTES ──
router.get('/destinations', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM destinations');
        res.json(rows.length > 0 ? rows : mockDestinations);
    } catch (err) {
        res.json(mockDestinations);
    }
});

router.get('/destinations/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM destinations WHERE id = ?', [req.params.id]);
        res.json(rows[0] || mockDestinations[0]);
    } catch (err) { res.json(mockDestinations[0]); }
});

function parseDurationMinutes(durationValue) {
    const value = String(durationValue || '').toLowerCase();
    const hoursMatch = value.match(/(\d+)\s*h/);
    const minsMatch = value.match(/(\d+)\s*m/);
    const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
    const minutes = minsMatch ? Number(minsMatch[1]) : 0;
    const total = (hours * 60) + minutes;
    return total > 0 ? total : 120;
}

function hashString(input) {
    const text = String(input || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function buildTransportReality(route) {
    const mode = String(route?.mode || '').toLowerCase();
    const durationMinutes = parseDurationMinutes(route?.duration);
    const routeFingerprint = `${route?.from || route?.from_city || ''}|${route?.to || route?.to_city || ''}|${route?.operator || ''}|${route?.mode || ''}`;
    const departureHour = 5 + (hashString(routeFingerprint) % 18); // 5 to 22
    const transferCount = Math.max(0, Math.floor((durationMinutes - 240) / 360));

    const baseByMode = {
        flight: 84,
        train: 79,
        bus: 70,
    };

    let score = baseByMode[mode] || 72;
    score -= Math.min(26, Math.floor(durationMinutes / 80));
    score -= transferCount * 8;

    if (departureHour <= 6) score -= 7;
    if (departureHour >= 21) score -= 6;
    if (durationMinutes <= 180) score += 5;

    const realityScore = Math.max(35, Math.min(96, score));
    const riskFactors = [];

    if (transferCount > 0) riskFactors.push(`${transferCount} transfer risk`);
    if (departureHour <= 6) riskFactors.push('early departure reliability risk');
    if (departureHour >= 21) riskFactors.push('late-night arrival risk');
    if (durationMinutes >= 720) riskFactors.push('long-duration fatigue risk');
    if (riskFactors.length === 0) riskFactors.push('stable route pattern');

    return {
        realityScore,
        riskFactors,
        departureHour,
    };
}

function buildSeatLayout(seedText) {
    const seed = hashString(seedText);
    const lower = [];
    const upper = [];

    for (let i = 1; i <= 16; i += 1) {
        lower.push({
            id: `L${i}`,
            available: ((seed + i) % 5) !== 0,
        });
    }

    for (let i = 1; i <= 12; i += 1) {
        upper.push({
            id: `U${i}`,
            available: ((seed + (i * 2)) % 6) !== 0,
        });
    }

    return { lower, upper };
}

function normalizeTransportService(service, index, from, to, travelDate) {
    const operator = String(service?.operator || service?.name || `Operator ${index + 1}`);
    const busType = String(service?.busType || service?.type || 'AC Sleeper');
    const departure = String(service?.departure || service?.departureTime || '21:00');
    const arrival = String(service?.arrival || service?.arrivalTime || '05:30');
    const duration = String(service?.duration || '8h 30m');
    const rating = Number(service?.rating || 4.2).toFixed(1);
    const price = Math.max(250, Number(service?.price || service?.fare || 650));
    const seatsLeft = Math.max(1, Number(service?.seatsLeft || service?.availableSeats || 10));
    const boardingPoints = Array.isArray(service?.boardingPoints) && service.boardingPoints.length > 0
        ? service.boardingPoints
        : [`${from} Main Bus Stand`, `${from} Bypass`, `${from} City Center`];
    const droppingPoints = Array.isArray(service?.droppingPoints) && service.droppingPoints.length > 0
        ? service.droppingPoints
        : [`${to} Main Bus Stand`, `${to} Highway Stop`, `${to} City Center`];

    return {
        id: String(service?.id || `${from}-${to}-${travelDate}-${index}`),
        operator,
        busType,
        departure,
        arrival,
        duration,
        rating,
        seatsLeft,
        price,
        boardingPoints,
        droppingPoints,
        seatLayout: buildSeatLayout(`${operator}|${busType}|${from}|${to}|${travelDate}|${index}`),
    };
}

function buildFallbackTransportServices(from, to, travelDate) {
    const base = mockTransport.filter((item) =>
        String(item.from || '').toLowerCase() === String(from || '').toLowerCase()
        && String(item.to || '').toLowerCase() === String(to || '').toLowerCase(),
    );

    const seedRoutes = base.length > 0
        ? base.filter((item) => String(item.mode || '').toLowerCase() === 'bus')
        : [];

    const templates = seedRoutes.length > 0
        ? seedRoutes
        : [
            { operator: 'Orange Travels', price: 780, duration: '9h 10m', mode: 'Bus' },
            { operator: 'VRL Travels', price: 860, duration: '8h 50m', mode: 'Bus' },
            { operator: 'SRS Travels', price: 920, duration: '8h 20m', mode: 'Bus' },
            { operator: 'Morning Star', price: 700, duration: '9h 40m', mode: 'Bus' },
            { operator: 'Kaveri Travels', price: 830, duration: '8h 55m', mode: 'Bus' },
            { operator: 'Jabbar Travels', price: 970, duration: '8h 05m', mode: 'Bus' },
        ];

    const departures = ['18:30', '19:15', '20:00', '21:10', '22:00', '23:05'];
    const arrivals = ['03:45', '04:20', '05:10', '05:55', '06:20', '07:00'];
    const types = ['AC Sleeper', 'Volvo Multi-Axle', 'Seater AC', 'Non-AC Sleeper', 'AC Semi-Sleeper'];

    return templates.slice(0, 8).map((tpl, index) => normalizeTransportService({
        id: `${from}-${to}-${index}`,
        operator: tpl.operator,
        busType: types[index % types.length],
        departure: departures[index % departures.length],
        arrival: arrivals[index % arrivals.length],
        duration: tpl.duration,
        rating: 4 + ((index % 5) * 0.15),
        seatsLeft: 6 + (index * 2),
        price: Number(tpl.price || 700) + (index * 60),
        boardingPoints: [`${from} Main Bus Stand`, `${from} Bypass`, `${from} Metro Point`],
        droppingPoints: [`${to} Main Bus Stand`, `${to} Highway`, `${to} Market`],
    }, index, from, to, travelDate));
}

async function fetchProviderTransportServices({ from, to, travelDate, passengers }) {
    const endpoint = process.env.TRANSPORT_SEARCH_API_URL;
    if (!endpoint || typeof fetch !== 'function') {
        return null;
    }

    const url = new URL(endpoint);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('date', travelDate);
    url.searchParams.set('passengers', String(passengers || 1));

    const headers = {};
    if (process.env.TRANSPORT_SEARCH_API_KEY) {
        headers.Authorization = `Bearer ${process.env.TRANSPORT_SEARCH_API_KEY}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    try {
        const response = await fetch(url.toString(), { headers, signal: controller.signal });
        if (!response.ok) {
            throw new Error(`transport provider returned ${response.status}`);
        }

        const payload = await response.json();
        const rows = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.services)
                ? payload.services
                : [];

        return rows;
    } finally {
        clearTimeout(timeoutId);
    }
}

const MOOD_ROUTE_MAP = {
    heritage: 'Prioritize forts, palaces, museums, old-town walks, and stories of local history.',
    monsoon: 'Prioritize rain-friendly indoor stops, scenic monsoon viewpoints, and flexible transit buffers.',
    'food-lanes': 'Prioritize market food lanes, regional dishes, cooking experiences, and trusted local eateries.',
    spiritual: 'Prioritize temples/ghats/monasteries, peaceful timing windows, and reflective low-rush pacing.',
};

function buildMoodRoutePromptSegment(moodRoute) {
    const key = String(moodRoute || '').trim().toLowerCase();
    if (!key || !MOOD_ROUTE_MAP[key]) {
        return 'Mood route: balanced exploration with culture, food, and local highlights.';
    }
    return `Mood route selected: ${key}. ${MOOD_ROUTE_MAP[key]}`;
}

function buildFamilyPromptSegment(familyFriendly) {
    if (!familyFriendly) {
        return 'Family friendly mode: disabled.';
    }
    return 'Family friendly mode: enabled. Keep walking transfers short, avoid steep/stair-heavy plans, reduce late-evening activity intensity, and include child/senior-friendly stops.';
}

function buildCrowdClimateWindows(city) {
    const now = new Date();
    const month = now.getMonth();
    const hour = now.getHours();

    const seasonHint = month >= 5 && month <= 8
        ? 'monsoon humidity'
        : (month >= 10 || month <= 1)
            ? 'cooler season'
            : 'warm daytime heat';

    const windows = [
        {
            key: 'morning',
            label: '6:00 AM - 9:00 AM',
            crowdLevel: 'Low',
            climateHint: month >= 5 && month <= 8 ? 'light rain possible' : 'pleasant breeze',
            confidence: 86,
            recommendation: 'Best for landmarks and photo spots before queues build up.',
        },
        {
            key: 'late-morning',
            label: '9:00 AM - 12:00 PM',
            crowdLevel: 'Moderate',
            climateHint: seasonHint,
            confidence: 78,
            recommendation: 'Good for museums, curated tours, and indoor heritage circuits.',
        },
        {
            key: 'afternoon',
            label: '12:00 PM - 3:00 PM',
            crowdLevel: 'High',
            climateHint: 'peak sun and traffic',
            confidence: 72,
            recommendation: 'Prefer AC cafes, rest breaks, or short transfer legs.',
        },
        {
            key: 'evening',
            label: '4:00 PM - 7:00 PM',
            crowdLevel: 'Moderate',
            climateHint: 'cooler golden hour',
            confidence: 82,
            recommendation: 'Great for promenades, ghats, and street food lanes.',
        },
    ];

    const active = windows.find((item) => {
        if (item.key === 'morning') return hour >= 6 && hour < 9;
        if (item.key === 'late-morning') return hour >= 9 && hour < 12;
        if (item.key === 'afternoon') return hour >= 12 && hour < 16;
        return hour >= 16 && hour < 20;
    }) || windows[0];

    return {
        city,
        windows: windows.map((item) => ({ ...item, isBestNow: item.key === active.key })),
        confidenceState: active.confidence >= 70 ? 'high' : 'low',
        generatedAt: now.toISOString(),
    };
}

// ── TRANSPORT ROUTES ──
router.get('/transport', async (req, res) => {
    const { from, to } = req.query;
    try {
        const [rows] = await db.execute('SELECT * FROM transport WHERE from_city = ? AND to_city = ?', [from, to]);
        const sourceRows = rows.length > 0
            ? rows
            : mockTransport.filter(t => t.from === from && t.to === to);

        const enriched = sourceRows.map((route) => {
            const reality = buildTransportReality(route);
            return {
                ...route,
                realityScore: reality.realityScore,
                riskFactors: reality.riskFactors,
                departureHour: reality.departureHour,
            };
        });

        res.json(enriched);
    } catch (err) {
        const fallback = mockTransport
            .filter(t => t.from === from && t.to === to)
            .map((route) => {
                const reality = buildTransportReality(route);
                return {
                    ...route,
                    realityScore: reality.realityScore,
                    riskFactors: reality.riskFactors,
                    departureHour: reality.departureHour,
                };
            });
        res.json(fallback);
    }
});

router.get('/transport/search', async (req, res) => {
    const from = String(req.query?.from || '').trim();
    const to = String(req.query?.to || '').trim();
    const travelDate = String(req.query?.travelDate || '').trim();
    const passengers = Math.max(1, Math.min(6, Number(req.query?.passengers) || 1));

    if (!from || !to || !travelDate) {
        return res.status(400).json({ error: 'from, to, and travelDate are required' });
    }

    try {
        const providerRows = await fetchProviderTransportServices({ from, to, travelDate, passengers });
        if (Array.isArray(providerRows) && providerRows.length > 0) {
            const services = providerRows
                .slice(0, 20)
                .map((item, index) => normalizeTransportService(item, index, from, to, travelDate));

            return res.json({ source: 'provider', services });
        }
    } catch (error) {
        // Continue to fallback route if provider is unavailable.
    }

    try {
        const [rows] = await db.execute(
            'SELECT * FROM transport WHERE from_city = ? AND to_city = ? LIMIT 25',
            [from, to],
        );

        if (Array.isArray(rows) && rows.length > 0) {
            const services = rows
                .map((row, index) => normalizeTransportService({
                    id: row.id,
                    operator: row.operator,
                    busType: row.mode,
                    duration: row.duration,
                    price: row.price,
                }, index, from, to, travelDate));

            return res.json({ source: 'database', services });
        }
    } catch (error) {
        if (!isDatabaseUnavailable(error)) {
            return res.status(500).json({ error: error.message });
        }
    }

    const services = buildFallbackTransportServices(from, to, travelDate);
    return res.json({ source: 'fallback', services });
});

// ── HOTEL ROUTES ──
router.get('/hotels', async (req, res) => {
    const city = String(req.query?.city || '').trim();
    if (!city) return res.json([]);

    const cityLower = city.toLowerCase();
    const minRating = Math.max(0, Number(req.query?.minRating) || 0);
    const maxPrice = Math.max(0, Number(req.query?.maxPrice) || 0);
    const sortMode = String(req.query?.sort || 'best').trim().toLowerCase();
    const amenityQuery = String(req.query?.amenities || '').trim().toLowerCase();

    const scoreHotel = (item) => {
        const rating = Number(item.rating || 0);
        const price = Number(item.price_per_night || item.price || 0);
        const cityName = String(item.city || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const amenities = String(item.amenities || '').toLowerCase();
        const reasons = [];
        let score = (rating * 20) - (price / 250);

        if (cityName === cityLower) {
            score += 28;
            reasons.push('Exact city match');
        } else if (cityName.includes(cityLower) || cityLower.includes(cityName)) {
            score += 16;
            reasons.push('Nearby city match');
        }

        if (name.includes(cityLower)) {
            score += 8;
            reasons.push('Hotel name matches destination');
        }

        if (amenityQuery) {
            const matched = amenityQuery.split(/[\s,]+/).filter(Boolean).every((term) => amenities.includes(term));
            if (matched) {
                score += 14;
                reasons.push('Amenities match');
            }
        }

        if (rating >= 4.5) {
            score += 10;
            reasons.push('Highly rated');
        }
        if (price > 0 && price <= 5000) {
            score += 6;
            reasons.push('Great value');
        }

        return {
            ...item,
            rating,
            price_per_night: price,
            matchScore: Math.round(score),
            matchReasons: reasons.length > 0 ? reasons : ['Balanced recommendation'],
        };
    };

    const rankHotels = (items) => {
        const ranked = items
            .filter((item) => Number(item.rating || 0) >= minRating)
            .filter((item) => (maxPrice > 0 ? Number(item.price_per_night || item.price || 0) <= maxPrice : true))
            .map(scoreHotel);

        return ranked.sort((a, b) => {
            if (sortMode === 'price-asc') return Number(a.price_per_night || 0) - Number(b.price_per_night || 0);
            if (sortMode === 'price-desc') return Number(b.price_per_night || 0) - Number(a.price_per_night || 0);
            if (sortMode === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
            if (sortMode === 'value') {
                const valueA = (Number(a.rating || 0) * 10) / Math.max(1, Number(a.price_per_night || 0) / 1000);
                const valueB = (Number(b.rating || 0) * 10) / Math.max(1, Number(b.price_per_night || 0) / 1000);
                return valueB - valueA;
            }
            return Number(b.matchScore || 0) - Number(a.matchScore || 0);
        });
    };

    try {
        const [rows] = await db.execute(
            `SELECT *
             FROM hotels
             WHERE LOWER(city) = LOWER(?) OR LOWER(city) LIKE ?
             ORDER BY rating DESC, price_per_night ASC
             LIMIT 20`,
            [city, `%${cityLower}%`],
        );

        const fallbackRows = mockHotels.filter((h) => {
            const c = String(h.city || '').toLowerCase();
            return c === cityLower || c.includes(cityLower) || cityLower.includes(c);
        });

        const merged = rows.length > 0 ? rows : fallbackRows;
        return res.json(rankHotels(merged));
    } catch (err) {
        const fallbackRows = mockHotels.filter((h) => {
            const c = String(h.city || '').toLowerCase();
            return c === cityLower || c.includes(cityLower) || cityLower.includes(c);
        });
        return res.json(rankHotels(fallbackRows));
    }
});

function toPaise(amount) {
    return Math.max(0, Math.round(Number(amount) || 0) * 100);
}

function createOrderReceipt(bookingId) {
    return `bk_${String(bookingId)}_${Date.now().toString(36)}`;
}

function buildPaymentSummary(booking, session = {}) {
    return {
        status: session.status || 'pending',
        method: session.method || 'upi',
        provider: session.provider || 'mock',
        orderId: session.orderId || null,
        paymentId: session.paymentId || null,
        signature: session.signature || null,
        currency: session.currency || 'INR',
        amount: Number(booking.amount) || 0,
        updatedAt: new Date().toISOString(),
        attempts: Number(booking?.details?.payment?.attempts || 0) + 1,
    };
}

async function persistBookingPaymentState({ bookingId, userId, session = {}, status = 'pending', paymentId = null, signature = null, provider = 'mock', method = 'upi' }) {
    const updatePayment = (booking) => {
        const details = typeof booking.details === 'object' && booking.details !== null ? { ...booking.details } : {};
        details.payment = buildPaymentSummary(booking, {
            ...session,
            status,
            paymentId,
            signature,
            provider,
            method,
        });
        return { ...booking, details };
    };

    try {
        await ensureBookingsTable();
        const [rows] = await db.execute(
            'SELECT id, booking_type, user_id, title, city, amount, details_json, status, created_at FROM travel_bookings WHERE id = ? AND user_id = ? LIMIT 1',
            [bookingId, userId],
        );
        if (!rows?.length) return null;

        const row = rows[0];
        const booking = {
            id: row.id,
            type: row.booking_type,
            userId: row.user_id,
            title: row.title,
            city: row.city,
            amount: Number(row.amount) || 0,
            details: typeof row.details_json === 'string' ? JSON.parse(row.details_json || '{}') : (row.details_json || {}),
            status: row.status,
            createdAt: row.created_at,
        };
        const updated = updatePayment(booking);

        await db.execute(
            'UPDATE travel_bookings SET details_json = ? WHERE id = ? AND user_id = ?',
            [JSON.stringify(updated.details), bookingId, userId],
        );

        return updated;
    } catch (err) {
        if (!isDatabaseUnavailable(err)) throw err;

        const index = localBookings.findIndex((item) => Number(item.id) === Number(bookingId) && Number(item.userId) === Number(userId));
        if (index === -1) return null;
        localBookings[index] = updatePayment(localBookings[index]);
        return localBookings[index];
    }
}

async function createRazorpayOrder({ bookingId, amount, currency = 'INR', receipt, notes = {} }) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return null;

    const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        },
        body: JSON.stringify({
            amount: toPaise(amount),
            currency,
            receipt: receipt || createOrderReceipt(bookingId),
            payment_capture: 1,
            notes: {
                bookingId: String(bookingId),
                ...notes,
            },
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Razorpay order failed: ${message}`);
    }

    return response.json();
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    return expected === signature;
}

router.post('/bookings', async (req, res) => {
    const { booking, error } = sanitizeBookingPayload(req.body);
    if (error) return res.status(400).json({ error });

    try {
        await ensureBookingsTable();
        const [insertResult] = await db.execute(
            `INSERT INTO travel_bookings (booking_type, user_id, title, city, amount, details_json, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                booking.type,
                booking.userId,
                booking.title,
                booking.city,
                booking.amount,
                JSON.stringify(booking.details),
                booking.status,
            ],
        );

        return res.status(201).json({
            id: insertResult.insertId,
            type: booking.type,
            userId: booking.userId,
            title: booking.title,
            city: booking.city,
            amount: booking.amount,
            details: booking.details,
            status: booking.status,
            createdAt: new Date().toISOString(),
        });
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        const localBooking = {
            id: Date.now(),
            type: booking.type,
            userId: booking.userId,
            title: booking.title,
            city: booking.city,
            amount: booking.amount,
            details: booking.details,
            status: booking.status,
            createdAt: new Date().toISOString(),
        };
        localBookings = [localBooking, ...localBookings].slice(0, 500);
        return res.status(201).json(localBooking);
    }
});

router.get('/bookings', async (req, res) => {
    const filterTypeRaw = String(req.query?.type || '').trim().toLowerCase();
    const filterType = ['hotel', 'transport'].includes(filterTypeRaw) ? filterTypeRaw : null;
    const userIdRaw = Number(req.query?.userId);
    const filterUserId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? Math.floor(userIdRaw) : null;

    try {
        await ensureBookingsTable();
        const conditions = [];
        const params = [];

        if (filterType) {
            conditions.push('booking_type = ?');
            params.push(filterType);
        }
        if (filterUserId) {
            conditions.push('user_id = ?');
            params.push(filterUserId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const [rows] = await db.execute(
            `SELECT id, booking_type, user_id, title, city, amount, details_json, status, created_at
             FROM travel_bookings ${whereClause}
             ORDER BY created_at DESC
             LIMIT 100`,
            params,
        );

        return res.json(rows.map((row) => ({
            id: row.id,
            type: row.booking_type,
            userId: row.user_id,
            title: row.title,
            city: row.city,
            amount: Number(row.amount) || 0,
            details: typeof row.details_json === 'string' ? JSON.parse(row.details_json || '{}') : (row.details_json || {}),
            status: row.status,
            createdAt: row.created_at,
        })));
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        let rows = [...localBookings];
        if (filterType) rows = rows.filter((item) => item.type === filterType);
        if (filterUserId) rows = rows.filter((item) => item.userId === filterUserId);
        return res.json(rows.slice(0, 100));
    }
});

router.get('/offers/validate', async (req, res) => {
    const code = String(req.query?.code || '').trim().toUpperCase();
    const amount = Math.max(0, Number(req.query?.amount) || 0);
    const type = String(req.query?.type || '').trim().toLowerCase();

    const offers = {
        WELCOME10: { kind: 'percent', value: 10, maxDiscount: 1000, minAmount: 2000, allowedTypes: ['hotel', 'transport'] },
        HOTEL15: { kind: 'percent', value: 15, maxDiscount: 2000, minAmount: 4000, allowedTypes: ['hotel'] },
        BUS100: { kind: 'flat', value: 100, maxDiscount: 100, minAmount: 500, allowedTypes: ['transport'] },
    };

    if (!code || !offers[code]) {
        return res.json({ valid: false, message: 'Coupon not found' });
    }

    const offer = offers[code];
    if (!offer.allowedTypes.includes(type)) {
        return res.json({ valid: false, message: `Coupon ${code} is not valid for ${type || 'this'} bookings` });
    }

    if (amount < offer.minAmount) {
        return res.json({ valid: false, message: `Minimum order for ${code} is INR ${offer.minAmount}` });
    }

    let discount = 0;
    if (offer.kind === 'percent') {
        discount = Math.round((amount * offer.value) / 100);
    } else {
        discount = Math.round(offer.value);
    }
    discount = Math.min(discount, offer.maxDiscount, amount);
    const finalAmount = Math.max(0, amount - discount);

    return res.json({
        valid: true,
        code,
        discount,
        finalAmount,
    });
});

function computeRefundEstimate(booking) {
    const amount = Math.max(0, Number(booking?.amount) || 0);
    const details = booking?.details || {};
    const paymentStatus = String(details?.payment?.status || '').toLowerCase();
    const startDateRaw = details?.checkIn || details?.travelDate || booking?.createdAt;
    const startDate = startDateRaw ? new Date(`${String(startDateRaw).slice(0, 10)}T12:00:00`) : new Date();
    const now = new Date();
    const hoursBefore = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (String(booking?.status || '').toUpperCase() === 'CANCELLED') {
        return { refundableAmount: 0, refundPercent: 0, policyLabel: 'Booking already cancelled' };
    }
    if (paymentStatus && paymentStatus !== 'success' && paymentStatus !== 'paid' && paymentStatus !== 'paid_mock') {
        return { refundableAmount: 0, refundPercent: 0, policyLabel: 'Payment incomplete - no refund applicable' };
    }

    let refundPercent = 0;
    let policyLabel = 'No refund';
    if (hoursBefore >= 168) {
        refundPercent = 90;
        policyLabel = 'Free cancellation window';
    } else if (hoursBefore >= 72) {
        refundPercent = 60;
        policyLabel = 'Standard cancellation window';
    } else if (hoursBefore >= 24) {
        refundPercent = 30;
        policyLabel = 'Late cancellation window';
    }

    return {
        refundableAmount: Math.round((amount * refundPercent) / 100),
        refundPercent,
        policyLabel,
        hoursBefore: Math.round(hoursBefore),
    };
}

router.get('/bookings/:id/refund-estimate', async (req, res) => {
    const bookingId = Number(req.params?.id);
    const userId = Number(req.query?.userId);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'Invalid booking id' });
    }
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Valid user id is required' });
    }

    try {
        await ensureBookingsTable();
        const [rows] = await db.execute(
            'SELECT id, booking_type, title, city, amount, details_json, status, created_at FROM travel_bookings WHERE id = ? AND user_id = ? LIMIT 1',
            [bookingId, userId],
        );
        if (!rows?.length) return res.status(404).json({ error: 'Booking not found' });

        const row = rows[0];
        const booking = {
            id: row.id,
            type: row.booking_type,
            title: row.title,
            city: row.city,
            amount: Number(row.amount) || 0,
            details: typeof row.details_json === 'string' ? JSON.parse(row.details_json || '{}') : (row.details_json || {}),
            status: row.status,
            createdAt: row.created_at,
        };

        return res.json(computeRefundEstimate(booking));
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        const booking = localBookings.find((item) => Number(item.id) === bookingId && Number(item.userId) === userId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        return res.json(computeRefundEstimate(booking));
    }
});

router.post('/bookings/:id/modify', async (req, res) => {
    const bookingId = Number(req.params?.id);
    const userId = Number(req.body?.userId);
    const patch = req.body?.patch || {};

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'Invalid booking id' });
    }
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Valid user id is required' });
    }

    const allowedDetails = ['checkIn', 'checkOut', 'guests', 'rooms', 'travelDate', 'passengers'];
    const allowedTop = ['title', 'city', 'amount'];

    const applyPatch = (booking) => {
        const details = { ...(booking.details || {}) };
        allowedDetails.forEach((key) => {
            if (patch[key] !== undefined && patch[key] !== null) details[key] = patch[key];
        });

        const updated = {
            ...booking,
            details,
        };

        allowedTop.forEach((key) => {
            if (patch[key] !== undefined && patch[key] !== null) {
                updated[key] = key === 'amount' ? Math.max(0, Number(patch[key]) || 0) : patch[key];
            }
        });

        return updated;
    };

    try {
        await ensureBookingsTable();
        const [rows] = await db.execute(
            'SELECT id, booking_type, user_id, title, city, amount, details_json, status, created_at FROM travel_bookings WHERE id = ? AND user_id = ? LIMIT 1',
            [bookingId, userId],
        );
        if (!rows?.length) return res.status(404).json({ error: 'Booking not found' });

        const row = rows[0];
        const current = {
            id: row.id,
            type: row.booking_type,
            userId: row.user_id,
            title: row.title,
            city: row.city,
            amount: Number(row.amount) || 0,
            details: typeof row.details_json === 'string' ? JSON.parse(row.details_json || '{}') : (row.details_json || {}),
            status: row.status,
            createdAt: row.created_at,
        };
        const updated = applyPatch(current);

        await db.execute(
            'UPDATE travel_bookings SET title = ?, city = ?, amount = ?, details_json = ? WHERE id = ? AND user_id = ?',
            [updated.title, updated.city, updated.amount, JSON.stringify(updated.details), bookingId, userId],
        );

        return res.json({ success: true, booking: updated });
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        const index = localBookings.findIndex((item) => Number(item.id) === bookingId && Number(item.userId) === userId);
        if (index === -1) return res.status(404).json({ error: 'Booking not found' });
        localBookings[index] = applyPatch(localBookings[index]);
        return res.json({ success: true, booking: localBookings[index] });
    }
});

router.delete('/bookings/:id', async (req, res) => {
    const bookingId = Number(req.params?.id);
    const userIdRaw = Number(req.query?.userId ?? req.body?.userId);
    const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? Math.floor(userIdRaw) : null;

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'Invalid booking id' });
    }
    if (!userId) {
        return res.status(400).json({ error: 'User id is required to cancel booking' });
    }

    try {
        await ensureBookingsTable();
        const [rows] = await db.execute(
            'SELECT id, status FROM travel_bookings WHERE id = ? AND user_id = ? LIMIT 1',
            [bookingId, userId],
        );

        if (!rows?.length) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (String(rows[0].status || '').toUpperCase() === 'CANCELLED') {
            return res.status(409).json({ error: 'Booking is already cancelled' });
        }

        await db.execute(
            'UPDATE travel_bookings SET status = ? WHERE id = ? AND user_id = ?',
            ['CANCELLED', bookingId, userId],
        );

        return res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        const index = localBookings.findIndex(
            (item) => Number(item.id) === Number(bookingId) && Number(item.userId) === Number(userId),
        );
        if (index === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (String(localBookings[index].status || '').toUpperCase() === 'CANCELLED') {
            return res.status(409).json({ error: 'Booking is already cancelled' });
        }

        localBookings[index] = {
            ...localBookings[index],
            status: 'CANCELLED',
        };
        return res.json({ success: true, message: 'Booking cancelled successfully' });
    }
});

router.post('/bookings/:id/payment', async (req, res) => {
    const bookingId = Number(req.params?.id);
    const userId = Number(req.body?.userId);
    const method = String(req.body?.method || 'upi').trim().toLowerCase();
    const status = String(req.body?.status || '').trim().toLowerCase();
    const allowed = ['pending', 'success', 'failed'];

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'Invalid booking id' });
    }
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Valid user id is required' });
    }
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Payment status must be pending/success/failed' });
    }

    const patchDetails = (existing) => {
        const details = typeof existing === 'object' && existing !== null ? { ...existing } : {};
        const prev = details.payment || {};
        details.payment = {
            method,
            status,
            updatedAt: new Date().toISOString(),
            attempts: Number(prev.attempts || 0) + 1,
        };
        return details;
    };

    try {
        await ensureBookingsTable();
        const [rows] = await db.execute(
            'SELECT id, details_json FROM travel_bookings WHERE id = ? AND user_id = ? LIMIT 1',
            [bookingId, userId],
        );

        if (!rows?.length) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const row = rows[0];
        const details = patchDetails(typeof row.details_json === 'string' ? JSON.parse(row.details_json || '{}') : (row.details_json || {}));
        await db.execute('UPDATE travel_bookings SET details_json = ? WHERE id = ? AND user_id = ?', [JSON.stringify(details), bookingId, userId]);
        return res.json({ success: true, status, method });
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        const index = localBookings.findIndex((item) => Number(item.id) === bookingId && Number(item.userId) === userId);
        if (index === -1) return res.status(404).json({ error: 'Booking not found' });
        localBookings[index] = {
            ...localBookings[index],
            details: patchDetails(localBookings[index].details),
        };
        return res.json({ success: true, status, method });
    }
});

router.post('/bookings/:id/payment/session', async (req, res) => {
    const bookingId = Number(req.params?.id);
    const userId = Number(req.body?.userId);
    const method = String(req.body?.method || 'upi').trim().toLowerCase();

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'Invalid booking id' });
    }
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Valid user id is required' });
    }

    try {
        await ensureBookingsTable();
        const [rows] = await db.execute(
            'SELECT id, booking_type, user_id, title, city, amount, details_json, status, created_at FROM travel_bookings WHERE id = ? AND user_id = ? LIMIT 1',
            [bookingId, userId],
        );
        if (!rows?.length) return res.status(404).json({ error: 'Booking not found' });

        const row = rows[0];
        const booking = {
            id: row.id,
            type: row.booking_type,
            userId: row.user_id,
            title: row.title,
            city: row.city,
            amount: Number(row.amount) || 0,
            details: typeof row.details_json === 'string' ? JSON.parse(row.details_json || '{}') : (row.details_json || {}),
            status: row.status,
            createdAt: row.created_at,
        };

        const sessionNotes = {
            bookingType: booking.type,
            bookingTitle: booking.title,
            bookingCity: booking.city,
            method,
        };
        const receipt = createOrderReceipt(bookingId);
        const razorpayOrder = await createRazorpayOrder({
            bookingId,
            amount: booking.amount,
            receipt,
            notes: sessionNotes,
        }).catch((error) => ({ error }));

        if (razorpayOrder?.error || !razorpayOrder) {
            const session = {
                provider: 'mock',
                status: 'created',
                method,
                orderId: `mock_${receipt}`,
                receipt,
                currency: 'INR',
                amount: booking.amount,
                keyId: null,
                checkout: {
                    name: 'InTravel AI',
                    description: `${booking.title} booking payment`,
                    prefill: {},
                    notes: sessionNotes,
                },
            };

            await persistBookingPaymentState({
                bookingId,
                userId,
                session,
                status: 'pending',
                provider: 'mock',
                method,
            });

            return res.json({
                provider: 'mock',
                ...session,
                message: 'Gateway not configured. Using secure mock checkout.',
            });
        }

        const session = {
            provider: 'razorpay',
            status: 'created',
            method,
            orderId: razorpayOrder.id,
            receipt,
            currency: razorpayOrder.currency || 'INR',
            amount: Number(booking.amount) || 0,
            keyId: process.env.RAZORPAY_KEY_ID,
            checkout: {
                name: 'InTravel AI',
                description: `${booking.title} booking payment`,
                prefill: {
                    email: booking?.details?.contactInfo?.email || '',
                    contact: booking?.details?.contactInfo?.phone || '',
                    name: booking?.details?.contactInfo?.name || '',
                },
                notes: sessionNotes,
                theme: {
                    color: '#0B74DE',
                },
            },
        };

        await persistBookingPaymentState({
            bookingId,
            userId,
            session,
            status: 'pending',
            provider: 'razorpay',
            method,
            session,
        });

        return res.json(session);
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        const booking = localBookings.find((item) => Number(item.id) === bookingId && Number(item.userId) === userId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        const sessionNotes = {
            bookingType: booking.type,
            bookingTitle: booking.title,
            bookingCity: booking.city,
            method,
        };
        const receipt = createOrderReceipt(bookingId);
        const razorpayOrder = await createRazorpayOrder({
            bookingId,
            amount: booking.amount,
            receipt,
            notes: sessionNotes,
        }).catch((error) => ({ error }));

        if (razorpayOrder?.error || !razorpayOrder) {
            const session = {
                provider: 'mock',
                status: 'created',
                method,
                orderId: `mock_${receipt}`,
                receipt,
                currency: 'INR',
                amount: booking.amount,
                keyId: null,
                checkout: {
                    name: 'InTravel AI',
                    description: `${booking.title} booking payment`,
                    prefill: {},
                    notes: sessionNotes,
                },
            };

            await persistBookingPaymentState({
                bookingId,
                userId,
                session,
                status: 'pending',
                provider: 'mock',
                method,
            });

            return res.json({
                provider: 'mock',
                ...session,
                message: 'Gateway not configured. Using secure mock checkout.',
            });
        }

        const session = {
            provider: 'razorpay',
            status: 'created',
            method,
            orderId: razorpayOrder.id,
            receipt,
            currency: razorpayOrder.currency || 'INR',
            amount: Number(booking.amount) || 0,
            keyId: process.env.RAZORPAY_KEY_ID,
            checkout: {
                name: 'InTravel AI',
                description: `${booking.title} booking payment`,
                prefill: {
                    email: booking?.details?.contactInfo?.email || '',
                    contact: booking?.details?.contactInfo?.phone || '',
                    name: booking?.details?.contactInfo?.name || '',
                },
                notes: sessionNotes,
                theme: {
                    color: '#0B74DE',
                },
            },
        };

        await persistBookingPaymentState({
            bookingId,
            userId,
            session,
            status: 'pending',
            provider: 'razorpay',
            method,
        });

        return res.json(session);
    }
});

router.post('/bookings/:id/payment/verify', async (req, res) => {
    const bookingId = Number(req.params?.id);
    const userId = Number(req.body?.userId);
    const provider = String(req.body?.provider || 'mock').trim().toLowerCase();
    const method = String(req.body?.method || 'upi').trim().toLowerCase();
    const orderId = String(req.body?.orderId || '').trim();
    const paymentId = String(req.body?.paymentId || '').trim();
    const signature = String(req.body?.signature || '').trim();
    const status = String(req.body?.status || 'success').trim().toLowerCase();

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'Invalid booking id' });
    }
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Valid user id is required' });
    }

    try {
        const verified = provider === 'razorpay'
            ? verifyRazorpaySignature({ orderId, paymentId, signature })
            : status === 'success' || status === 'paid';

        if (!verified) {
            await persistBookingPaymentState({
                bookingId,
                userId,
                session: { provider, orderId, paymentId, signature, method },
                status: 'failed',
                provider,
                method,
                paymentId,
                signature,
            });
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        const booking = await persistBookingPaymentState({
            bookingId,
            userId,
            session: { provider, orderId, paymentId, signature, method },
            status: 'success',
            provider,
            method,
            paymentId,
            signature,
        });

        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        return res.json({
            success: true,
            status: 'success',
            provider,
            method,
            orderId,
            paymentId,
        });
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        const booking = localBookings.find((item) => Number(item.id) === bookingId && Number(item.userId) === userId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        const verified = provider === 'razorpay'
            ? verifyRazorpaySignature({ orderId, paymentId, signature })
            : status === 'success' || status === 'paid';

        if (!verified) {
            await persistBookingPaymentState({
                bookingId,
                userId,
                session: { provider, orderId, paymentId, signature, method },
                status: 'failed',
                provider,
                method,
                paymentId,
                signature,
            });
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        await persistBookingPaymentState({
            bookingId,
            userId,
            session: { provider, orderId, paymentId, signature, method },
            status: 'success',
            provider,
            method,
            paymentId,
            signature,
        });

        return res.json({
            success: true,
            status: 'success',
            provider,
            method,
            orderId,
            paymentId,
        });
    }
});

router.post('/bookings/:id/send-ticket', async (req, res) => {
    const bookingId = Number(req.params?.id);
    const userId = Number(req.body?.userId);
    const requestedEmail = String(req.body?.email || '').trim();

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'Invalid booking id' });
    }
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Valid user id is required' });
    }

    const normalizeBooking = (item) => ({
        id: item.id,
        type: item.type || item.booking_type,
        title: item.title,
        city: item.city,
        amount: Number(item.amount) || 0,
        details: typeof item.details_json === 'string' ? JSON.parse(item.details_json || '{}') : (item.details || item.details_json || {}),
    });

    try {
        await ensureBookingsTable();
        const [rows] = await db.execute(
            'SELECT id, booking_type, title, city, amount, details_json FROM travel_bookings WHERE id = ? AND user_id = ? LIMIT 1',
            [bookingId, userId],
        );
        if (!rows?.length) return res.status(404).json({ error: 'Booking not found' });

        const booking = normalizeBooking(rows[0]);
        const email = requestedEmail || String(booking?.details?.contactInfo?.email || '').trim();
        if (!email) return res.status(400).json({ error: 'Recipient email is required' });

        const sent = await sendBookingTicketEmail({ email, booking });
        if (sent) return res.json({ sent: true, email });
        return res.json({ sent: false, mock: true, email, message: 'SMTP not configured. Email mocked.' });
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            return res.status(500).json({ error: err.message });
        }

        const booking = localBookings.find((item) => Number(item.id) === bookingId && Number(item.userId) === userId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        const normalized = normalizeBooking(booking);
        const email = requestedEmail || String(normalized?.details?.contactInfo?.email || '').trim();
        if (!email) return res.status(400).json({ error: 'Recipient email is required' });

        const sent = await sendBookingTicketEmail({ email, booking: normalized });
        if (sent) return res.json({ sent: true, email });
        return res.json({ sent: false, mock: true, email, message: 'SMTP not configured. Email mocked.' });
    }
});

// ── NEARBY PLACE HELPERS (WITH API FALLBACK) ──
const TIME_WINDOWS = ['7:00 AM - 9:00 AM', '9:30 AM - 12:00 PM', '1:00 PM - 3:30 PM', '4:00 PM - 6:30 PM', '7:00 PM - 9:00 PM'];
const CURATED_NEARBY = {
    goa: ['Fontainhas Latin Quarter', 'Dona Paula Viewpoint', 'Anjuna Flea Market', 'Reis Magos Fort', 'Chapora Fort', 'Basilica of Bom Jesus', 'Candolim Beach Walk'],
    manali: ['Hadimba Temple', 'Old Manali Cafes', 'Jogini Waterfall Trail', 'Vashisht Hot Springs', 'Solang Valley Viewpoint', 'Naggar Castle', 'Mall Road Local Market'],
    jaipur: ['Hawa Mahal', 'Jantar Mantar', 'Panna Meena ka Kund', 'Nahargarh Sunset Point', 'Albert Hall Museum', 'Johari Bazaar', 'Patrika Gate'],
    mumbai: ['Gateway of India', 'Kala Ghoda Art District', 'Marine Drive', 'Bandra Bandstand', 'Colaba Causeway', 'Sanjay Gandhi NP', 'Bhau Daji Lad Museum'],
    delhi: ['Humayun Tomb', 'Lodhi Garden', 'Chandni Chowk Food Lane', 'Agrasen ki Baoli', 'Dilli Haat', 'Safdarjung Tomb', 'India Gate Evening Loop'],
    bengaluru: ['Lalbagh Garden', 'Cubbon Park', 'Church Street Walk', 'VV Puram Food Street', 'Nandi Hills Sunrise Point', 'Bangalore Palace', 'Malleswaram Market'],
};

function getNearbyPool(destination) {
    const key = String(destination || '').trim().toLowerCase();
    if (CURATED_NEARBY[key]) return CURATED_NEARBY[key];
    return [
        `${destination} Heritage Quarter`,
        `${destination} Local Market Street`,
        `${destination} Signature Food Lane`,
        `${destination} Sunset Viewpoint`,
        `${destination} Art & Culture Hub`,
        `${destination} Riverside Walk`,
        `${destination} Old Town Corners`,
    ];
}

function estimateTravelMinutes(fromName, toName, dayNo, index) {
    const fingerprint = `${fromName}|${toName}|${dayNo}|${index}`.length;
    return 12 + (fingerprint % 28);
}

async function fetchTravelMinutesViaApi(fromName, toName) {
    const endpoint = process.env.TRAVEL_TIME_API_URL;
    if (!endpoint) {
        throw new Error('Travel time API not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    try {
        const url = `${endpoint}?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Travel API failed with ${response.status}`);
        const data = await response.json();
        const minutes = Number(data?.minutes);
        if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('Travel API returned invalid minutes');
        return Math.round(minutes);
    } finally {
        clearTimeout(timeoutId);
    }
}

async function buildNearbyPlan(destination, requestedDays) {
    const pool = getNearbyPool(destination);
    const days = [];
    let usedApi = false;

    for (let dayNo = 1; dayNo <= requestedDays; dayNo += 1) {
        const stopCount = 3 + (dayNo % 3); // 3 to 5 stops/day
        const start = (dayNo * 2) % pool.length;
        const places = [];

        for (let i = 0; i < stopCount; i += 1) {
            const placeName = pool[(start + i) % pool.length];
            places.push({
                name: placeName,
                bestVisitWindow: TIME_WINDOWS[(dayNo + i) % TIME_WINDOWS.length],
                travelFromPrevious: i === 0 ? 'Start point' : '',
                travelSource: i === 0 ? 'n/a' : '',
            });
        }

        for (let i = 1; i < places.length; i += 1) {
            const fromName = places[i - 1].name;
            const toName = places[i].name;
            try {
                const minutes = await fetchTravelMinutesViaApi(fromName, toName);
                places[i].travelFromPrevious = `${minutes} mins`;
                places[i].travelSource = 'api';
                usedApi = true;
            } catch {
                const fallbackMinutes = estimateTravelMinutes(fromName, toName, dayNo, i);
                places[i].travelFromPrevious = `${fallbackMinutes} mins (est.)`;
                places[i].travelSource = 'fallback';
            }
        }

        days.push({ day: dayNo, places });
    }

    return {
        source: usedApi ? 'mixed' : 'fallback',
        days,
    };
}

// ── AI TRIP PLANNER (ENHANCED) ──
router.post('/ai/plan', async (req, res) => {
    const { destination, days, duration, budget, purpose, budgetTier, styles, travelers, moodRoute, familyFriendly } = req.body;
    const requestedDays = Math.min(30, Math.max(1, Number(days ?? duration) || 1));

    const normalizedMood = String(moodRoute || '').trim().toLowerCase() || 'balanced';
    const isFamilyFriendly = Boolean(familyFriendly);

    const cacheKey = `plan:${destination}:${requestedDays}:${budget}:${purpose}:${normalizedMood}:${isFamilyFriendly ? 'family' : 'default'}`;
    const cached = getCached(cacheKey);
    if (cached) {
        if (typeof cached === 'string') {
            const nearbyPlan = await buildNearbyPlan(destination, requestedDays);
            return res.json({ itinerary: cached, nearbyPlan, cached: true });
        }
        return res.json({ ...cached, cached: true });
    }

    try {
        const purposeContext = purpose ? `This is a ${purpose} trip.` : '';
        const styleContext = styles?.length > 0 ? `Travel preferences: ${styles.join(', ')}.` : '';
        const travelersCtx = travelers ? `Traveling with ${travelers} person(s).` : '';
        const tierCtx = budgetTier ? `Budget category: ${budgetTier}.` : '';
        const moodCtx = buildMoodRoutePromptSegment(normalizedMood);
        const familyCtx = buildFamilyPromptSegment(isFamilyFriendly);

        const prompt = `Create a detailed ${requestedDays}-day travel itinerary for ${destination}, India.
        
Budget: ₹${budget} total. ${tierCtx}
    ${purposeContext} ${travelersCtx} ${styleContext}
    ${moodCtx}
    ${familyCtx}

Structure each day as:
Day [N] - [Creative Title]
🌅 Morning: [specific activity with timing]
🌞 Afternoon: [specific activity + local food recommendation]
🌙 Evening: [specific activity]
    🎭 Mood Note: [how this day reflects the selected mood route]
💰 Estimated Day Cost: ₹[amount]
💡 Pro Tip: [one unique local insider tip]

Include:
- 3 hidden gems specific to ${destination}
- Best local food spots (not just tourist restaurants)
- Transport tips (auto-rickshaw, local bus, rental options)
- Best photo spots for Instagram
- Cost breakdown summary at the end
- Keep all day labels sequential from Day 1 to Day ${requestedDays}

Be specific, practical and engaging. Use emojis for visual clarity.`;

        const text = await generateGeminiText(prompt);
        const normalized = ensureItineraryHasAllDays(text, requestedDays, destination, budget);
        const nearbyPlan = await buildNearbyPlan(destination, requestedDays);
        setCache(cacheKey, { itinerary: normalized, nearbyPlan });
        res.json({ itinerary: normalized, nearbyPlan });
    } catch (error) {
        console.error("AI Generation Error:", error);
        // Smart fallback with personalized mock
        const fallback = generateFallbackItinerary(destination, requestedDays, budget, purpose, normalizedMood, isFamilyFriendly);
        const nearbyPlan = await buildNearbyPlan(destination, requestedDays);
        res.json({ itinerary: fallback, nearbyPlan, ai_fallback: true });
    }
});

router.post('/ai/recover-day', async (req, res) => {
    const {
        destination,
        dayNumber,
        eventType,
        existingDay,
        budget,
        moodRoute,
        familyFriendly,
    } = req.body || {};

    const normalizedDay = Math.max(1, Number(dayNumber) || 1);
    const normalizedEvent = String(eventType || '').trim().toLowerCase();
    const allowedEvents = ['delay', 'rain', 'budget_overrun'];

    if (!allowedEvents.includes(normalizedEvent)) {
        return res.status(400).json({ error: 'eventType must be one of: delay, rain, budget_overrun' });
    }

    const moodCtx = buildMoodRoutePromptSegment(moodRoute);
    const familyCtx = buildFamilyPromptSegment(Boolean(familyFriendly));
    const destinationName = String(destination || 'your destination');
    const safeBudget = Math.max(4000, Number(budget) || 20000);
    const dayBudget = Math.max(800, Math.floor(safeBudget / Math.max(1, normalizedDay)));

    const disruptionNoteMap = {
        delay: 'Start later and reduce transfer friction while preserving must-do highlights.',
        rain: 'Prefer weather-safe indoor or covered experiences and short-distance travel.',
        budget_overrun: 'Reduce spend by prioritizing low-cost local options and free attractions.',
    };

    try {
        const prompt = `You are re-planning exactly one travel day for ${destinationName}, India.

Target day: Day ${normalizedDay}
Disruption type: ${normalizedEvent}
Current day plan summary: ${String(existingDay || '').slice(0, 700)}
${moodCtx}
${familyCtx}

Write only one replacement day in this exact format:
Day ${normalizedDay} - [Updated title]
🌅 Morning: ...
🌞 Afternoon: ...
🌙 Evening: ...
🎭 Mood Note: ...
💰 Estimated Day Cost: ₹...
💡 Recovery Tip: ...

Additional guidance: ${disruptionNoteMap[normalizedEvent]}`;

        const text = await generateGeminiText(prompt);
        const normalized = ensureItineraryHasAllDays(text, 1, destinationName, dayBudget);
        const recoveredDayText = normalized.split(/\n\n+/)[0] || normalized;

        return res.json({
            dayNumber: normalizedDay,
            eventType: normalizedEvent,
            recoveredDay: recoveredDayText,
        });
    } catch (error) {
        const fallback = [
            `Day ${normalizedDay} - Recovery plan for ${destinationName}`,
            '🌅 Morning: Start with a low-friction local landmark and breakfast nearby.',
            normalizedEvent === 'rain'
                ? '🌞 Afternoon: Shift to an indoor museum/cafe circuit with short travel legs.'
                : normalizedEvent === 'delay'
                    ? '🌞 Afternoon: Focus on one priority attraction and skip long queues.'
                    : '🌞 Afternoon: Choose budget-friendly local transport and affordable lunch spots.',
            '🌙 Evening: Keep the evening relaxed with a short walk and local dinner.',
            `🎭 Mood Note: Keep the mood route intact by emphasizing ${String(moodRoute || 'balanced exploration')}.`,
            `💰 Estimated Day Cost: ₹${dayBudget.toLocaleString('en-IN')}`,
            '💡 Recovery Tip: Protect one must-do experience and keep 60 mins of schedule buffer.',
        ].join('\n');

        return res.json({ dayNumber: normalizedDay, eventType: normalizedEvent, recoveredDay: fallback, fallback: true });
    }
});

// ── TRAVEL CHATBOT (ENHANCED) ──
router.post('/ai/chat', async (req, res) => {
    const { message } = req.body;
    try {
        const prompt = `You are TravelBot — an expert Indian travel assistant with encyclopedic knowledge of India's 50 states, hidden gems, festivals, cuisine, transport, and budget tips.

User Query: "${message}"

Respond in 2-4 sentences. Be friendly, specific, and add one actionable tip. Use an occasional emoji. Always mention specific places, costs in ₹, or exact timing when relevant.`;

        const reply = await generateGeminiText(prompt);
        res.json({ reply });
    } catch (error) {
        // Category-aware fallbacks
        const msg = message.toLowerCase();
        let reply = "India has amazing destinations! Tell me more about what you're looking for.";

        if (msg.includes('goa')) reply = "Goa is best visited from November to February 🏖️. North Goa is lively with beach shacks and nightlife (Baga, Calangute), while South Goa is quieter and cleaner (Palolem, Agonda). Budget: ₹2,000-3,000/day for mid-range travel. Pro tip: Rent a scooter (₹300/day) for the most authentic experience!";
        else if (msg.includes('budget') || msg.includes('cheap')) reply = "For budget travel in India, aim for ₹800-1,500/day including dorm hostel, local meals at dhabas, and buses/trains. Avoid tourist traps near monuments — walk 2 streets away for authentic food at half the price 💰.";
        else if (msg.includes('ladakh')) reply = "Ladakh is best visited June-September 🏔️. The Leh-Manali Highway opens in June and Leh-Srinagar all year. Acclimatize for 2 days before any high-altitude activities. Budget: ₹2,500-4,000/day. Inner Line Permit required for Nubra Valley and Pangong!";
        else if (msg.includes('kerala')) reply = "Kerala is magical year-round! 🌴 Monsoon (June-August) is underrated and cheaper. Must-do: Alleppey houseboat (₹3,000-8,000/night), Munnar tea gardens, and Kovalam beach. Train from Chennai to Kerala takes ~10 hours and costs under ₹500.";
        else if (msg.includes('hill station') || msg.includes('mountains')) reply = "Top hill stations in India: Manali (Himachal), Darjeeling (West Bengal), Coorg (Karnataka), Ooty (Tamil Nadu), Mussoorie (Uttarakhand) ⛰️. Best season is March-June before monsoon. Each offers unique experiences from snow sports to tea garden walks!";

        res.json({ reply });
    }
});

// ── REAL-TIME WEATHER MOCK ──
router.get('/weather/:city', async (req, res) => {
    const { city } = req.params;
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Clear'];
    const data = {
        city,
        temp: Math.floor(Math.random() * 20 + 18),
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        humidity: Math.floor(Math.random() * 40 + 40),
        wind: Math.floor(Math.random() * 20 + 5),
        uv: Math.floor(Math.random() * 6 + 4),
        forecast: Array.from({ length: 5 }, (_, i) => ({
            day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
            high: Math.floor(Math.random() * 8 + 25),
            low: Math.floor(Math.random() * 8 + 15),
            icon: ['☀️', '🌤️', '⛅', '🌦️', '☀️'][i],
        })),
    };
    res.json(data);
});

// ── CROWD PREDICTION (MOCK REAL-TIME) ──
router.get('/crowd/:destination', async (req, res) => {
    const { destination } = req.params;
    const levels = ['Low', 'Moderate', 'High', 'Very High'];
    const hour = new Date().getHours();
    const isPeakHour = hour >= 10 && hour <= 17;
    const levelIdx = isPeakHour ? Math.floor(Math.random() * 2 + 2) : Math.floor(Math.random() * 2);

    res.json({
        destination,
        currentCrowd: levels[levelIdx],
        percentage: [20, 45, 70, 90][levelIdx],
        bestTimeToVisit: '7:00 AM - 9:00 AM',
        peakHours: '11:00 AM - 3:00 PM',
        trend: isPeakHour ? 'increasing' : 'decreasing',
        tips: [
            `Visit ${destination} before 9 AM for the best experience`,
            'Weekdays are 40% less crowded than weekends',
            'January-February is the least crowded season',
        ],
    });
});

router.get('/crowd-windows/:city', async (req, res) => {
    const city = String(req.params?.city || '').trim();
    if (!city) {
        return res.status(400).json({ error: 'city is required' });
    }

    return res.json(buildCrowdClimateWindows(city));
});

// ── USER DASHBOARD (SAVED TRIPS) ──
router.get('/trips/:userId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM user_trips WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId]);
        res.json(rows);
    } catch (err) { res.json([]); }
});

router.post('/trips', async (req, res) => {
    const { userId, destination, start_date, end_date, budget, itinerary } = req.body;
    try {
        await db.execute('INSERT INTO user_trips (user_id, destination_name, start_date, end_date, budget_estimate, itinerary_json) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, destination, start_date, end_date, budget, JSON.stringify(itinerary)]);
        res.json({ message: 'Trip saved successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/trips/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM user_trips WHERE id = ?', [req.params.id]);
        res.json({ message: 'Trip deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/budget/optimizer/:userId', async (req, res) => {
    const userId = Number(req.params.userId) || 0;
    const destination = String(req.query.destination || 'Unknown').slice(0, 100);
    const fallbackKey = budgetProfileKey(userId, destination);

    try {
        await ensureBudgetProfilesTable();
        const [rows] = await db.execute(
            'SELECT payload_json FROM budget_optimizer_profiles WHERE user_id = ? AND destination_name = ? LIMIT 1',
            [userId, destination]
        );

        if (rows.length === 0) {
            return res.json({ profile: localBudgetProfiles.get(fallbackKey) || null });
        }

        return res.json({ profile: rows[0].payload_json || null });
    } catch (error) {
        if (!isDatabaseUnavailable(error)) {
            const msg = String(error?.message || '').toLowerCase();
            if (!msg.includes('budget_optimizer_profiles')) {
                return res.status(500).json({ error: error.message });
            }
        }

        return res.json({ profile: localBudgetProfiles.get(fallbackKey) || null, source: 'local' });
    }
});

router.post('/budget/optimizer', async (req, res) => {
    const sanitized = buildSanitizedProfile(req.body || {});
    const fallbackKey = budgetProfileKey(sanitized.userId, sanitized.destination);

    if (!sanitized.userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    try {
        await ensureBudgetProfilesTable();
        await db.execute(
            `INSERT INTO budget_optimizer_profiles (user_id, destination_name, mode, days, total_budget, payload_json)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             mode = VALUES(mode),
             days = VALUES(days),
             total_budget = VALUES(total_budget),
             payload_json = VALUES(payload_json),
             updated_at = CURRENT_TIMESTAMP`,
            [
                sanitized.userId,
                sanitized.destination,
                sanitized.mode,
                sanitized.days,
                sanitized.totalBudget,
                JSON.stringify(sanitized),
            ]
        );

        return res.json({ message: 'Budget optimizer profile saved', profile: sanitized });
    } catch (error) {
        if (!isDatabaseUnavailable(error)) {
            const msg = String(error?.message || '').toLowerCase();
            if (!msg.includes('budget_optimizer_profiles')) {
                return res.status(500).json({ error: error.message });
            }
        }

        localBudgetProfiles.set(fallbackKey, sanitized);
        return res.json({ message: 'Budget optimizer profile saved (local mode)', profile: sanitized, source: 'local' });
    }
});

// ── NEARBY SUGGESTIONS (MOCK) ──
router.get('/nearby', async (req, res) => {
    const { city } = req.query;
    res.json({
        attractions: [
            { name: `${city} Museum`, type: 'attraction', rating: 4.3, distance: '1.2 km', open: '10:00–18:00', entry: '₹50' },
            { name: 'Local Heritage Walk', type: 'experience', rating: 4.7, distance: '0.5 km', open: 'All day', entry: 'Free' },
        ],
        restaurants: [
            { name: 'Dhaba Express', cuisine: 'North Indian', rating: 4.5, distance: '0.8 km', avgCost: '₹200 for two', openNow: true },
            { name: 'Chai Point', cuisine: 'Snacks & Tea', rating: 4.2, distance: '0.3 km', avgCost: '₹80 for two', openNow: true },
        ],
        events: [
            { name: 'Local Cultural Show', date: 'Today', time: '7:00 PM', venue: 'Town Hall', entry: '₹100' },
        ],
    });
});

// ── COMMUNITY REVIEWS ──
router.get('/reviews/:city', async (req, res) => {
    const city = String(req.params.city || '').trim();
    if (!city) return res.status(400).json({ error: 'city is required' });

    try {
        const [rows] = await db.execute(`
            SELECT r.*, u.username as user_name 
            FROM reviews r 
            LEFT JOIN users u ON r.user_id = u.id 
            WHERE r.destination_name = ? 
            ORDER BY r.created_at DESC
        `, [city]);
        res.json(rows.length > 0 ? rows : localReviews.filter(r => r.city === city));
    } catch (err) {
        res.json(localReviews.filter(r => r.city === city));
    }
});

router.post('/reviews', async (req, res) => {
    const { userId, city, rating, comment } = req.body;

    if (!city || !Number.isFinite(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
        return res.status(400).json({ error: 'city and rating (1-5) are required' });
    }

    const sanitizedReview = {
        city: String(city).trim(),
        user_name: userId ? `User${userId}` : 'Guest',
        rating: Number(rating),
        comment: String(comment || '').trim(),
        created_at: new Date().toISOString(),
    };

    try {
        await db.execute(
            'INSERT INTO reviews (user_id, destination_name, rating, comment) VALUES (?, ?, ?, ?)',
            [userId || null, sanitizedReview.city, sanitizedReview.rating, sanitizedReview.comment]
        );
        res.status(201).json({ message: 'Review added' });
    } catch (err) {
        if (!isDatabaseUnavailable(err)) {
            const msg = String(err?.message || '').toLowerCase();
            if (!msg.includes('reviews')) {
                return res.status(500).json({ error: err.message });
            }
        }

        localReviews.unshift(sanitizedReview);
        res.status(201).json({ message: 'Review added (local mode)', source: 'local' });
    }
});

// ── PAYMENTS (MOCK CHECKOUT) ──
router.post('/checkout', async (req, res) => {
    const { amount, purpose } = req.body;
    const normalizedAmount = Number(amount);
    const normalizedPurpose = String(purpose || '').trim();

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedPurpose.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'amount (> 0) and purpose are required',
        });
    }

    // Simulate payment processor delay
    setTimeout(() => {
        res.json({
            success: true,
            transactionId: 'txn_' + Math.random().toString(36).substr(2, 9),
            amount: normalizedAmount,
            purpose: normalizedPurpose,
            currency: 'INR',
            message: `Processed ₹${normalizedAmount} for ${normalizedPurpose}`
        });
    }, 1500);
});

// ── HELPERS ──
function generateFallbackItinerary(destination, days, budget, purpose, moodRoute = 'balanced', familyFriendly = false) {
    const dayBudget = Math.floor(budget / days);
    let itinerary = '';
    const activities = [
        ['Visit the primary historical landmarks.', 'Explore local art galleries and museums.', 'Walking tour of central squares.'],
        ['Visit a nearby holy temple or spiritual center.', 'Explore bustling local markets and bazaars.', 'Try a traditional workshop or cooking class.'],
        ['Relax at a local park or lakeside.', 'Discover offbeat street art and hidden alleys.', 'Take a bicycle tour of the countryside.'],
        ['Hike or walk to a high viewpoint.', 'Visit a botanical garden or zoo.', 'Go on a local street food tasting tour.']
    ];

    for (let d = 1; d <= days; d++) {
        const actSet = activities[(d - 1) % activities.length];
        itinerary += `Day ${d} — ${d === 1 ? 'Arrival & Welcome' : d === days ? 'Memories & Departure' : 'Deeper Exploration'} in ${destination}\n`;
        itinerary += `🌅 Morning: ${actSet[0]} Start early to enjoy the best weather.\n`;
        itinerary += `🌞 Afternoon: ${actSet[1]} Sample authentic local flavors for lunch.\n`;
        itinerary += `🌙 Evening: ${actSet[2]} Reflection at sunset and a relaxing local dinner.\n`;
        itinerary += `🎭 Mood Note: This day follows a ${String(moodRoute || 'balanced')} route focus.\n`;
        if (familyFriendly) {
            itinerary += '👨‍👩‍👧 Family Adjustment: Keep transfers short and prefer low-step, accessible stops.\n';
        }
        itinerary += `💰 Estimated Day Cost: ₹${dayBudget.toLocaleString('en-IN')}\n`;
        itinerary += `💡 Pro Tip: ${d % 2 === 0 ? 'Ask a local for their favorite hidden cafe.' : 'Bargain politely at markets for the best prices.'}\n\n`;
    }
    return itinerary.trim();
}

function ensureItineraryHasAllDays(text, requestedDays, destination, budget) {
    if (!text || typeof text !== 'string') {
        return generateFallbackItinerary(destination, requestedDays, budget || 20000, 'general');
    }

    const dayRegex = /(^|\n)\s*Day\s*\d+\s*[-–—:]?\s*[^\n]*/gim;
    const matches = [...text.matchAll(dayRegex)];
    if (matches.length === 0) {
        return generateFallbackItinerary(destination, requestedDays, budget || 20000, 'general');
    }

    const blocks = matches.map((match, index) => {
        const start = match.index + match[1].length;
        const end = index < matches.length - 1 ? matches[index + 1].index : text.length;
        return text.slice(start, end).trim();
    }).slice(0, requestedDays);

    const safeBudget = Math.max(5000, Number(budget) || 20000);
    const perDay = Math.floor(safeBudget / requestedDays);

    const templates = [
        {
            title: (dayNo) => `Day ${dayNo} - Heritage trail in ${destination}`,
            lines: [
                '🌅 Morning: Explore a major landmark and nearby old streets.',
                '🌞 Afternoon: Visit one museum/fort and enjoy regional lunch.',
                '🌙 Evening: Stroll through the city center and local bazaar.',
            ],
        },
        {
            title: (dayNo) => `Day ${dayNo} - Food and culture circuit in ${destination}`,
            lines: [
                '🌅 Morning: Start with a breakfast trail in a local neighborhood.',
                '🌞 Afternoon: Try a curated food lane and one cultural stop.',
                '🌙 Evening: Attend a local performance or riverside walk.',
            ],
        },
        {
            title: (dayNo) => `Day ${dayNo} - Nature and viewpoint day in ${destination}`,
            lines: [
                '🌅 Morning: Visit a scenic park, lake, or sunrise viewpoint.',
                '🌞 Afternoon: Take a short trail or activity session nearby.',
                '🌙 Evening: Capture golden-hour photos and unwind with tea.',
            ],
        },
    ];

    function makeUniqueBlock(dayNo) {
        const tpl = templates[(dayNo - 1) % templates.length];
        return [
            tpl.title(dayNo),
            ...tpl.lines,
            `💰 Estimated Day Cost: ₹${perDay.toLocaleString('en-IN')}`,
            `💡 Pro Tip: Keep 30-45 mins flexible on Day ${dayNo} for local discoveries.`,
        ].join('\n');
    }

    const seen = new Set();
    for (let i = 0; i < blocks.length; i += 1) {
        const fingerprint = blocks[i].replace(/\s+/g, ' ').trim().toLowerCase();
        if (!fingerprint || seen.has(fingerprint)) {
            blocks[i] = makeUniqueBlock(i + 1);
        }
        seen.add(blocks[i].replace(/\s+/g, ' ').trim().toLowerCase());
    }

    while (blocks.length < requestedDays) {
        const dayNo = blocks.length + 1;
        blocks.push(makeUniqueBlock(dayNo));
    }

    return blocks.join('\n\n');
}

// ── MOCK DATA ──
const mockDestinations = [
    {
        id: 1, name: 'Goa', state: 'Goa', category: 'Beach',
        description: 'Sun, sand, and sea. Explore the vibrant beaches and laid-back Portuguese-influenced culture of India\'s smallest state.',
        attractions: 'Baga Beach, Calangute Beach, Old Goa Churches, Dudhsagar Falls, Anjuna Flea Market',
        best_time: 'Nov–Feb',
        travel_tips: 'Rent a scooter (₹300/day) to explore. Avoid peak Christmas–New Year period for lower prices and fewer crowds.',
        nearby_places: 'Hampi, Gokarna, Karwar, Coorg',
        // Goa beach with golden sand and palm trees
        image_url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop'
    },
    {
        id: 2, name: 'Manali', state: 'Himachal Pradesh', category: 'Mountain',
        description: 'High-altitude Himalayan resort town blanketed in snow. Perfect for adventure sports, river rafting, and mountain treks.',
        attractions: 'Solang Valley Snow Point, Rohtang Pass, Hadimba Devi Temple, Old Manali Cafes, Beas River',
        best_time: 'Mar–Jun & Oct–Nov',
        travel_tips: 'Carry warm clothes even in summer. Book Rohtang Pass permit online 24h in advance. Avoid during winter road closures.',
        nearby_places: 'Kullu, Kasol, Kheerganga, Spiti Valley',
        // Manali snow-capped Himalayan mountains
        image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop'
    },
    {
        id: 3, name: 'Jaipur', state: 'Rajasthan', category: 'Heritage',
        description: 'The Pink City — a royal tapestry of Mughal and Rajput architecture, colourful bazaars, and legendary palaces.',
        attractions: 'Hawa Mahal, Amber Fort, City Palace, Jantar Mantar, Nahargarh Fort',
        best_time: 'Oct–Mar',
        travel_tips: 'Bargain hard at Johari Bazaar. Visit Amber Fort at 7 AM to beat crowds and heat. Combo ticket covers 5 monuments.',
        nearby_places: 'Pushkar, Ajmer, Ranthambore, Udaipur',
        // Hawa Mahal — the iconic Palace of Winds in Jaipur
        image_url: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&auto=format&fit=crop'
    },
    {
        id: 4, name: 'Varanasi', state: 'Uttar Pradesh', category: 'Spiritual',
        description: 'One of the world\'s oldest living cities. An eternal city of ghats, temples, and sacred fires on the holy Ganges.',
        attractions: 'Dashashwamedh Ghat, Ganga Aarti, Kashi Vishwanath Temple, Sarnath, Assi Ghat',
        best_time: 'Oct–Mar',
        travel_tips: 'Wake before sunrise for the magical boat ride on the Ganges. Evening Ganga Aarti at 6:30 PM is unmissable.',
        nearby_places: 'Allahabad (Prayagraj), Ayodhya, Bodh Gaya, Sarnath',
        // Varanasi ghats with boats and temple spires on the Ganges
        image_url: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=800&auto=format&fit=crop'
    },
    {
        id: 5, name: 'Kerala (Alleppey)', state: 'Kerala', category: 'Nature',
        description: 'God\'s Own Country. Serene backwaters, iconic houseboats, lush tea gardens, and pristine Malabar coastlines.',
        attractions: 'Alleppey Backwaters, Munnar Tea Gardens, Periyar Wildlife Sanctuary, Varkala Cliff Beach',
        best_time: 'Sep–Mar',
        travel_tips: 'Book houseboats 2 weeks ahead in season. Monsoon (Jun–Aug) is scenic and cheaper — check flood alerts.',
        nearby_places: 'Kochi, Kovalam, Thekkady, Varkala',
        // Kerala houseboat on tranquil backwaters lined with coconut palms
        image_url: 'https://images.unsplash.com/photo-1593693411515-c20261bcad6e?w=800&auto=format&fit=crop'
    },
    {
        id: 6, name: 'Ladakh', state: 'Jammu & Kashmir', category: 'Adventure',
        description: 'Land of High Passes. Surreal moonscapes, azure glacial lakes, ancient Buddhist monasteries, and world-class biking routes.',
        attractions: 'Pangong Tso Lake, Nubra Valley, Hemis Monastery, Khardung La Pass, Zanskar Valley',
        best_time: 'Jun–Sep',
        travel_tips: 'Acclimatize at Leh for 2 full days before high-altitude trips. Inner Line Permit required for Nubra & Pangong.',
        nearby_places: 'Srinagar, Spiti Valley, Kargil',
        // Pangong Lake Ladakh — vivid blue waters against desert mountains
        image_url: 'https://images.unsplash.com/photo-1581791538305-8ec692e0377b?w=800&auto=format&fit=crop'
    },
    {
        id: 7, name: 'Agra', state: 'Uttar Pradesh', category: 'Heritage',
        description: 'Home to the immortal Taj Mahal — a UNESCO World Heritage site and one of the Seven Wonders of the World.',
        attractions: 'Taj Mahal, Agra Fort, Fatehpur Sikri, Mehtab Bagh, Itimad-ud-Daulah',
        best_time: 'Oct–Mar',
        travel_tips: 'Visit Taj at sunrise for golden light and fewer crowds. Full moon nights are ethereal (special tickets required).',
        nearby_places: 'Mathura, Vrindavan, Jaipur, Delhi',
        // The Taj Mahal, Agra — white marble mausoleum reflected in water
        image_url: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&auto=format&fit=crop'
    },
    {
        id: 8, name: 'Darjeeling', state: 'West Bengal', category: 'Mountain',
        description: 'The Queen of Hills. Endless tea gardens, the legendary toy train, and a jaw-dropping view of Kangchenjunga at dawn.',
        attractions: 'Tiger Hill Sunrise, Tea Garden Tours, Darjeeling Himalayan Railway, Peace Pagoda, Zoo',
        best_time: 'Mar–May & Sep–Nov',
        travel_tips: 'Book Tiger Hill jeep at 3 AM for sunrise. Buy first-flush Darjeeling tea directly from gardens — far cheaper.',
        nearby_places: 'Gangtok, Kalimpong, Pelling, Mirik',
        // Darjeeling tea plantations with hills in the background
        image_url: 'https://images.unsplash.com/photo-1442544213729-6a15f1611937?w=800&auto=format&fit=crop'
    },
    {
        id: 9, name: 'Mysore', state: 'Karnataka', category: 'Heritage',
        description: 'The City of Palaces. Opulent royal palaces, fragrant sandalwood, magnificent Dussehra celebrations, and serene gardens.',
        attractions: 'Mysore Palace, Chamundeshwari Temple, Brindavan Gardens, Mysore Zoo, Devaraja Market',
        best_time: 'Oct (Dussehra) & Nov–Feb',
        travel_tips: 'Visit during Dussehra (Oct) when the palace is lit with 100,000 bulbs. Saree shopping in the palace complex is great.',
        nearby_places: 'Coorg, Ooty, Bangalore, Wayanad',
        // Mysore Palace — majestic heritage architecture
        image_url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&auto=format&fit=crop'
    },
    {
        id: 10, name: 'Andaman Islands', state: 'Andaman & Nicobar', category: 'Beach',
        description: 'Pristine emerald seas, white-sand beaches, world-class snorkelling, and a haunting colonial history at Cellular Jail.',
        attractions: 'Radhanagar Beach, Elephant Beach, Cellular Jail, Havelock Island, Neil Island',
        best_time: 'Nov–May',
        travel_tips: 'Book inter-island ferries 2–3 days in advance. Carry cash — ATMs are scarce on smaller islands.',
        nearby_places: 'Port Blair, Neil Island, Baratang',
        // Crystal clear turquoise Andaman sea with tropical beach
        image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop'
    },
];

const mockTransport = [
    { from: 'Delhi', to: 'Mumbai', mode: 'Flight', price: 4500, duration: '2h 15m', operator: 'IndiGo/Air India' },
    { from: 'Delhi', to: 'Mumbai', mode: 'Train', price: 1200, duration: '16h 00m', operator: 'Rajdhani Express' },
    { from: 'Delhi', to: 'Mumbai', mode: 'Bus', price: 1500, duration: '22h 00m', operator: 'Volvo AC Sleeper' },
    { from: 'Mumbai', to: 'Goa', mode: 'Train', price: 600, duration: '9h 00m', operator: 'Konkan Railway' },
    { from: 'Mumbai', to: 'Goa', mode: 'Flight', price: 3500, duration: '1h 15m', operator: 'IndiGo' },
    { from: 'Delhi', to: 'Jaipur', mode: 'Train', price: 300, duration: '4h 30m', operator: 'Shatabdi Express' },
    { from: 'Delhi', to: 'Jaipur', mode: 'Bus', price: 450, duration: '6h 00m', operator: 'RSRTC Volvo' },
];

const mockHotels = [
    // Goa hotels — beach resort imagery
    { city: 'Goa', name: 'Taj Exotica Resort & Spa', price_per_night: 15000, rating: 4.8, amenities: 'Private Beach, Infinity Pool, Spa, Fine Dining', image_url: 'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=300&auto=format&fit=crop' },
    { city: 'Goa', name: 'Novotel Shrem Goa', price_per_night: 6500, rating: 4.4, amenities: 'Pool, WiFi, Restaurant, Beach Access', image_url: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=300&auto=format&fit=crop' },
    { city: 'Goa', name: 'Casa Baga Hostel', price_per_night: 1800, rating: 4.1, amenities: 'Rooftop Bar, WiFi, Breakfast Included', image_url: 'https://images.unsplash.com/photo-1556742400-b5b7c512f7b7?w=300&auto=format&fit=crop' },
    // Manali hotels — mountain lodge imagery
    { city: 'Manali', name: 'The Himalayan Resort', price_per_night: 9500, rating: 4.7, amenities: 'Snow-View Rooms, Spa, Bonfire, Restaurant', image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&auto=format&fit=crop' },
    { city: 'Manali', name: 'Span Resort & Spa', price_per_night: 5500, rating: 4.3, amenities: 'River View, Spa, Trekking Tours', image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=300&auto=format&fit=crop' },
    // Jaipur hotels — heritage palace imagery
    { city: 'Jaipur', name: 'Rambagh Palace', price_per_night: 28000, rating: 4.9, amenities: 'Royal Heritage, Pool, Fine Dining, Polo', image_url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=300&auto=format&fit=crop' },
    { city: 'Jaipur', name: 'ITC Rajputana', price_per_night: 8000, rating: 4.5, amenities: 'Pool, Rajasthani Cuisine, Spa, Business Center', image_url: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=300&auto=format&fit=crop' },
    // Varanasi hotels — riverside ghat-view imagery
    { city: 'Varanasi', name: 'BrijRama Palace', price_per_night: 12000, rating: 4.8, amenities: 'Ghat-View Rooms, Heritage, Ganga Aarti View', image_url: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=300&auto=format&fit=crop' },
    { city: 'Varanasi', name: 'Ganges View Hotel', price_per_night: 3500, rating: 4.2, amenities: 'Rooftop Ganges View, Yoga, Ayurveda', image_url: 'https://images.unsplash.com/photo-1560624052-449f5ddf0c31?w=300&auto=format&fit=crop' },
    // Kerala hotels — houseboat & backwater imagery
    { city: 'Kerala (Alleppey)', name: 'Kumarakom Lake Resort', price_per_night: 18000, rating: 4.9, amenities: 'Overwater Villas, Ayurveda Spa, Backwater Cruise', image_url: 'https://images.unsplash.com/photo-1593693411515-c20261bcad6e?w=300&auto=format&fit=crop' },
    { city: 'Kerala (Alleppey)', name: 'Alleppey Houseboat', price_per_night: 6000, rating: 4.6, amenities: 'Private Houseboat, Chef, A/C Bedroom, Sunset Views', image_url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=300&auto=format&fit=crop' },
    // Ladakh hotels — mountain lodge imagery
    { city: 'Ladakh', name: 'The Grand Dragon Ladakh', price_per_night: 11000, rating: 4.7, amenities: 'Himalayan Views, Heated Rooms, Cultural Shows', image_url: 'https://images.unsplash.com/photo-1589556264800-08ae9e129a8e?w=300&auto=format&fit=crop' },
    { city: 'Ladakh', name: 'Stok Palace Heritage Hotel', price_per_night: 7000, rating: 4.5, amenities: 'Royal Palace Stay, Monastery Views, Stargazing', image_url: 'https://images.unsplash.com/photo-1596627116790-af6f46dddbf5?w=300&auto=format&fit=crop' },
    // Agra hotels — Taj Mahal view
    { city: 'Agra', name: 'The Oberoi Amarvilas', price_per_night: 45000, rating: 5.0, amenities: 'Taj Mahal View from Every Room, Pool, Fine Dining', image_url: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=300&auto=format&fit=crop' },
    { city: 'Agra', name: 'ITC Mughal Hotel', price_per_night: 9000, rating: 4.6, amenities: 'Mughal Gardens, Pool, Dum Pukht Restaurant', image_url: 'https://images.unsplash.com/photo-1608037521244-f1c6c7635194?w=300&auto=format&fit=crop' },
    // Andaman hotels
    { city: 'Andaman Islands', name: 'Taj Exotica Resort Andamans', price_per_night: 22000, rating: 4.8, amenities: 'Private Beach, Overwater Bar, Coral Reef Snorkelling', image_url: 'https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=300&auto=format&fit=crop' },
];

const mockReviews = [
    { city: 'Goa', user_name: 'TravelBug', rating: 5, comment: 'Absolutely amazing! Renting a scooter is a must.', created_at: new Date().toISOString() },
    { city: 'Goa', user_name: 'Wanderer', rating: 4, comment: 'Great food but crowded in December.', created_at: new Date().toISOString() },
    { city: 'Manali', user_name: 'SnowLover', rating: 5, comment: 'Magical snowfall! Solang valley was gorgeous.', created_at: new Date().toISOString() },
    { city: 'Jaipur', user_name: 'HeritageFan', rating: 5, comment: 'The forts are breathtaking. Go early to beat the heat!', created_at: new Date().toISOString() }
];

localReviews = [...mockReviews];

module.exports = router;
