const express = require('express');
const router = express.Router();
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// ── AI Setup (Gemini) ──
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_GEMINI_KEY");

// ── Simple In-Memory Cache ──
const cache = new Map();
function getCached(key) { const v = cache.get(key); if (v && Date.now() - v.ts < 600000) return v.data; }
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

// ── AUTH ROUTES ──
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        
        const valid = await bcrypt.compare(password, users[0].password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ id: users[0].id, username: users[0].username }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.json({ token, user: { id: users[0].id, username: users[0].username } });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// ── AI TRIP PLANNER (DYNAMIC & ROBUST) ──
router.post('/ai/plan', async (req, res) => {
    const { destination, days = 3, budget = 20000, purpose, budgetTier, styles, travelers = 2 } = req.body;
    
    const cacheKey = `plan:${destination}:${days}:${budget}:${purpose}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ itinerary: cached, cached: true });
    
    try {
        // Use Gemini 1.5 Flash for the fastest and most reliable response
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const purposeContext = purpose ? `This is a ${purpose} trip.` : '';
        const styleContext = styles?.length > 0 ? `Travel preferences: ${styles.join(', ')}.` : '';
        const travelersCtx = travelers ? `Traveling with ${travelers} person(s).` : '';
        const tierCtx = budgetTier ? `Budget category: ${budgetTier}.` : '';
        
        const prompt = `Create a detailed ${days}-day travel itinerary for ${destination}, India.
        
Budget: ₹${budget.toLocaleString('en-IN')} total. ${tierCtx}
${purposeContext} ${travelersCtx} ${styleContext}

Structure each day clearly as:
Day [N] - [Creative Title]
🌅 Morning: [specific activity with timing]
🌞 Afternoon: [specific activity + local food suggestion]
🌙 Evening: [specific activity + dinner spot]
💰 Estimated Day Cost: ₹[amount]
💡 Pro Tip: [unique local insider trick]

Extra Requirements:
- Mention at least 3 hidden gems in ${destination}
- Include local transport tips (Auto, Bus, or Rentals)
- Include best photography spots
- Mandatory: Breakdown costs at the end.
- Keep tone engaging and use emojis.`;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        setCache(cacheKey, text);
        res.json({ itinerary: text });
    } catch (error) {
        console.error("AI Generation Error:", error.message);
        // Robust fallback with personalized mock
        const fallback = generateFallbackItinerary(destination, Number(days), Number(budget), purpose);
        res.json({ itinerary: fallback, ai_fallback: true });
    }
});

// ── TRAVEL CHATBOT ──
router.post('/ai/chat', async (req, res) => {
    const { message } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `You are TravelBot. Expert on India's 50 states and union territories. 
        User says: "${message}"
        Respond in 2-4 sentences with friendly vibes, specifics about places/costs, and one tip.`;
        
        const result = await model.generateContent(prompt);
        res.json({ reply: result.response.text() });
    } catch (error) {
        res.json({ reply: "India has endless wonders! Try asking about Goa beaches, Ladakh treks, or luxury stays in Jaipur 🏰." });
    }
});

// ── OTHER ROUTES (WEATHER, CROWD, TRIPS) ──
router.get('/weather/:city', (req, res) => {
    const city = req.params.city;
    res.json({
        city, temp: 28, condition: 'Sunny', humidity: 60, wind: 12, uv: 7,
        forecast: [
            { day: 'Mon', high: 30, low: 22, icon: '☀️' },
            { day: 'Tue', high: 29, low: 21, icon: '🌤️' },
            { day: 'Wed', high: 31, low: 23, icon: '☀️' }
        ]
    });
});

router.get('/crowd/:destination', (req, res) => {
    res.json({
        destination: req.params.destination,
        currentCrowd: 'Moderate',
        percentage: 45,
        bestTimeToVisit: '7:00 AM - 9:00 AM',
        tips: ['Visit early morning', 'Avoid weekends']
    });
});

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

// ── HELPERS ──
function generateFallbackItinerary(destination, days, budget, purpose) {
    const dayBudget = Math.floor(budget / days);
    let itinerary = `Fallback Plan for ${destination} (${days} Days):\n\n`;
    for (let d = 1; d <= days; d++) {
        itinerary += `Day ${d} - Exploring ${destination}\n`;
        itinerary += `🌅 Morning: Historical walk and cultural breakfast.\n`;
        itinerary += `🌞 Afternoon: Main landmarks and local lunch.\n`;
        itinerary += `🌙 Evening: Market stroll and sunset viewpoint.\n`;
        itinerary += `💰 Daily Budget: ₹${dayBudget.toLocaleString('en-IN')}\n\n`;
    }
    return itinerary.trim();
}

// ── MOCK DATA ──
const mockDestinations = [
    { id: 1, name: 'Goa', state: 'Goa', category: 'Beach', description: 'Beaches and nightlife.', attractions: 'Calangute, Baga', best_time: 'Nov-Feb', image_url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop' },
    { id: 2, name: 'Manali', state: 'Himachal', category: 'Mountain', description: 'Snowy mountains.', attractions: 'Solang Valley', best_time: 'Mar-Jun', image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop' },
    { id: 3, name: 'Jaipur', state: 'Rajasthan', category: 'Heritage', description: 'Royal palaces.', attractions: 'Hawa Mahal', best_time: 'Oct-Mar', image_url: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&auto=format&fit=crop' }
];

const mockTransport = [];
const mockHotels = [];

module.exports = router;
