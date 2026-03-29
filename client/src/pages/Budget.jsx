import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import {
  Wallet, TrendingDown, Hotel, Plane, Coffee, Zap, PlusCircle,
  Trash2, Calculator, Target, ArrowRight, ChevronUp, ChevronDown,
  PieChart, BarChart3
} from 'lucide-react';
import './Budget.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const CHART_COLORS = {
  primary: 'rgba(99, 102, 241, 0.8)',
  secondary: 'rgba(168, 85, 247, 0.8)',
  accent: 'rgba(244, 63, 94, 0.8)',
  green: 'rgba(16, 185, 129, 0.8)',
  amber: 'rgba(245, 158, 11, 0.8)',
  cyan: 'rgba(6, 182, 212, 0.8)',
};

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Flights', icon: '✈️', budget: 15000, actual: 12500, color: CHART_COLORS.primary },
  { id: 2, name: 'Accommodation', icon: '🏨', budget: 12000, actual: 11000, color: CHART_COLORS.secondary },
  { id: 3, name: 'Food & Dining', icon: '🍽️', budget: 8000, actual: 9200, color: CHART_COLORS.accent },
  { id: 4, name: 'Local Transport', icon: '🚌', budget: 4000, actual: 3500, color: CHART_COLORS.green },
  { id: 5, name: 'Activities', icon: '🎡', budget: 5000, actual: 4800, color: CHART_COLORS.amber },
  { id: 6, name: 'Shopping', icon: '🛍️', budget: 3000, actual: 4200, color: CHART_COLORS.cyan },
  { id: 7, name: 'Miscellaneous', icon: '📦', budget: 2000, actual: 1800, color: 'rgba(148,163,184,0.8)' },
];

const HOTEL_ALTERNATIVES = [
  { type: 'Luxury Hotel', price: 8000, rating: 5, amenities: ['Pool', 'Spa', 'Room Service'], recommended: false },
  { type: 'Boutique Hotel', price: 4500, rating: 4, amenities: ['AC', 'Wifi', 'Breakfast'], recommended: true },
  { type: 'Hostel (Private)', price: 1800, rating: 3.5, amenities: ['Wifi', 'Common Kitchen'], recommended: false },
  { type: 'Airbnb', price: 2500, rating: 4.2, amenities: ['Kitchen', 'Private Space', 'Local Feel'], recommended: false },
];

