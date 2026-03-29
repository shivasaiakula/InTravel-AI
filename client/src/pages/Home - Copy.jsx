import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimation, useInView } from 'framer-motion';
import { 
  Compass, Calendar, Calculator, Sparkles, TrendingUp, MapPin, 
  Star, Users, Heart, Zap, Shield, Award, ArrowRight, Play,
  Mountain, Sun, Cloud, Plane, Camera, Music, ChevronRight
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
  { icon: <Star />, label: 'Travel Stories', desc: 'Share your journeys, upload photos, and inspire fellow travelers.', color: '#10b981', link: '/stories' },
  { icon: <Award />, label: 'Rewards', desc: 'Earn badges, unlock achievements, and level up your travel persona.', color: '#06b6d4', link: '/gamification' },
];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState(null);
  const [weatherData] = useState({ temp: 28, condition: 'Sunny', city: 'Delhi' });

  return (
    <div className="home-page">
      {/* ── HERO SECTION ── */}
      <section className="hero-section">
        <div className="hero-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 5 + 3}s`,
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
            Discover the Magic of<br />
            <span className="heading-gradient text-glow">Incredible India</span>
          </h1>
          <p className="hero-subtitle">
            Plan your perfect getaway with AI-powered itineraries, real-time insights,
            smart budget tools, and hidden gems exploration.
          </p>
          <div className="hero-actions">
            <Link to="/explore" className="button-primary hero-btn">
              <Compass size={18} /> Start Exploring
            </Link>
            <Link to="/planner" className="button-secondary hero-btn">
              <Sparkles size={18} /> Plan with AI
            </Link>
          </div>
          <div className="hero-scroll-hint">
            <div className="scroll-indicator" />
            <span>Scroll to discover</span>
          </div>
        </motion.div>

        <div className="hero-float-cards">
          <motion.div className="float-card glass-card-sm" style={{ top: '15%', right: '8%' }}
            animate={{ y: [0, -12, 0] }} transition={{ duration: 3, repeat: Infinity }}>
            <Plane size={20} color="#6366f1" />
            <div><div className="fc-title">Flights Found</div><div className="fc-val">2,847</div></div>
          </motion.div>
          <motion.div className="float-card glass-card-sm" style={{ bottom: '30%', right: '5%' }}
            animate={{ y: [0, 10, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }}>
            <Star size={20} color="#f59e0b" />
            <div><div className="fc-title">Avg Rating</div><div className="fc-val">4.9 ⭐</div></div>
          </motion.div>
          <motion.div className="float-card glass-card-sm" style={{ top: '40%', left: '3%' }}
            animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}>
            <Users size={20} color="#10b981" />
            <div><div className="fc-title">Happy Travelers</div><div className="fc-val">50K+</div></div>
          </motion.div>
        </div>
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
