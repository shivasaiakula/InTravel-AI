import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import './Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('/api/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (error) {
      setErr(error?.response?.data?.error || 'Invalid email or password');
    }
  };

  return (
    <div className="auth-page section-container">
      <div className="auth-card glass-card fade-in">
        <h2 className="heading-gradient">Welcome Back</h2>
        <p>Login to your account to manage your trips</p>
        {err && <p className="error">{err}</p>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="button-primary w-full">Sign In</button>
        </form>
        <p className="auth-link-row"><Link to="/forgot-password">Forgot password?</Link></p>
        <p className="auth-footer">Don't have an account? <Link to="/register">Sign Up</Link></p>
      </div>
    </div>
  );
}

export default Login;
