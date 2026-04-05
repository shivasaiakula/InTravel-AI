import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Explore from './pages/Explore';
import Transport from './pages/Transport';
import Planner from './pages/Planner';
import Dashboard from './pages/Dashboard';
import Budget from './pages/Budget';
import Gamification from './pages/Gamification';
import Packing from './pages/Packing';
import Bookings from './pages/Bookings';
import Chatbot from './components/Chatbot';

const SIMPLE_THEME = 'minimal-light';

function App() {
  useEffect(() => {
    document.documentElement.setAttribute('data-season-theme', SIMPLE_THEME);
    localStorage.setItem('intravel-theme', SIMPLE_THEME);
  }, []);

  return (
    <div className="App">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/transport" element={<Transport />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/gamification" element={<Gamification />} />
        <Route path="/packing" element={<Packing />} />
        <Route path="/bookings" element={<Bookings />} />
      </Routes>
      <Chatbot />
    </div>
  );
}

export default App;
