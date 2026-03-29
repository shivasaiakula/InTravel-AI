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
import Chatbot from './components/Chatbot';

function getThemeByMonth(monthIndex) {
  if (monthIndex >= 2 && monthIndex <= 4) return 'forest-monsoon';
  if (monthIndex >= 5 && monthIndex <= 7) return 'coastal-breeze';
  if (monthIndex >= 10 || monthIndex <= 1) return 'midnight-luxe';
  return 'desert-sunrise';
}

function App() {
  useEffect(() => {
    const storedTheme = localStorage.getItem('intravel-theme');
    const activeTheme = storedTheme || getThemeByMonth(new Date().getMonth());
    document.documentElement.setAttribute('data-season-theme', activeTheme);
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
      </Routes>
      <Chatbot />
    </div>
  );
}

export default App;
