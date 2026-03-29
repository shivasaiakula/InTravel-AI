import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Sparkles, Calendar, MapPin, Calculator, Save, CheckCircle2,
  Heart, Users, User, Baby, Mountain, Sun, Briefcase, GripVertical,
  ChevronDown, ChevronUp, Wallet, Clock, Star, Zap, RefreshCw,
  Download, Share2, Target, TrendingDown
} from 'lucide-react';
import './Planner.css';

const TRIP_PURPOSES = [
  { id: 'honeymoon', label: 'Honeymoon', icon: <Heart size={22} />, color: '#f43f5e', desc: 'Romantic getaway for two' },
  { id: 'solo', label: 'Solo Trip', icon: <User size={22} />, color: '#6366f1', desc: 'Me-time and self-discovery' },
  { id: 'friends', label: 'Friends Trip', icon: <Users size={22} />, color: '#a855f7', desc: 'Epic adventures with buddies' },
  { id: 'family', label: 'Family Trip', icon: <Baby size={22} />, color: '#10b981', desc: 'Memories for the whole family' },
  { id: 'adventure', label: 'Adventure', icon: <Mountain size={22} />, color: '#f59e0b', desc: 'Thrill-seeking experiences' },
  { id: 'business', label: 'Business', icon: <Briefcase size={22} />, color: '#06b6d4', desc: 'Work + leisure combined' },
];

const BUDGET_TIERS = [
  { label: 'Budget', range: '₹5K–₹15K', icon: '💰', color: '#10b981' },
  { label: 'Moderate', range: '₹15K–₹40K', icon: '💳', color: '#6366f1' },
  { label: 'Premium', range: '₹40K–₹1L', icon: '💎', color: '#a855f7' },
  { label: 'Luxury', range: '₹1L+', icon: '👑', color: '#f59e0b' },
];

const TRAVEL_STYLES = ['Sightseeing', 'Food & Cuisine', 'Adventure Sports', 'Photography', 'Nightlife', 'Shopping', 'Nature & Wildlife', 'Spiritual'];

function DayCard({ day, idx, onToggle, isOpen }) {
  return (
    <motion.div layout className="day-card glass-card">
      <div className="day-header" onClick={() => onToggle(idx)}>
        <div className="day-left">
          <span className="day-number">Day {idx + 1}</span>
          <span className="day-title">{day.title || `Day ${idx + 1} Plan`}</span>
        </div>
        <div className="day-right">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="day-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <pre className="day-content">{day.content}</pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function parseItineraryDays(text) {
  if (!text || typeof text !== 'string') return [];
  const regex = /(^|\n)\s*Day\s*(\d+)\s*[-–—:]?\s*([^\n]*)/gim;
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.index + match[1].length;
    const nextStart = index < matches.length - 1 ? matches[index + 1].index : text.length;
    const block = text.slice(start, nextStart).trim();
    const lines = block.split('\n');
    const titleLine = lines[0] || `Day ${index + 1}`;
    const content = lines.slice(1).join('\n').trim();
    return {
      title: titleLine.trim(),
      content,
    };
  });
}

function composeItineraryText(days) {
  return days
    .map((day, idx) => `Day ${idx + 1} - ${day.title.replace(/^Day\s*\d+\s*[-–—:]?\s*/i, '')}\n${day.content}`.trim())
    .join('\n\n');
}

