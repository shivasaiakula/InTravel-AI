import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Map, User, LogOut, BarChart3, Menu, X, Sparkles, TrendingUp, Package, Trophy } from 'lucide-react';
import './Navbar.css';

function Navbar() {
  const user = JSON.parse(localStorage.getItem('user'));
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { to: '/', icon: <Compass size={16} />, label: 'Home' },
    { to: '/explore', icon: <Map size={16} />, label: 'Explore' },
    { to: '/planner', icon: <Sparkles size={16} />, label: 'AI Planner' },
    { to: '/budget', icon: <BarChart3 size={16} />, label: 'Budget' },
    { to: '/packing', icon: <Package size={16} />, label: 'Packing' },
    { to: '/gamification', icon: <Trophy size={16} />, label: 'Rewards' },
  ];

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <Link to="/" className="nav-logo">
        <span className="logo-icon">🇮🇳</span>
        <span className="heading-gradient">TravelIndia AI</span>
      </Link>

      <div className="nav-links desktop-nav">
        {navLinks.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
          >
            {link.icon} {link.label}
          </Link>
        ))}
        {user ? (
          <>
            <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
              <div className="nav-avatar">{user.username?.[0]?.toUpperCase()}</div>
              {user.username}
            </Link>
            <button onClick={handleLogout} className="nav-link logout-btn">
              <LogOut size={16} /> Logout
            </button>
          </>
        ) : (
          <Link to="/login" className="nav-cta">
            <User size={16} /> Sign In
          </Link>
        )}
      </div>

      {/* Mobile Hamburger */}
      <button className="hamburger" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="mobile-menu glass-card"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`mobile-link ${isActive(link.to) ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.icon} {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link to="/dashboard" className="mobile-link" onClick={() => setMobileOpen(false)}>
                  <User size={16} /> Dashboard
                </Link>
                <button onClick={handleLogout} className="mobile-link logout-btn">
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="mobile-link" onClick={() => setMobileOpen(false)}>
                <User size={16} /> Sign In
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default Navbar;
