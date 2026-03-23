import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import {
  Plane, Calendar, Wallet, List, MapPin, Trash2, PieChart,
  TrendingUp, Award, Target, Clock, Zap, RefreshCw, User, Globe
} from 'lucide-react';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } } } },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { family: 'Outfit' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    y: { ticks: { color: '#94a3b8', font: { family: 'Outfit' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
  },
};

export default function Dashboard() {
  const [trips, setTrips] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (user) fetchTrips();
    else setLoading(false);
  }, []);

  const fetchTrips = async () => {
    try {
      const { data } = await axios.get(`/api/trips/${user.id}`);
      setTrips(data);
    } catch (err) {
      // Mock data for demo
      setTrips([
        { id: 1, destination_name: 'Goa', budget_estimate: 25000, created_at: '2026-01-15', days: 5 },
        { id: 2, destination_name: 'Manali', budget_estimate: 35000, created_at: '2026-02-20', days: 7 },
        { id: 3, destination_name: 'Jaipur', budget_estimate: 18000, created_at: '2026-03-01', days: 4 },
      ]);
    }
    setLoading(false);
  };

  const totalBudget = trips.reduce((acc, t) => acc + parseFloat(t.budget_estimate || 0), 0);
  const avgBudget = trips.length > 0 ? totalBudget / trips.length : 0;
  const totalDays = trips.reduce((acc, t) => acc + parseFloat(t.days || 3), 0);

  const barData = {
    labels: trips.map(t => t.destination_name),
    datasets: [{
      label: 'Budget (₹)',
      data: trips.map(t => t.budget_estimate),
      backgroundColor: ['rgba(99,102,241,0.7)', 'rgba(168,85,247,0.7)', 'rgba(244,63,94,0.7)', 'rgba(16,185,129,0.7)'],
      borderRadius: 8,
    }],
  };

  const donutData = {
    labels: trips.map(t => t.destination_name),
    datasets: [{
      data: trips.map(t => t.budget_estimate),
      backgroundColor: ['rgba(99,102,241,0.8)', 'rgba(168,85,247,0.8)', 'rgba(244,63,94,0.8)', 'rgba(16,185,129,0.8)'],
      borderColor: 'transparent',
    }],
  };

  const lineData = {
    labels: trips.map(t => new Date(t.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Budget Over Time (₹)',
      data: trips.map(t => t.budget_estimate),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#6366f1',
      pointRadius: 5,
    }],
  };

  if (!user) {
    return (
      <div className="dashboard-page section-container">
        <div className="login-prompt glass-card">
          <User size={60} color="var(--primary)" />
          <h2>Sign In to Access Your Dashboard</h2>
          <p>Create an account to save trips, track budgets, and see your travel analytics.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <a href="/login" className="button-primary">Login</a>
            <a href="/register" className="button-secondary">Register</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page section-container">
      {/* User Profile Header */}
      <motion.div className="dashboard-header glass-card" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="user-profile">
          <div className="avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <div className="user-info">
            <h2>Welcome back, {user?.username}! 👋</h2>
            <p>Member since {new Date().getFullYear()} • Level 5 Traveler</p>
            <div className="user-tags">
              <span className="badge">🧭 Explorer</span>
              <span className="badge badge-secondary">💰 Budget Master</span>
            </div>
          </div>
        </div>
        <div className="stats-row">
          {[
            { icon: <Plane size={22} />, val: trips.length, label: 'Trips Planned', color: '#6366f1' },
            { icon: <Wallet size={22} />, val: `₹${totalBudget.toLocaleString('en-IN')}`, label: 'Total Budget', color: '#a855f7' },
            { icon: <Clock size={22} />, val: `${totalDays}`, label: 'Days Explored', color: '#10b981' },
            { icon: <Award size={22} />, val: '2850 XP', label: 'Travel Points', color: '#f59e0b' },
          ].map((stat, i) => (
            <div key={i} className="stat-item" style={{ '--stat-color': stat.color }}>
              <div className="stat-icon" style={{ color: stat.color }}>{stat.icon}</div>
              <h3>{stat.val}</h3>
              <p>{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Dashboard Tabs */}
      <div className="dash-tabs">
        {['overview', 'trips', 'analytics'].map(tab => (
          <button key={tab} className={`dash-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'overview' && <TrendingUp size={16} />}
            {tab === 'trips' && <List size={16} />}
            {tab === 'analytics' && <PieChart size={16} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div className="dash-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="overview-grid">
            {/* Recent Trips */}
            <div className="recent-trips glass-card">
              <h3><List size={18} /> Recent Trips</h3>
              {trips.slice(0, 3).map((trip, idx) => (
                <div key={idx} className="trip-row">
                  <div className="trip-row-icon"><Globe size={18} /></div>
                  <div className="trip-row-info">
                    <span className="trip-dest">{trip.destination_name}</span>
                    <span className="trip-date"><Calendar size={12} /> {new Date(trip.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className="trip-budget">₹{parseFloat(trip.budget_estimate).toLocaleString('en-IN')}</span>
                </div>
              ))}
              {trips.length === 0 && <p className="no-data">No trips yet. <a href="/planner">Start planning!</a></p>}
            </div>

            {/* Budget Summary Chart */}
            <div className="budget-chart glass-card">
              <h3><PieChart size={18} /> Budget Distribution</h3>
              <div className="mini-chart">
                {trips.length > 0
                  ? <Doughnut data={donutData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins.legend, position: 'right' } } }} />
                  : <div className="no-data">Add trips to see budget distribution.</div>
                }
              </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats glass-card">
              <h3><Zap size={18} /> Quick Insights</h3>
              <div className="insights-list">
                <div className="insight-item">
                  <span>Average Trip Budget</span>
                  <strong>₹{avgBudget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div className="insight-item">
                  <span>Avg Trip Duration</span>
                  <strong>{trips.length > 0 ? (totalDays / trips.length).toFixed(1) : 0} Days</strong>
                </div>
                <div className="insight-item">
                  <span>Most Visited Region</span>
                  <strong>North India</strong>
                </div>
                <div className="insight-item">
                  <span>Top Category</span>
                  <strong>Mountain</strong>
                </div>
                <div className="insight-item">
                  <span>Travel Efficiency Score</span>
                  <strong className="heading-gradient">88/100</strong>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Trips Tab */}
      {activeTab === 'trips' && (
        <motion.div className="dash-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="trips-grid">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))
            ) : (
              trips.map((trip, idx) => (
                <motion.div key={idx} className="trip-card glass-card"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
                  <div className="trip-card-header">
                    <div className="trip-dest-badge">
                      <Globe size={18} />
                      <h4>{trip.destination_name}</h4>
                    </div>
                    <span className="trip-date-badge"><Calendar size={12} /> {new Date(trip.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="trip-card-body">
                    <div className="trip-stat"><Wallet size={14} /> <span>Budget: <strong>₹{parseFloat(trip.budget_estimate).toLocaleString('en-IN')}</strong></span></div>
                    <div className="trip-stat"><Clock size={14} /> <span>{trip.days || '3'} Days</span></div>
                  </div>
                  <div className="trip-actions">
                    <a href="/planner" className="button-primary btn-sm">📋 View Plan</a>
                    <button className="button-secondary btn-sm"><Trash2 size={14} /></button>
                  </div>
                </motion.div>
              ))
            )}
            {!loading && trips.length === 0 && (
              <div className="no-trips glass-card">
                <Plane size={48} color="var(--primary)" />
                <h3>No trips yet</h3>
                <p>You haven't saved any trips.</p>
                <a href="/planner" className="button-primary">Start Planning</a>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <motion.div className="dash-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="analytics-grid">
            <div className="chart-card glass-card">
              <h3>Budget by Destination</h3>
              <div className="chart-area-dash">
                {trips.length > 0 ? <Bar data={barData} options={chartOptions} /> : <div className="no-data">Add trips to see charts.</div>}
              </div>
            </div>
            <div className="chart-card glass-card">
              <h3>Budget Timeline</h3>
              <div className="chart-area-dash">
                {trips.length > 0 ? <Line data={lineData} options={chartOptions} /> : <div className="no-data">Add trips to see timeline.</div>}
              </div>
            </div>
          </div>

          {/* Efficiency Metrics */}
          <div className="efficiency-card glass-card">
            <h3><Target size={18} /> Travel Efficiency Metrics</h3>
            <div className="metrics-grid">
              {[
                { label: 'Planning Score', value: 88, color: '#6366f1' },
                { label: 'Budget Optimization', value: 74, color: '#10b981' },
                { label: 'Itinerary Density', value: 92, color: '#a855f7' },
                { label: 'Savings Rate', value: 65, color: '#f59e0b' },
              ].map((m, i) => (
                <div key={i} className="metric-item">
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-bar">
                    <div className="progress-bar-container">
                      <motion.div className="progress-bar-fill" style={{ background: m.color }}
                        initial={{ width: 0 }} animate={{ width: `${m.value}%` }} transition={{ delay: i * 0.15 }} />
                    </div>
                  </div>
                  <div className="metric-val" style={{ color: m.color }}>{m.value}%</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
