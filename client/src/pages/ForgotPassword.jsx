import React, { useEffect, useState } from 'react';
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
    const [loadingRequest, setLoadingRequest] = useState(false);
    const [loadingVerify, setLoadingVerify] = useState(false);
    const [requestRetryAfterSeconds, setRequestRetryAfterSeconds] = useState(0);
    const [verifyRetryAfterSeconds, setVerifyRetryAfterSeconds] = useState(0);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!requestRetryAfterSeconds) {
            return undefined;
        }

        const timer = setInterval(() => {
            setRequestRetryAfterSeconds((prev) => (prev > 1 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [requestRetryAfterSeconds]);

    useEffect(() => {
        if (!verifyRetryAfterSeconds) {
            return undefined;
        }

        const timer = setInterval(() => {
            setVerifyRetryAfterSeconds((prev) => (prev > 1 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [verifyRetryAfterSeconds]);

    function normalizedEmail(value) {
        return value.trim().toLowerCase();
    }

    function isStrongPassword(value) {
        return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
    }

    async function requestOtp(e) {
        e.preventDefault();
        setError('');
        setMessage('');
        if (requestRetryAfterSeconds > 0) {
            setError(`Please wait ${requestRetryAfterSeconds}s before requesting another OTP.`);
            return;
        }

        const cleanEmail = normalizedEmail(email);
        if (!cleanEmail) {
            setError('Please enter your email address.');
            return;
        }

        setLoadingRequest(true);
        try {
            const { data } = await axios.post('/api/auth/request-reset', { email: cleanEmail });
            setEmail(cleanEmail);
            setSent(true);
            setRequestRetryAfterSeconds(0);
            setMessage(data.message || 'If an account exists, an OTP has been generated.');
            if (data.debugOtp) {
                setMessage((prev) => `${prev} Dev OTP: ${data.debugOtp}`);
            }
        } catch (err) {
            const nextRetry = Number(err?.response?.data?.retryAfterSeconds || 0);
            if (nextRetry > 0) {
                setRequestRetryAfterSeconds(nextRetry);
            }
            setError(err?.response?.data?.error || 'Unable to send OTP');
        } finally {
            setLoadingRequest(false);
        }
    }

    async function verifyOtpAndReset(e) {
        e.preventDefault();
        setError('');
        setMessage('');

        if (verifyRetryAfterSeconds > 0) {
            setError(`Please wait ${verifyRetryAfterSeconds}s before trying OTP verification again.`);
            return;
        }

        if (otp.trim().length !== 6) {
            setError('OTP must be exactly 6 digits.');
            return;
        }

        if (!isStrongPassword(newPassword)) {
            setError('Password must be at least 8 characters and include letters and numbers.');
            return;
        }

        setLoadingVerify(true);
        try {
            const { data } = await axios.post('/api/auth/verify-reset', {
                email: normalizedEmail(email),
                otp: otp.trim(),
                newPassword,
            });
            setVerifyRetryAfterSeconds(0);
            setMessage(data.message || 'Password updated successfully. You can login now.');
            setOtp('');
            setNewPassword('');
        } catch (err) {
            const nextRetry = Number(err?.response?.data?.retryAfterSeconds || 0);
            if (nextRetry > 0) {
                setVerifyRetryAfterSeconds(nextRetry);
            }
            setError(err?.response?.data?.error || 'Reset failed');
        } finally {
            setLoadingVerify(false);
        }
    }

    return (
        <div className="auth-page section-container">
            <div className="auth-card glass-card fade-in">
                <h2 className="heading-gradient">Reset Password</h2>
                <p>Enter your email to receive an OTP and set a new password.</p>

                {error && <p className="error">{error}</p>}
                {message && <p className="success">{message}</p>}
                {requestRetryAfterSeconds > 0 && (
                    <p className="auth-tip">You can request another OTP in {requestRetryAfterSeconds}s.</p>
                )}
                {verifyRetryAfterSeconds > 0 && (
                    <p className="auth-tip">You can retry OTP verification in {verifyRetryAfterSeconds}s.</p>
                )}

                {!sent ? (
                    <form onSubmit={requestOtp}>
                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>
                        <button type="submit" className="button-primary w-full" disabled={loadingRequest || requestRetryAfterSeconds > 0}>
                            {loadingRequest ? 'Sending...' : 'Send OTP'}
                        </button>
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
                                inputMode="numeric"
                                pattern="[0-9]{6}"
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
                                    minLength={8}
                                    autoComplete="new-password"
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
                        <p className="auth-link-row">Use at least 8 characters, with letters and numbers.</p>
                        <button type="submit" className="button-primary w-full" disabled={loadingVerify || verifyRetryAfterSeconds > 0}>
                            {loadingVerify ? 'Updating...' : 'Verify OTP & Reset'}
                        </button>
                        <button type="button" className="button-secondary w-full" onClick={() => setSent(false)} disabled={loadingVerify}>
                            Resend OTP
                        </button>
                    </form>
                )}

                <p className="auth-footer">Back to <Link to="/login">Login</Link></p>
            </div>
        </div>
    );
}

export default ForgotPassword;