export default function BudgetPage() {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [totalBudget, setTotalBudget] = useState(50000);
  const [destination, setDestination] = useState('Goa');
  const [days, setDays] = useState(5);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [activeView, setActiveView] = useState('doughnut');
  const [newCat, setNewCat] = useState({ name: '', icon: '💰', budget: 0 });
  const [showAddForm, setShowAddForm] = useState(false);

  const totalPlanned = categories.reduce((s, c) => s + c.budget, 0);
  const totalActual = categories.reduce((s, c) => s + c.actual, 0);
  const savings = totalBudget - totalActual;
  const overBudgetCats = categories.filter(c => c.actual > c.budget);
  const budgetPerDay = Math.max(1, Math.floor(totalBudget / Math.max(1, days)));
  const riskLevel = budgetPerDay < 3500 ? 'High' : budgetPerDay < 7000 ? 'Medium' : 'Low';
  const riskScore = riskLevel === 'High' ? 84 : riskLevel === 'Medium' ? 54 : 24;
  const riskColor = riskLevel === 'High' ? '#f43f5e' : riskLevel === 'Medium' ? '#f59e0b' : '#10b981';

  const donutData = {
    labels: categories.map(c => c.name),
    datasets: [{
      data: categories.map(c => c.budget),
      backgroundColor: categories.map(c => c.color),
      borderColor: 'rgba(0,0,0,0)',
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  const barData = {
    labels: categories.map(c => c.name),
    datasets: [
      { label: 'Planned Budget', data: categories.map(c => c.budget), backgroundColor: CHART_COLORS.primary, borderRadius: 6 },
      { label: 'Actual Spend', data: categories.map(c => c.actual), backgroundColor: CHART_COLORS.accent, borderRadius: 6 },
    ],
  };

  const dailySpendData = {
    labels: Array.from({ length: days }, (_, i) => `Day ${i + 1}`),
    datasets: [{
      label: 'Daily Spend',
      data: Array.from({ length: days }, () => Math.floor(totalActual / days * (0.8 + Math.random() * 0.4))),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#6366f1',
      pointRadius: 5,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } } },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { family: 'Outfit' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#94a3b8', font: { family: 'Outfit' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  };

  const addCategory = () => {
    if (!newCat.name) return;
    setCategories(prev => [...prev, { ...newCat, id: Date.now(), actual: 0, color: CHART_COLORS.primary }]);
    setNewCat({ name: '', icon: '💰', budget: 0 });
    setShowAddForm(false);
  };

  const removeCategory = (id) => setCategories(prev => prev.filter(c => c.id !== id));

  const updateBudget = (id, field, value) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: Number(value) } : c));
  };

  return (
    <div className="budget-page section-container">
      <div className="section-header">
        <h1 className="heading-gradient"><Wallet size={32} /> Smart Budget Optimizer</h1>
        <p>Track expenses, compare costs, and get AI-powered tips to save more on your trip.</p>
      </div>

      {/* Config Bar */}
      <motion.div className="budget-config glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="config-item">
          <label>Destination</label>
          <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Goa" />
        </div>
        <div className="config-item">
          <label>Trip Days</label>
          <input type="number" value={days} min="1" max="30" onChange={e => setDays(Number(e.target.value))} />
        </div>
        <div className="config-item">
          <label>Total Budget (₹)</label>
          <input type="number" value={totalBudget} step="1000" onChange={e => setTotalBudget(Number(e.target.value))} />
        </div>
        <div className="config-summary">
          <div className="cfg-stat">
            <span>Daily Budget</span>
            <strong>₹{Math.floor(totalBudget / days).toLocaleString('en-IN')}</strong>
          </div>
          <div className="cfg-stat">
            <span>Remaining</span>
            <strong className={savings >= 0 ? 'text-green' : 'text-red'}>
              {savings >= 0 ? '+' : ''}₹{savings.toLocaleString('en-IN')}
            </strong>
          </div>
          <div className="cfg-stat">
            <span>Risk</span>
            <strong style={{ color: riskColor }}>{riskLevel}</strong>
          </div>
        </div>
      </motion.div>

      <motion.div className="budget-risk-bar glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="budget-risk-head">
          <strong>Budget Risk Meter</strong>
          <span style={{ color: riskColor }}>{riskLevel} ({riskScore}%)</span>
        </div>
        <div className="budget-risk-track">
          <div className="budget-risk-fill" style={{ width: `${riskScore}%`, background: riskColor }} />
        </div>
        <p>
          Daily availability is ₹{budgetPerDay.toLocaleString('en-IN')}. Keep accommodation and transport within 55% total for safer spend control.
        </p>
      </motion.div>

      {/* Summary Cards */}
      <div className="budget-summary-row">
        {[
          { label: 'Total Budget', value: `₹${totalBudget.toLocaleString('en-IN')}`, icon: <Target size={22} />, color: '#6366f1' },
          { label: 'Total Planned', value: `₹${totalPlanned.toLocaleString('en-IN')}`, icon: <Calculator size={22} />, color: '#a855f7' },
          { label: 'Total Spent', value: `₹${totalActual.toLocaleString('en-IN')}`, icon: <Wallet size={22} />, color: totalActual > totalBudget ? '#f43f5e' : '#10b981' },
          { label: 'Saved', value: `₹${Math.abs(savings).toLocaleString('en-IN')}`, icon: <TrendingDown size={22} />, color: savings >= 0 ? '#10b981' : '#f43f5e', tag: savings >= 0 ? '✓ Under Budget' : '⚠ Over Budget' },
        ].map((card, i) => (
          <motion.div key={i} className="budget-summary-card glass-card"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <div className="bsc-icon" style={{ background: `${card.color}20`, color: card.color }}>{card.icon}</div>
            <div>
              <div className="bsc-val">{card.value}</div>
              <div className="bsc-label">{card.label}</div>
              {card.tag && <span className="bsc-tag" style={{ color: card.color }}>{card.tag}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="budget-main-grid">
        {/* Chart Panel */}
        <div className="chart-panel glass-card">
          <div className="chart-tabs">
            <button className={`chart-tab ${activeView === 'doughnut' ? 'active' : ''}`} onClick={() => setActiveView('doughnut')}>
              <PieChart size={16} /> Breakdown
            </button>
            <button className={`chart-tab ${activeView === 'bar' ? 'active' : ''}`} onClick={() => setActiveView('bar')}>
              <BarChart3 size={16} /> Comparison
            </button>
            <button className={`chart-tab ${activeView === 'line' ? 'active' : ''}`} onClick={() => setActiveView('line')}>
              📈 Daily Trend
            </button>
          </div>
          <div className="chart-area">
            {activeView === 'doughnut' && <Doughnut data={donutData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins.legend, position: 'right' } } }} />}
            {activeView === 'bar' && <Bar data={barData} options={chartOptions} />}
            {activeView === 'line' && <Line data={dailySpendData} options={chartOptions} />}
          </div>
        </div>

        {/* Categories List */}
        <div className="categories-panel glass-card">
          <div className="panel-header">
            <h3>Budget Categories</h3>
            <button className="button-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
              <PlusCircle size={14} /> Add
            </button>
          </div>

          {showAddForm && (
            <motion.div className="add-cat-form glass-card-sm" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <input placeholder="Category name" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '0.4rem 0.8rem', color: 'white', width: '100%', marginBottom: '0.5rem' }} />
              <input type="number" placeholder="Budget amount" value={newCat.budget || ''} onChange={e => setNewCat({ ...newCat, budget: Number(e.target.value) })} style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '0.4rem 0.8rem', color: 'white', width: '100%', marginBottom: '0.75rem' }} />
              <button className="button-primary btn-sm w-full" onClick={addCategory}>Add Category</button>
            </motion.div>
          )}

          <div className="categories-list">
            {categories.map((cat, idx) => {
              const pct = Math.min((cat.actual / cat.budget) * 100, 100);
              const isOver = cat.actual > cat.budget;
              return (
                <div key={cat.id} className="cat-row">
                  <div className="cat-row-top">
                    <span className="cat-icon-sm">{cat.icon}</span>
                    <span className="cat-name">{cat.name}</span>
                    <div className="cat-amounts">
                      <input type="number" value={cat.actual} onChange={e => updateBudget(cat.id, 'actual', e.target.value)} className="spend-input" />
                      <span className="cat-budget-lbl">/ ₹{cat.budget.toLocaleString()}</span>
                    </div>
                    <button className="btn-icon" onClick={() => removeCategory(cat.id)}><Trash2 size={14} /></button>
                  </div>
                  <div className="progress-bar-container">
                    <motion.div
                      className="progress-bar-fill"
                      style={{ background: isOver ? '#f43f5e' : cat.color, width: `${pct}%` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                    />
                  </div>
                  {isOver && (
                    <span className="over-tag">⚠ Over by ₹{(cat.actual - cat.budget).toLocaleString()}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hotel Alternatives */}
      <motion.div className="alternatives-section glass-card" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}>
        <div className="panel-header" onClick={() => setShowAlternatives(!showAlternatives)} style={{ cursor: 'pointer' }}>
          <h3><Hotel size={20} /> Accommodation Alternatives</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="badge badge-green">Save up to 78%</span>
            {showAlternatives ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
        {showAlternatives && (
          <motion.div className="alternatives-grid" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            {HOTEL_ALTERNATIVES.map((h, i) => (
              <div key={i} className={`alt-card glass-card ${h.recommended ? 'recommended' : ''}`}>
                {h.recommended && <span className="rec-badge">⭐ Recommended</span>}
                <h4>{h.type}</h4>
                <div className="alt-price">₹{h.price.toLocaleString()}<span>/night</span></div>
                <div className="alt-rating">{'⭐'.repeat(Math.floor(h.rating))} {h.rating}</div>
                <div className="alt-amenities">
                  {h.amenities.map(a => <span key={a} className="chip">{a}</span>)}
                </div>
                <div className="alt-saving">
                  Save ₹{(8000 - h.price).toLocaleString()}/night vs luxury
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* AI Budget Tips */}
      {overBudgetCats.length > 0 && (
        <div className="budget-alerts glass-card">
          <h3><Zap size={18} /> AI Budget Alerts</h3>
          {overBudgetCats.map(cat => (
            <div key={cat.id} className="alert-item">
              <span>{cat.icon}</span>
              <div>
                <strong>{cat.name}</strong> is over budget by ₹{(cat.actual - cat.budget).toLocaleString()}.
                <span className="alert-tip"> Consider reducing spend or adjusting budget allocation.</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