function buildUniqueDayBlock(dayNo, destination, perDay) {
  const activityPool = [
    {
      title: `Heritage Walk in ${destination}`,
      morning: 'Start with a landmark walk and local breakfast spot.',
      afternoon: 'Visit one museum or fort and a nearby artisan lane.',
      evening: 'Attend a cultural show or sunset promenade.',
    },
    {
      title: `${destination} Food Trail`,
      morning: 'Explore a local market and try regional snacks.',
      afternoon: 'Book a guided food tour with 3-4 signature dishes.',
      evening: 'Relax at a cafe district and sample dessert specials.',
    },
    {
      title: `${destination} Nature Circuit`,
      morning: 'Visit a park, lake, or scenic viewpoint early.',
      afternoon: 'Take a short activity session or nature trail.',
      evening: 'Plan a calm neighborhood walk and photo stop.',
    },
    {
      title: `Hidden Gems of ${destination}`,
      morning: 'Cover less-crowded alleys and local architecture gems.',
      afternoon: 'Try a workshop or hands-on local craft experience.',
      evening: 'Explore a popular market street before dinner.',
    },
  ];

  const pick = activityPool[(dayNo - 1) % activityPool.length];
  return {
    title: `Day ${dayNo} - ${pick.title}`,
    content: [
      `Morning: ${pick.morning}`,
      `Afternoon: ${pick.afternoon}`,
      `Evening: ${pick.evening}`,
      `Estimated Cost: ₹${perDay.toLocaleString('en-IN')}`,
      `Pro Tip: Keep 30-45 mins buffer for local discoveries on Day ${dayNo}.`,
    ].join('\n'),
  };
}

function normalizeItineraryDays(rawText, formData) {
  const requestedDays = Math.min(30, Math.max(1, Number(formData.days) || 1));
  const parsed = parseItineraryDays(rawText);
  const normalized = [...parsed].slice(0, requestedDays);
  const perDay = Math.max(500, Math.floor((Number(formData.budget) || 0) / requestedDays));

  const seenBlocks = new Set();
  for (let i = 0; i < normalized.length; i += 1) {
    const fingerprint = (normalized[i].content || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!fingerprint) {
      normalized[i] = buildUniqueDayBlock(i + 1, formData.destination || 'your destination', perDay);
      continue;
    }

    if (seenBlocks.has(fingerprint)) {
      normalized[i] = buildUniqueDayBlock(i + 1, formData.destination || 'your destination', perDay);
    } else {
      seenBlocks.add(fingerprint);
    }
  }

  while (normalized.length < requestedDays) {
    const dayNo = normalized.length + 1;
    normalized.push(buildUniqueDayBlock(dayNo, formData.destination || 'your destination', perDay));
  }

  const itinerary = composeItineraryText(normalized);
  return {
    requestedDays,
    generatedDays: normalized.length,
    isComplete: normalized.length === requestedDays,
    days: normalized,
    itinerary,
  };
}

function getBudgetRiskLevel(budget, days, travelers) {
  const safeDays = Math.max(1, Number(days) || 1);
  const safeTravelers = Math.max(1, Number(travelers) || 1);
  const budgetPerPersonPerDay = Math.floor((Number(budget) || 0) / (safeDays * safeTravelers));

  if (budgetPerPersonPerDay < 1200) {
    return { level: 'High', score: 85, color: '#f43f5e', note: 'Very tight for transport + stay + activities.' };
  }
  if (budgetPerPersonPerDay < 2500) {
    return { level: 'Medium', score: 55, color: '#f59e0b', note: 'Doable with selective experiences and cost control.' };
  }
  return { level: 'Low', score: 22, color: '#10b981', note: 'Comfortable range with room for premium activities.' };
}

