import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import './Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!retryAfterSeconds) {
      return undefined;
    }

    const timer = setInterval(() => {
      setRetryAfterSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [retryAfterSeconds]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');

    if (retryAfterSeconds > 0) {
      setErr(`Too many attempts. Try again in ${retryAfterSeconds}s.`);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validation
    if (!normalizedEmail) {
      setErr('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErr('Please enter a valid email address');
      return;
    }
    if (!password) {
      setErr('Password is required');
      return;
    }
    if (password.length < 6) {
      setErr('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post('/api/login', {
        email: normalizedEmail,
        password
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (data.token && data.user) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
        setRetryAfterSeconds(0);
      } else {
        setErr('Invalid response from server');
      }
    } catch (error) {
      const nextRetry = Number(error?.response?.data?.retryAfterSeconds || 0);
      if (nextRetry > 0) {
        setRetryAfterSeconds(nextRetry);
      }
      setErr(error?.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page section-container">
      <div className="auth-card glass-card fade-in">
        <h2 className="heading-gradient">Welcome Back</h2>
        <p>Login to your account to manage your trips</p>
        {err && <p className="error">{err}</p>}
        {retryAfterSeconds > 0 && <p className="auth-tip">Try again in {retryAfterSeconds}s.</p>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          <button type="submit" className="button-primary w-full" disabled={loading || retryAfterSeconds > 0}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-link-row"><Link to="/forgot-password">Forgot password?</Link></p>
        <p className="auth-footer">Don't have an account? <Link to="/register">Sign Up</Link></p>
      </div>
    </div>
  );
}

export default Login;
