const express = require('express');
const router = express.Router();
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
let budgetProfilesTableReady = false;
const authRateStore = new Map();

const MIN_PASSWORD_LENGTH = 8;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_VERIFY_MAX_ATTEMPTS = 5;
const REQUEST_RESET_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };
let otpTransporter;

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
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [normalizedUsername, email, hashedPassword]);
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
                return res.status(400).json({ error: 'Email already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            localUsersByEmail.set(email, {
                id: Date.now(),
                username: normalizedUsername,
                email,
                password: hashedPassword,
            });
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
            return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        }

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, users[0].password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: users[0].id, username: users[0].username }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.json({ token, user: { id: users[0].id, username: users[0].username } });
    } catch (error) {
        if (isDatabaseUnavailable(error)) {
            const email = normalizeEmail(req.body?.email);
            const { password } = req.body;
            const user = localUsersByEmail.get(email);
            if (!user) return res.status(401).json({ error: 'Invalid credentials' });

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

            const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
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
            return res.status(429).json({ error: 'Too many reset requests. Please try again later.' });
        }

        const { user } = await findUserByEmail(email);
        // Return generic response to avoid leaking account existence.
        if (!user) {
            return res.json({ message: 'If an account exists for this email, an OTP has been generated.' });
        }

        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        resetOtpStore.set(email, {
            otpHash,
            attempts: 0,
            expiresAt: Date.now() + OTP_EXPIRY_MS,
        });

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

        const otpEntry = resetOtpStore.get(email);
        if (!otpEntry) return res.status(400).json({ error: 'No OTP request found for this email' });
        if (Date.now() > otpEntry.expiresAt) {
            resetOtpStore.delete(email);
            return res.status(400).json({ error: 'OTP expired. Request a new one.' });
        }

        if (otpEntry.attempts >= OTP_VERIFY_MAX_ATTEMPTS) {
            resetOtpStore.delete(email);
            return res.status(429).json({ error: 'Too many invalid attempts. Request a new OTP.' });
        }

        const validOtp = await bcrypt.compare(String(otp), otpEntry.otpHash);
        if (!validOtp) {
            otpEntry.attempts += 1;
            resetOtpStore.set(email, otpEntry);
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

// ── TRANSPORT ROUTES ──
router.get('/transport', async (req, res) => {
    const { from, to } = req.query;
    try {
        const [rows] = await db.execute('SELECT * FROM transport WHERE from_city = ? AND to_city = ?', [from, to]);
        res.json(rows.length > 0 ? rows : mockTransport.filter(t => t.from === from && t.to === to));
    } catch (err) { res.json(mockTransport.filter(t => t.from === from && t.to === to)); }
});

// ── HOTEL ROUTES ──
router.get('/hotels', async (req, res) => {
    const { city } = req.query;
    try {
        const [rows] = await db.execute('SELECT * FROM hotels WHERE city = ?', [city]);
        res.json(rows.length > 0 ? rows : mockHotels.filter(h => h.city === city));
    } catch (err) { res.json(mockHotels.filter(h => h.city === city)); }
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
    const { destination, days, duration, budget, purpose, budgetTier, styles, travelers } = req.body;
    const requestedDays = Math.min(30, Math.max(1, Number(days ?? duration) || 1));

    const cacheKey = `plan:${destination}:${requestedDays}:${budget}:${purpose}`;
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

        const prompt = `Create a detailed ${requestedDays}-day travel itinerary for ${destination}, India.
        
Budget: ₹${budget} total. ${tierCtx}
${purposeContext} ${travelersCtx} ${styleContext}

Structure each day as:
Day [N] - [Creative Title]
🌅 Morning: [specific activity with timing]
🌞 Afternoon: [specific activity + local food recommendation]
🌙 Evening: [specific activity]
💰 Estimated Day Cost: ₹[amount]
💡 Pro Tip: [one unique local insider tip]

Include:
- 3 hidden gems specific to ${destination}
- Best local food spots (not just tourist restaurants)
- Transport tips (auto-rickshaw, local bus, rental options)
- Best photo spots for Instagram
- Cost breakdown summary at the end

Be specific, practical and engaging. Use emojis for visual clarity.`;

        const text = await generateGeminiText(prompt);
        const normalized = ensureItineraryHasAllDays(text, requestedDays, destination, budget);
        const nearbyPlan = await buildNearbyPlan(destination, requestedDays);
        setCache(cacheKey, { itinerary: normalized, nearbyPlan });
        res.json({ itinerary: normalized, nearbyPlan });
    } catch (error) {
        console.error("AI Generation Error:", error);
        // Smart fallback with personalized mock
        const fallback = generateFallbackItinerary(destination, requestedDays, budget, purpose);
        const nearbyPlan = await buildNearbyPlan(destination, requestedDays);
        res.json({ itinerary: fallback, nearbyPlan, ai_fallback: true });
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
function generateFallbackItinerary(destination, days, budget, purpose) {
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
