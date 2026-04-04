import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  Compass, Calendar, Calculator, Sparkles, TrendingUp, MapPin,
  Star, Award, ArrowRight, ChevronRight
} from 'lucide-react';
import './Home.css';

// Animated counter hook
function useCounter(end, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return [count, () => setStarted(true)];
}

function StatItem({ end, label, suffix = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, start] = useCounter(end);

  useEffect(() => { if (isInView) start(); }, [isInView]);

  return (
    <div ref={ref} className="stat-counter">
      <span className="stat-number heading-gradient">{count.toLocaleString()}{suffix}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

const trendingDestinations = [
  { rank: 1, name: 'Varanasi', desc: 'Experience the spiritual Ganga Aarti at night.', stat: '45% increase in visitors', icon: '🕯️', color: '#f59e0b', category: 'Spiritual' },
  { rank: 2, name: 'Ladakh', desc: 'Road-trip through the highest passes in the world.', stat: 'Adventure season starts soon', icon: '🏔️', color: '#6366f1', category: 'Adventure' },
  { rank: 3, name: 'Goa', desc: 'Pristine beaches, vibrant nightlife, and seafood.', stat: 'Peak beach season now', icon: '🏖️', color: '#10b981', category: 'Beach' },
  { rank: 4, name: 'Darjeeling', desc: 'Toy train rides and morning tea gardens.', stat: 'Peak visibility for Kanchenjunga', icon: '🚂', color: '#a855f7', category: 'Mountain' },
  { rank: 5, name: 'Rajasthan', desc: 'Majestic forts, camels, and desert sunsets.', stat: '60% bookings up this season', icon: '🏜️', color: '#f43f5e', category: 'Heritage' },
  { rank: 6, name: 'Kerala', desc: 'Backwaters, houseboat rides, and spice gardens.', stat: 'Monsoon paradise in season', icon: '🌴', color: '#06b6d4', category: 'Nature' },
];

const festivals = [
  { date: 'MAR 25', name: 'Holi - Festival of Colors', place: 'Mathura & Varanasi', desc: 'Experience the tradition and vibrant energy.', color: '#f43f5e', emoji: '🎨' },
  { date: 'APR 14', name: 'Baisakhi - Harvest Festival', place: 'Amritsar (Golden Temple)', desc: 'A soulful time with Langar and celebrations.', color: '#f59e0b', emoji: '🌾' },
  { date: 'JUN 20', name: 'Rath Yatra', place: 'Puri (Odisha)', desc: 'Witness the grand chariot procession.', color: '#6366f1', emoji: '🛕' },
  { date: 'OCT 02', name: 'Navratri Festival', place: 'Gujarat & All of India', desc: 'Nine nights of dance, devotion and music.', color: '#a855f7', emoji: '💃' },
  { date: 'NOV 12', name: 'Diwali - Festival of Lights', place: 'Across India', desc: 'Millions of lamps light up the nation.', color: '#fbbf24', emoji: '🪔' },
];

const categories = [
  { name: 'Mountains', emoji: '🏔️', color: '#6366f1', bg: 'mountain', count: '24 destinations' },
  { name: 'Beaches', emoji: '🏖️', color: '#06b6d4', bg: 'beach', count: '18 destinations' },
  { name: 'Spiritual', emoji: '🛕', color: '#f59e0b', bg: 'temple', count: '31 destinations' },
  { name: 'Heritage', emoji: '🏰', color: '#f43f5e', bg: 'desert', count: '27 destinations' },
  { name: 'Adventure', emoji: '🏕️', color: '#10b981', bg: 'adventure', count: '15 destinations' },
  { name: 'Wildlife', emoji: '🐯', color: '#a855f7', bg: 'wildlife', count: '12 destinations' },
];

const features = [
  { icon: <Compass />, label: 'Destination Explorer', desc: 'Discover 50+ Indian cities with AI-curated insights, tips, and hidden gems.', color: '#6366f1', link: '/explore' },
  { icon: <Sparkles />, label: 'AI Trip Planner', desc: 'Generate smart day-wise itineraries personalized to your travel style.', color: '#a855f7', link: '/planner' },
  { icon: <Calculator />, label: 'Smart Budget', desc: 'Track expenses, compare costs, and get AI budget optimization tips.', color: '#f43f5e', link: '/budget' },
  { icon: <Calendar />, label: 'Save Trips', desc: 'Create an account to save your favorite itineraries and manage journeys.', color: '#f59e0b', link: '/dashboard' },
  { icon: <Star />, label: 'Travel Stories', desc: 'Share your journeys, upload photos, and inspire fellow travelers.', color: '#10b981', link: '/explore' },
  { icon: <Award />, label: 'Rewards', desc: 'Earn badges, unlock achievements, and level up your travel persona.', color: '#06b6d4', link: '/gamification' },
];

const liveDeals = [
  { tag: 'Flight', route: 'Delhi -> Goa', fare: 'Rs 4,299', note: '24% drop today' },
  { tag: 'Train', route: 'Mumbai -> Udaipur', fare: 'Rs 1,180', note: 'Sleeper + meals' },
  { tag: 'Stay', route: 'Jaipur Heritage Inn', fare: 'Rs 2,950/night', note: 'Free breakfast' },
  { tag: 'Flight', route: 'Bengaluru -> Leh', fare: 'Rs 6,840', note: '2 seats left' },
  { tag: 'Tour', route: 'Varanasi Ghat Walk', fare: 'Rs 799', note: 'Top rated guide' },
  { tag: 'Stay', route: 'Kerala Houseboat', fare: 'Rs 5,400/night', note: 'Sunset package' },
];

function buildPreviewItinerary({ destination, days, budget, vibe }) {
  const safeDays = Math.max(1, Number(days) || 1);
  const safeBudget = Math.max(5000, Number(budget) || 18000);
  const perDay = Math.round(safeBudget / safeDays);
  const pace = safeDays <= 2 ? 'Fast-paced' : safeDays <= 5 ? 'Balanced' : 'Leisure';

  const vibeLibrary = {
    culture: ['Heritage walk', 'Street food lane', 'Fort or museum visit', 'Craft market stop', 'Sunset photo point'],
    adventure: ['Sunrise trail', 'Adventure activity', 'Scenic viewpoint', 'Nature drive', 'Evening camp vibe'],
    chill: ['Slow breakfast', 'Cafe hopping', 'Leisure landmark stop', 'Wellness break', 'Golden hour stroll'],
    spiritual: ['Temple or shrine visit', 'Local ritual experience', 'Ghat or prayer walk', 'Meditation break', 'Quiet evening reflection'],
  };

  const moments = vibeLibrary[vibe] || vibeLibrary.chill;
  const dayPlan = Array.from({ length: safeDays }).map((_, idx) => ({
    day: idx + 1,
    morning: moments[idx % moments.length],
    afternoon: moments[(idx + 1) % moments.length],
    evening: moments[(idx + 2) % moments.length],
  }));

  return {
    destination,
    safeDays,
    safeBudget,
    perDay,
    pace,
    dayPlan,
  };
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState(null);
  const [previewInput, setPreviewInput] = useState({ destination: 'Jaipur', days: 4, budget: 22000, vibe: 'culture' });
  const [previewPlan, setPreviewPlan] = useState(() => buildPreviewItinerary({ destination: 'Jaipur', days: 4, budget: 22000, vibe: 'culture' }));
  const heroParticles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, index) => ({
      id: index,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 3.2}s`,
      duration: `${Math.random() * 3.2 + 4.2}s`,
    }));
  }, []);

  function handlePreviewSubmit(event) {
    event.preventDefault();
    setPreviewPlan(buildPreviewItinerary(previewInput));
  }

  return (
    <div className="home-page">
      <section className="deals-section section-container">
        <div className="deals-top-row">
          <div className="deals-title-wrap">
            <span className="badge badge-cyan live-badge">Live Deals</span>
            <h3><TrendingUp size={18} /> Real-time travel drops and flash offers</h3>
          </div>
        </div>

        <div className="deals-marquee glass-card-sm" aria-label="Live travel deals ticker">
          <div className="deals-track">
            {[...liveDeals, ...liveDeals].map((deal, idx) => (
              <div key={`${deal.route}-${idx}`} className="deal-chip">
                <span className="deal-tag">{deal.tag}</span>
                <span className="deal-route">{deal.route}</span>
                <span className="deal-fare">{deal.fare}</span>
                <span className="deal-note">{deal.note}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HERO SECTION ── */}
      <section className="hero-section">
        <div className="hero-particles">
          {heroParticles.map((particle) => (
            <div key={particle.id} className="particle" style={{
              left: particle.left,
              top: particle.top,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }} />
          ))}
        </div>

        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="hero-badge">
            <Sparkles size={14} /> AI-Powered Travel Intelligence
          </div>
          <h1 className="hero-title">
            Plan Better Trips Across<br />
            <span className="heading-gradient text-glow">Incredible India</span>
          </h1>
          <p className="hero-subtitle">
            Build your route, budget, and day plan in one clean flow with AI suggestions
            and practical travel tools.
          </p>
          <div className="hero-actions">
            <Link to="/explore" className="button-primary hero-btn">
              <Compass size={18} /> Start Exploring
            </Link>
            <Link to="/planner" className="button-secondary hero-btn">
              <Sparkles size={18} /> Plan with AI
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── STATS ROW ── */}
      <section className="stats-section">
        <div className="stats-container glass-card">
          <StatItem end={50} label="Indian Destinations" suffix="+" />
          <div className="stat-divider" />
          <StatItem end={50000} label="Trips Planned" suffix="+" />
          <div className="stat-divider" />
          <StatItem end={4.9} label="Average Rating" suffix="★" />
          <div className="stat-divider" />
          <StatItem end={100} label="AI Itineraries Daily" suffix="+" />
        </div>
      </section>

      <section className="preview-section section-container">
        <motion.div
          className="preview-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <form className="preview-form glass-card" onSubmit={handlePreviewSubmit}>
            <div className="preview-head">
              <span className="badge">Quick Preview</span>
              <h3>Create a sample trip in seconds</h3>
              <p>Set destination, days, and budget to preview a practical day-wise plan instantly.</p>
            </div>

            <div className="form-group">
              <label>Destination</label>
              <input
                value={previewInput.destination}
                onChange={(e) => setPreviewInput((prev) => ({ ...prev, destination: e.target.value }))}
                placeholder="Example: Udaipur"
                required
              />
            </div>

            <div className="preview-inline-fields">
              <div className="form-group">
                <label>Days</label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={previewInput.days}
                  onChange={(e) => setPreviewInput((prev) => ({ ...prev, days: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>Budget (Rs)</label>
                <input
                  type="number"
                  min="5000"
                  step="500"
                  value={previewInput.budget}
                  onChange={(e) => setPreviewInput((prev) => ({ ...prev, budget: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Travel Vibe</label>
              <select
                value={previewInput.vibe}
                onChange={(e) => setPreviewInput((prev) => ({ ...prev, vibe: e.target.value }))}
              >
                <option value="culture">Culture</option>
                <option value="adventure">Adventure</option>
                <option value="chill">Chill</option>
                <option value="spiritual">Spiritual</option>
              </select>
            </div>

            <button className="button-primary w-full" type="submit">
              <Sparkles size={16} /> Generate Preview Plan
            </button>
          </form>

          <div className="preview-output glass-card">
            <div className="preview-output-head">
              <h3>{previewPlan.destination} Snapshot</h3>
              <span className="badge badge-secondary">{previewPlan.pace}</span>
            </div>

            <div className="preview-kpis">
              <div className="preview-kpi">
                <span>Total Budget</span>
                <strong>Rs {previewPlan.safeBudget.toLocaleString()}</strong>
              </div>
              <div className="preview-kpi">
                <span>Per Day</span>
                <strong>Rs {previewPlan.perDay.toLocaleString()}</strong>
              </div>
              <div className="preview-kpi">
                <span>Trip Length</span>
                <strong>{previewPlan.safeDays} days</strong>
              </div>
            </div>

            <div className="preview-days">
              {previewPlan.dayPlan.map((dayItem) => (
                <div key={dayItem.day} className="preview-day-row">
                  <div className="preview-day-title">Day {dayItem.day}</div>
                  <div className="preview-day-flow">
                    <span className="preview-stop">{dayItem.morning}</span>
                    <span className="preview-sep">•</span>
                    <span className="preview-stop">{dayItem.afternoon}</span>
                    <span className="preview-sep">•</span>
                    <span className="preview-stop">{dayItem.evening}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/planner" className="button-secondary w-full preview-open-btn">
              <Calendar size={16} /> Open Full AI Planner
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="features-section section-container">
        <div className="section-header">
          <h2 className="heading-gradient">Everything You Need</h2>
          <p>From planning to packing — your complete India travel intelligence platform.</p>
        </div>
        <div className="features-grid">
          {features.map((feat, idx) => (
            <motion.div
              key={idx}
              className="feature-card glass-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -8 }}
            >
              <div className="feature-icon-wrap" style={{ background: `${feat.color}15`, border: `1px solid ${feat.color}30` }}>
                <span style={{ color: feat.color }}>{feat.icon}</span>
              </div>
              <h3>{feat.label}</h3>
              <p>{feat.desc}</p>
              <Link to={feat.link} className="feature-link" style={{ color: feat.color }}>
                Explore <ArrowRight size={14} />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TRENDING DESTINATIONS ── */}
      <section className="trending-section section-container">
        <div className="section-header">
          <h2>🔥 <span className="heading-gradient">Trending Right Now</span></h2>
          <p>Curated destinations experiencing a surge in interest this season.</p>
        </div>
        <div className="trending-grid">
          {trendingDestinations.map((dest, idx) => (
            <motion.div
              key={idx}
              className="trend-card glass-card"
              initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="trend-rank" style={{ background: dest.color }}>#{dest.rank}</div>
              <div className="trend-emoji">{dest.icon}</div>
              <div className="trend-content">
                <div className="trend-badge-row">
                  <span className="badge" style={{ background: dest.color }}>{dest.category}</span>
                </div>
                <h4>{dest.name}</h4>
                <p>{dest.desc}</p>
                <div className="trend-stats">📈 {dest.stat}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FESTIVALS TIMELINE ── */}
      <section className="festivals-section section-container">
        <div className="section-header">
          <h2>📅 <span className="heading-gradient">Upcoming Indian Festivals</span></h2>
          <p>Time your trip with the most vibrant cultural celebrations.</p>
        </div>
        <div className="festivals-timeline">
          {festivals.map((fest, idx) => (
            <motion.div
              key={idx}
              className="festival-item glass-card"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <div className="fest-date-badge" style={{ background: `${fest.color}20`, borderColor: `${fest.color}50`, color: fest.color }}>{fest.date}</div>
              <div className="fest-emoji">{fest.emoji}</div>
              <div className="fest-details">
                <h4>{fest.name}</h4>
                <p className="fest-place"><MapPin size={12} /> {fest.place}</p>
                <p>{fest.desc}</p>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="categories-section section-container">
        <div className="section-header">
          <h2 className="heading-gradient">Travel Your Way</h2>
          <p>Choose your adventure style and we'll find the perfect destinations.</p>
        </div>
        <div className="categories-grid">
          {categories.map((cat, idx) => (
            <motion.div
              key={idx}
              className={`category-card glass-card cat-${cat.bg} ${activeCategory === idx ? 'active' : ''}`}
              onClick={() => setActiveCategory(activeCategory === idx ? null : idx)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="cat-emoji">{cat.emoji}</div>
              <h4>{cat.name}</h4>
              <p>{cat.count}</p>
              <div className="cat-hover-overlay" style={{ background: `${cat.color}20` }} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section className="cta-section">
        <motion.div
          className="cta-card glass-card"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="cta-content">
            <div className="cta-icon">🧠</div>
            <h2>Let AI Plan Your Perfect India Trip</h2>
            <p>Tell us your destination, budget, and days — our AI creates a personalized itinerary in seconds.</p>
            <div className="cta-actions">
              <Link to="/planner" className="button-primary">
                <Sparkles size={18} /> Start AI Planning
              </Link>
              <Link to="/explore" className="button-secondary">
                <Compass size={18} /> Browse Destinations
              </Link>
            </div>
          </div>
          <div className="cta-visual">
            <div className="cta-orbit">
              {['🏔️', '🏖️', '🛕', '🌿', '🐘', '🎨'].map((em, i) => (
                <div key={i} className="orbit-item" style={{ '--i': i }}>
                  <span>{em}</span>
                </div>
              ))}
              <div className="orbit-center">🇮🇳</div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
