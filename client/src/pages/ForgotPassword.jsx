import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import './Auth.css';

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [sent, setSent] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    async function requestOtp(e) {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const { data } = await axios.post('/api/auth/request-reset', { email });
            setSent(true);
            setMessage(data.message || 'OTP sent. Please check your email.');
            if (data.debugOtp) {
                setMessage((prev) => `${prev} Dev OTP: ${data.debugOtp}`);
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Unable to send OTP');
        }
    }

    async function verifyOtpAndReset(e) {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const { data } = await axios.post('/api/auth/verify-reset', {
                email,
                otp,
                newPassword,
            });
            setMessage(data.message || 'Password updated successfully. You can login now.');
            setOtp('');
            setNewPassword('');
        } catch (err) {
            setError(err?.response?.data?.error || 'Reset failed');
        }
    }

    return (
        <div className="auth-page section-container">
            <div className="auth-card glass-card fade-in">
                <h2 className="heading-gradient">Reset Password</h2>
                <p>Enter your email to receive an OTP and set a new password.</p>

                {error && <p className="error">{error}</p>}
                {message && <p className="auth-link-row">{message}</p>}

                {!sent ? (
                    <form onSubmit={requestOtp}>
                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="button-primary w-full">Send OTP</button>
                    </form>
                ) : (
                    <form onSubmit={verifyOtpAndReset}>
                        <div className="form-group">
                            <label>Email Address</label>
                            <input type="email" value={email} disabled />
                        </div>
                        <div className="form-group">
                            <label>OTP Code</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                minLength={6}
                                maxLength={6}
                            />
                        </div>
                        <div className="form-group">
                            <label>New Password</label>
                            <div className="password-field">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
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
                        <button type="submit" className="button-primary w-full">Verify OTP & Reset</button>
                    </form>
                )}

                <p className="auth-footer">Back to <Link to="/login">Login</Link></p>
            </div>
        </div>
    );
}

export default ForgotPassword;