export default function Planner() {
  const [step, setStep] = useState(1); // 1=purpose, 2=details, 3=result
  const [formData, setFormData] = useState({
    destination: '',
    days: 3,
    budget: 20000,
    purpose: '',
    budgetTier: '',
    styles: [],
    travelers: 2,
  });
  const [itinerary, setItinerary] = useState(null);
  const [parsedDays, setParsedDays] = useState([]);
  const [planCoverage, setPlanCoverage] = useState({ requestedDays: 0, generatedDays: 0, isComplete: false });
  const [itineraryVersions, setItineraryVersions] = useState([]);
  const [compareVersionId, setCompareVersionId] = useState('');
  const [openDays, setOpenDays] = useState([0]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [score, setScore] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));

  const plannerRisk = useMemo(
    () => getBudgetRiskLevel(formData.budget, formData.days, formData.travelers),
    [formData.budget, formData.days, formData.travelers],
  );

  const activeComparison = useMemo(() => {
    if (!compareVersionId || itineraryVersions.length < 1) return null;
    const compareWith = itineraryVersions.find((item) => String(item.id) === String(compareVersionId));
    const latest = itineraryVersions[0];
    if (!compareWith || !latest) return null;
    return {
      latest,
      compareWith,
      dayDelta: latest.formSnapshot.days - compareWith.formSnapshot.days,
      budgetDelta: latest.formSnapshot.budget - compareWith.formSnapshot.budget,
      destinationChanged: latest.formSnapshot.destination !== compareWith.formSnapshot.destination,
    };
  }, [compareVersionId, itineraryVersions]);

  function applyGeneratedPlan(rawItinerary, sourceLabel) {
    const normalized = normalizeItineraryDays(rawItinerary, formData);
    setItinerary(normalized.itinerary);
    setParsedDays(normalized.days);
    setPlanCoverage({
      requestedDays: normalized.requestedDays,
      generatedDays: normalized.generatedDays,
      isComplete: normalized.isComplete,
    });
    setOpenDays([0]);

    const version = {
      id: Date.now(),
      createdAt: new Date().toLocaleString(),
      source: sourceLabel,
      itinerary: normalized.itinerary,
      days: normalized.days,
      formSnapshot: { ...formData },
    };

    setItineraryVersions((prev) => [version, ...prev].slice(0, 8));
  }

  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (isPremium && !showCheckout) {
      setShowCheckout(true);
      return;
    }
    setLoading(true);
    setSaved(false);
    try {
      const { data } = await axios.post('/api/ai/plan', formData);
      applyGeneratedPlan(data.itinerary || '', data.cached ? 'cached' : 'ai');

      // Simulate trip score
      setScore({
        overall: Math.floor(Math.random() * 15) + 80,
        value: Math.floor(Math.random() * 20) + 75,
        experience: Math.floor(Math.random() * 10) + 85,
        efficiency: Math.floor(Math.random() * 20) + 80,
      });

      setStep(3);
    } catch (err) {
      console.error(err);
      // Fallback plan still respects exact day count.
      applyGeneratedPlan('', 'fallback');
      setScore({ overall: 88, value: 85, experience: 90, efficiency: 87 });
      setStep(3);
    }
    setLoading(false);
  };

  const handlePayment = async () => {
    setProcessingPayment(true);
    try {
      await axios.post('/api/checkout', { amount: 499, purpose: `Premium Itinerary: ${formData.destination}` });
      setShowCheckout(false);
      handleGenerate(); // Call generation directly after payment mock success
    } catch {
      setShowCheckout(false);
      handleGenerate();
    } finally {
      setProcessingPayment(false);
    }
  };

  function loadVersion(id) {
    const version = itineraryVersions.find((item) => String(item.id) === String(id));
    if (!version) return;
    setFormData(version.formSnapshot);
    setItinerary(version.itinerary);
    setParsedDays(version.days);
    setPlanCoverage({ requestedDays: version.formSnapshot.days, generatedDays: version.days.length, isComplete: version.days.length === version.formSnapshot.days });
    setOpenDays([0]);
    setStep(3);
  }

  const toggleStyle = (style) => {
    setFormData(prev => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter(s => s !== style)
        : [...prev.styles, style],
    }));
  };

  const toggleDay = (idx) => {
    setOpenDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
  };

  const handleSave = async () => {
    if (!user) { alert("Please login to save your trips!"); return; }
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + formData.days);

    try {
      await axios.post('/api/trips', {
        userId: user.id,
        destination: formData.destination,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        budget: formData.budget,
        itinerary: { content: itinerary },
      });
      setSaved(true);
    } catch (err) { console.error(err); }
  };

  const handleDownload = () => {
    const blob = new Blob([itinerary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${formData.destination}-itinerary.txt`;
    a.click();
  };

  return (
    <div className="planner-page section-container">
      <div className="planner-header">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="heading-gradient"><Sparkles /> AI Intelligent Trip Planner</h1>
          <p>Tell us your dream — we'll build the perfect India trip for you.</p>
        </motion.div>

        {/* Step Indicator */}
        <div className="step-indicator">
          {['Purpose', 'Details', 'Itinerary'].map((s, i) => (
            <React.Fragment key={i}>
              <div className={`step-bubble ${step > i ? 'done' : ''} ${step === i + 1 ? 'active' : ''}`}
                onClick={() => step > i + 1 && setStep(i + 1)}>
                {step > i + 1 ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span className="step-label">{s}</span>
              {i < 2 && <div className={`step-line ${step > i + 1 ? 'done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Trip Purpose */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
            <div className="step-section">
              <h2>What kind of trip are you planning?</h2>
              <p className="step-sub">Choose your trip purpose — we'll personalize everything around it.</p>
              <div className="purpose-grid">
                {TRIP_PURPOSES.map(p => (
                  <motion.div
                    key={p.id}
                    className={`purpose-card glass-card ${formData.purpose === p.id ? 'selected' : ''}`}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setFormData(prev => ({ ...prev, purpose: p.id }))}
                    style={{ '--purpose-color': p.color }}
                  >
                    <div className="purpose-icon" style={{ background: `${p.color}15`, color: p.color }}>{p.icon}</div>
                    <h4>{p.label}</h4>
                    <p>{p.desc}</p>
                    {formData.purpose === p.id && (
                      <motion.div className="purpose-check" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <CheckCircle2 size={20} />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>

              <h3 className="mt-4">Your travel style</h3>
              <p className="step-sub">Select all that apply</p>
              <div className="chip-row">
                {TRAVEL_STYLES.map(style => (
                  <div
                    key={style}
                    className={`chip ${formData.styles.includes(style) ? 'active' : ''}`}
                    onClick={() => toggleStyle(style)}
                  >
                    {formData.styles.includes(style) && <CheckCircle2 size={12} />}
                    {style}
                  </div>
                ))}
              </div>

              <div className="step-nav">
                <button
                  className="button-primary"
                  disabled={!formData.purpose}
                  onClick={() => setStep(2)}
                >
                  Continue to Details <Sparkles size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Trip Details */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
            <div className="step-section planner-layout">
              <div className="planner-form glass-card">
                <h2>Trip Details</h2>
                <p className="step-sub">Let's customize your perfect itinerary</p>

                <div className="form-group">
                  <label><MapPin size={16} /> Destination</label>
                  <input type="text" placeholder="Where to go? (e.g. Manali, Goa, Rajasthan)" value={formData.destination}
                    onChange={e => setFormData({ ...formData, destination: e.target.value })} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label><Calendar size={16} /> Duration (Days)</label>
                    <input type="number" min="1" max="15" value={formData.days}
                      onChange={e => setFormData({ ...formData, days: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label><Users size={16} /> No. of Travelers</label>
                    <input type="number" min="1" max="20" value={formData.travelers}
                      onChange={e => setFormData({ ...formData, travelers: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="form-group">
                  <label><Calculator size={16} /> Total Budget (₹)</label>
                  <div className="budget-slider-wrap">
                    <input type="range" min="5000" max="500000" step="1000" value={formData.budget}
                      onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
                      className="budget-slider" />
                    <div className="budget-display">
                      <span className="budget-value">₹{formData.budget.toLocaleString('en-IN')}</span>
                      <span className="budget-per-person">₹{Math.floor(formData.budget / formData.travelers).toLocaleString('en-IN')} per person</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label><Wallet size={16} /> Budget Category</label>
                  <div className="budget-tier-row">
                    {BUDGET_TIERS.map(tier => (
                      <div
                        key={tier.label}
                        className={`budget-tier-card ${formData.budgetTier === tier.label ? 'selected' : ''}`}
                        style={{ '--color': tier.color }}
                        onClick={() => setFormData({ ...formData, budgetTier: tier.label })}
                      >
                        <span>{tier.icon}</span>
                        <span className="tier-label">{tier.label}</span>
                        <span className="tier-range">{tier.range}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
                  <input type="checkbox" id="premiumToggle" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                  <label htmlFor="premiumToggle" style={{ cursor: 'pointer', flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Enable Premium AI Generation (₹499)</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Unlock verified secret spots, priority routing, and hyper-detailed day plans.</div>
                  </label>
                </div>

                <div className="form-actions">
                  <button className="button-secondary" onClick={() => setStep(1)}>← Back</button>
                  <button
                    className="button-primary"
                    onClick={handleGenerate}
                    disabled={loading || !formData.destination}
                  >
                    {loading ? (
                      <><RefreshCw size={16} className="spin-icon" /> Generating...</>
                    ) : (
                      <><Sparkles size={16} /> Create Itinerary</>
                    )}
                  </button>
                </div>
              </div>

              {/* Budget Preview */}
              <div className="budget-preview glass-card">
                <h3><TrendingDown size={20} /> Budget Preview</h3>
                <div className="risk-meter-box" style={{ '--risk-color': plannerRisk.color }}>
                  <div className="risk-meter-top">
                    <strong>Risk: {plannerRisk.level}</strong>
                    <span>{plannerRisk.score}%</span>
                  </div>
                  <div className="risk-track">
                    <div className="risk-fill" style={{ width: `${plannerRisk.score}%` }} />
                  </div>
                  <p>{plannerRisk.note}</p>
                </div>
                <div className="budget-breakdown">
                  {[
                    { label: 'Accommodation', pct: 35, icon: '🏨', color: '#6366f1' },
                    { label: 'Food & Dining', pct: 25, icon: '🍽️', color: '#10b981' },
                    { label: 'Transport', pct: 20, icon: '🚌', color: '#f59e0b' },
                    { label: 'Activities', pct: 15, icon: '🎡', color: '#a855f7' },
                    { label: 'Miscellaneous', pct: 5, icon: '🛍️', color: '#06b6d4' },
                  ].map((item, i) => (
                    <div key={i} className="breakdown-item">
                      <div className="breakdown-label">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      <div className="breakdown-right">
                        <div className="progress-bar-container" style={{ width: '120px' }}>
                          <motion.div
                            className="progress-bar-fill"
                            style={{ background: item.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.pct}%` }}
                            transition={{ delay: i * 0.1 }}
                          />
                        </div>
                        <span className="breakdown-amount">₹{Math.floor(formData.budget * item.pct / 100).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="budget-total-row">
                  <span>Total Estimate</span>
                  <span className="heading-gradient">₹{formData.budget.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Itinerary Result */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <div className="result-layout">
              {/* Trip Score */}
              {score && (
                <motion.div className="trip-score glass-card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <h3><Target size={20} /> Smart Trip Score</h3>
                  <div className="score-main">
                    <div className="score-circle">
                      <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="url(#scoreGrad)" strokeWidth="8"
                          strokeDasharray={`${score.overall * 2.51} 251`} strokeLinecap="round"
                          transform="rotate(-90 50 50)" />
                        <defs>
                          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="score-val">{score.overall}</div>
                    </div>
                    <div className="score-breakdown">
                      {[
                        { label: 'Value for Money', val: score.value, color: '#10b981' },
                        { label: 'Experience', val: score.experience, color: '#6366f1' },
                        { label: 'Efficiency', val: score.efficiency, color: '#f59e0b' },
                      ].map((s, i) => (
                        <div key={i} className="score-row">
                          <span>{s.label}</span>
                          <div className="score-bar">
                            <motion.div className="score-bar-fill" style={{ background: s.color }}
                              initial={{ width: 0 }} animate={{ width: `${s.val}%` }} transition={{ delay: i * 0.2 }} />
                          </div>
                          <span className="score-num">{s.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="score-meta">
                    <span>📍 {formData.destination}</span>
                    <span>🗓️ {formData.days} Days</span>
                    <span>💰 ₹{formData.budget.toLocaleString('en-IN')}</span>
                    <span>👤 {formData.purpose}</span>
                  </div>
                </motion.div>
              )}

              {/* Itinerary Cards */}
              <div className="itinerary-result glass-card">
                <div className="result-header">
                  <h3>Day-wise Itinerary — {formData.destination}</h3>
                  <div className="result-actions">
                    {planCoverage.requestedDays > 0 && (
                      <span className={`saved-badge ${planCoverage.isComplete ? '' : 'warn'}`}>
                        <CheckCircle2 size={16} />
                        {planCoverage.generatedDays}/{planCoverage.requestedDays} days
                      </span>
                    )}
                    {saved ? (
                      <span className="saved-badge"><CheckCircle2 size={16} /> Saved!</span>
                    ) : (
                      <button onClick={handleSave} className="button-primary btn-sm"><Save size={14} /> Save</button>
                    )}
                    <button onClick={handleDownload} className="button-secondary btn-sm"><Download size={14} /> Export</button>
                    <button onClick={() => setStep(2)} className="button-secondary btn-sm"><RefreshCw size={14} /> Redo</button>
                  </div>
                </div>

                {itineraryVersions.length > 0 && (
                  <div className="version-toolbar glass-card-sm">
                    <div>
                      <strong>Itinerary versions</strong>
                      <p>Load previous generations or compare with the latest plan.</p>
                    </div>
                    <div className="version-actions">
                      <select value={compareVersionId} onChange={(e) => setCompareVersionId(e.target.value)}>
                        <option value="">Compare latest with...</option>
                        {itineraryVersions.slice(1).map((version) => (
                          <option key={version.id} value={version.id}>
                            {version.formSnapshot.destination} | {version.formSnapshot.days}d | {version.createdAt}
                          </option>
                        ))}
                      </select>
                      <select onChange={(e) => e.target.value && loadVersion(e.target.value)} defaultValue="">
                        <option value="">Load version...</option>
                        {itineraryVersions.map((version) => (
                          <option key={version.id} value={version.id}>
                            {version.formSnapshot.destination} | {version.formSnapshot.days}d | {version.source}
                          </option>
                        ))}
                      </select>
                    </div>
                    {activeComparison && (
                      <div className="version-compare-note">
                        <span>Compared to selected plan:</span>
                        <span>{activeComparison.dayDelta >= 0 ? '+' : ''}{activeComparison.dayDelta} day(s)</span>
                        <span>{activeComparison.budgetDelta >= 0 ? '+' : ''}₹{Math.abs(activeComparison.budgetDelta).toLocaleString('en-IN')}</span>
                        {activeComparison.destinationChanged && <span>Destination changed</span>}
                      </div>
                    )}
                  </div>
                )}

                <div className="days-container">
                  {parsedDays.length > 0 ? (
                    parsedDays.map((day, idx) => (
                      <DayCard key={idx} day={day} idx={idx} onToggle={toggleDay} isOpen={openDays.includes(idx)} />
                    ))
                  ) : (
                    <div className="itinerary-text">
                      <pre>{itinerary}</pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost-Saving Tips */}
              <div className="saving-tips glass-card">
                <h3><Zap size={18} /> Smart Savings Tips</h3>
                <div className="tips-list">
                  {[
                    `Book ${formData.destination} flights 3 weeks in advance to save up to 40%`,
                    'Stay in guesthouses instead of hotels — same experience, 50% cheaper',
                    'Use local trains instead of cabs for inter-city travel',
                    'Eat at dhabas for authentic food at 1/3rd the restaurant price',
                    `Visit ${formData.destination} in shoulder season (Apr/Sep) for better deals`,
                  ].map((tip, i) => (
                    <div key={i} className="tip-item">
                      <span className="tip-icon">💡</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)' }}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', textAlign: 'center', background: 'var(--bg-2)' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Premium AI Access</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Generate a hyper-detailed, verified itinerary for {formData.destination}.</p>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem', color: 'var(--text)' }}>₹499</div>
            <button className="button-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handlePayment} disabled={processingPayment}>
              {processingPayment ? <><RefreshCw size={16} className="spin-icon" /> Processing...</> : 'Pay with API (Mock)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
