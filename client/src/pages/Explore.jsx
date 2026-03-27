import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, MapPin, Calendar, Lightbulb, Info, Star, Filter, Users, TrendingUp, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './Explore.css';

const CATEGORIES = ['All', 'Beach', 'Mountain', 'Heritage', 'Spiritual', 'Nature', 'Adventure'];

export default function Explore() {
  const [destinations, setDestinations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [weather, setWeather] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [crowd, setCrowd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [skeletons] = useState([1, 2, 3, 4, 5, 6]);

  useEffect(() => { fetchDestinations(); }, []);

  useEffect(() => {
    if (selected) {
      fetchWeather(selected.name);
      fetchHotels(selected.name);
      fetchCrowd(selected.name);
      fetchReviews(selected.name);
    }
  }, [selected]);

  const fetchDestinations = async () => {
    try {
      const { data } = await axios.get('/api/destinations');
      setDestinations(data);
    } catch (err) {
      console.error(err);
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeather = async (city) => {
    setWeather(null);
    try {
      const { data } = await axios.get(`/api/weather/${city}`);
      setWeather(data);
    } catch (err) {
      const temp = Math.floor(Math.random() * (35 - 18) + 18);
      setWeather({ temp, condition: 'Sunny', humidity: 60, wind: 12, uv: 6 });
    }
  };

  const fetchCrowd = async (city) => {
    setCrowd(null);
    try {
      const { data } = await axios.get(`/api/crowd/${city}`);
      setCrowd(data);
    } catch {
      setCrowd({ currentCrowd: 'Moderate', percentage: 55, bestTimeToVisit: '7:00 AM' });
    }
  };

  const fetchHotels = async (city) => {
    try {
      const { data } = await axios.get(`/api/hotels?city=${city}`);
      setHotels(data);
    } catch (err) { console.error(err); }
  };

  const fetchReviews = async (city) => {
    try {
      const { data } = await axios.get(`/api/reviews/${city}`);
      setReviews(data);
    } catch (err) { console.error(err); }
  };

  const filtered = destinations.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
                       d.category.toLowerCase().includes(search.toLowerCase()) ||
                       d.state.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || d.category === activeCategory;
    return matchSearch && matchCat;
  });

  const crowdColor = { Low: '#10b981', Moderate: '#f59e0b', High: '#f97316', 'Very High': '#f43f5e' };

  return (
    <div className="explore-page section-container">
      <div className="explore-header">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="heading-gradient">India Destination Explorer</h1>
          <p>Explore the diverse cultures, landscapes, and hidden gems of Incredible India.</p>
        </motion.div>
        <div className="search-bar">
          <Search size={20} color="var(--text-muted)" />
          <input type="text" placeholder="Search city, state, or category..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="category-filters">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Destination Grid */}
      <div className="destination-grid">
        {loading ? (
          skeletons.map(i => (
            <div key={i} className="skeleton skeleton-card" style={{ borderRadius: '20px' }} />
          ))
        ) : filtered.length > 0 ? (
          filtered.map((dest, idx) => (
            <motion.div
              layoutId={`dest-${dest.id}`}
              key={dest.id}
              className="dest-card glass-card"
              onClick={() => setSelected(dest)}
              whileHover={{ scale: 1.03, y: -5 }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <div className="dest-img-container">
                <img
                  src={dest.image_url || 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400'}
                  alt={dest.name}
                  loading="lazy"
                />
                <div className="dest-category">{dest.category}</div>
                <div className="dest-overlay" />
              </div>
              <div className="dest-info">
                <h3>{dest.name}</h3>
                <p><MapPin size={13} /> {dest.state}</p>
                <div className="dest-meta">
                  <span><Calendar size={12} /> {dest.best_time}</span>
                  <span className="dest-rating">⭐ 4.{Math.floor(Math.random() * 3) + 6}</span>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="no-results">
            <Search size={48} color="var(--text-muted)" />
            <h3>No destinations found</h3>
            <p>Try a different search or category.</p>
          </div>
        )}
      </div>

      {/* Destination Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSelected(null)}
          >
            <motion.div
              layoutId={`dest-${selected.id}`}
              className="modal-content glass-card"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <button className="close-btn" onClick={() => setSelected(null)}>×</button>

              {/* Modal Header Image */}
              <div className="modal-header">
                <img src={selected.image_url} alt={selected.name} />
                <div className="header-info">
                  <h2>{selected.name}</h2>
                  <p className="state-name"><MapPin size={16} /> {selected.state}</p>
                  <div className="header-meta">
                    <span className="badge">{selected.category}</span>
                    {weather && (
                      <div className="weather-badge">
                        {weather.temp}°C • {weather.condition} • 💧{weather.humidity}%
                      </div>
                    )}
                    {crowd && (
                      <div className="crowd-badge" style={{ background: `${crowdColor[crowd.currentCrowd]}20`, border: `1px solid ${crowdColor[crowd.currentCrowd]}50`, color: crowdColor[crowd.currentCrowd] }}>
                        <Users size={12} /> {crowd.currentCrowd} Crowd
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="modal-body">
                {/* Description + Map */}
                <div className="info-section">
                  <div className="section-title-row">
                    <h4><Info size={18} /> About {selected.name}</h4>
                  </div>
                  <p>{selected.description}</p>
                  <div className="map-embed" style={{ marginTop: '1.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <iframe
                      title="Google Maps Location"
                      width="100%"
                      height="250"
                      style={{ border: 0, filter: 'grayscale(100%) invert(90%) contrast(80%)' }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps?q=${encodeURIComponent(selected.name + ' ' + selected.state)}&output=embed`}
                    ></iframe>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="info-grid">
                  <div className="info-item">
                    <h4><Star size={16} /> Top Attractions</h4>
                    <p>{selected.attractions}</p>
                  </div>
                  <div className="info-item">
                    <h4><Calendar size={16} /> Best Time to Visit</h4>
                    <p>{selected.best_time}</p>
                  </div>
                  <div className="info-item">
                    <h4><Lightbulb size={16} /> Travel Tips</h4>
                    <p>{selected.travel_tips || 'Book in advance during peak season. Carry cash for local markets.'}</p>
                  </div>
                  <div className="info-item">
                    <h4><MapPin size={16} /> Nearby Places</h4>
                    <p>{selected.nearby_places || 'Ask locals for their favorite hidden spots!'}</p>
                  </div>
                </div>

                {/* Crowd Info */}
                {crowd && (
                  <div className="crowd-section info-section">
                    <h4><TrendingUp size={18} /> Live Crowd & Trend</h4>
                    <div className="crowd-grid">
                      <div className="crowd-card glass-card-sm">
                        <div className="crowd-label">Current Crowd</div>
                        <div className="crowd-val" style={{ color: crowdColor[crowd.currentCrowd] }}>{crowd.currentCrowd}</div>
                        <div className="progress-bar-container">
                          <div className="progress-bar-fill" style={{ width: `${crowd.percentage}%`, background: crowdColor[crowd.currentCrowd] }} />
                        </div>
                        <div className="crowd-pct">{crowd.percentage}% capacity</div>
                      </div>
                      <div className="crowd-card glass-card-sm">
                        <div className="crowd-label">Best Time</div>
                        <div className="crowd-val" style={{ color: '#10b981' }}>{crowd.bestTimeToVisit}</div>
                        <div className="crowd-tip">Visit early morning for the best experience!</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Local Cuisine & Hidden Gems */}
                <div className="info-section cuisine-section">
                  <h4>🍲 Local Cuisine & Hidden Gems</h4>
                  <div className="cuisine-grid">
                    <div className="cuisine-card glass-card">
                      <h5>Must Eat</h5>
                      <p>Regional delicacies, legendary street food, and authentic flavors that define {selected.name}. Look for local dhabas and market stalls.</p>
                    </div>
                    <div className="cuisine-card glass-card">
                      <h5>Hidden Gem</h5>
                      <p>Offbeat spots, secret cafes, and quiet viewpoints known only to the locals of {selected.state}. Ask your autorickshaw driver!</p>
                    </div>
                  </div>
                </div>

                {/* Hotels */}
                <div className="info-section hotel-section">
                  <h4>🏨 Where to Stay in {selected.name}</h4>
                  <div className="hotel-list">
                    {hotels.length > 0 ? (
                      hotels.map((h, i) => (
                        <div key={i} className="hotel-card glass-card">
                          <img src={h.image_url} alt={h.name} onError={e => { e.target.src = 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=200'; }} />
                          <div className="hotel-info">
                            <h5>{h.name}</h5>
                            <p>⭐ {h.rating} • <strong>₹{h.price_per_night?.toLocaleString('en-IN')}/night</strong></p>
                            <p className="amenities">{h.amenities}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--text-muted)' }}>Loading hotels for {selected.name}...</p>
                    )}
                  </div>
                </div>

                {/* Community Reviews */}
                <div className="info-section review-section" style={{ marginTop: '2rem' }}>
                  <h4>💬 Traveler Reviews</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    {reviews.length > 0 ? reviews.map((r, i) => (
                      <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 600 }}>{r.user_name}</span>
                          <span style={{ color: 'var(--accent-amber)', fontSize: '0.85rem' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{r.comment}</p>
                      </div>
                    )) : <p style={{ color: 'var(--text-muted)' }}>No reviews yet. Be the first to visit!</p>}
                  </div>
                </div>

                {/* CTA */}
                <div className="modal-cta">
                  <a href={`/planner?destination=${encodeURIComponent(selected.name)}`} className="button-primary">
                    ✨ Plan a Trip to {selected.name}
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
