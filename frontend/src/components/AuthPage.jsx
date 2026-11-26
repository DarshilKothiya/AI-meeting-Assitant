import React, { useState } from 'react';
import { apiService } from '../services/apiService';

const AuthPage = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      const data =
        mode === 'login'
          ? await apiService.login(email.trim(), password)
          : await apiService.register(name.trim(), email.trim(), password);

      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <div className="brand-icon" style={{ width: '46px', height: '46px', fontSize: '1.35rem' }}>
            N
          </div>
          <div>
            <h1 className="auth-brand-title">Nexora</h1>
            <p className="auth-brand-subtitle">Meeting Assistant</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Create Account
          </button>
        </div>

        <p className="auth-desc">
          {mode === 'login'
            ? 'Sign in to access your personal meetings, transcripts, and AI summaries.'
            : 'Create your Nexora account to securely store your meetings in MongoDB.'}
        </p>

        {error && (
          <div className="auth-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === 'login'}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', paddingRight: '3rem' }}
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem', fontSize: '0.95rem' }}
            disabled={loading}
          >
            {loading
              ? mode === 'login'
                ? 'Signing In...'
                : 'Creating Account...'
              : mode === 'login'
                ? 'Sign In to Nexora'
                : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
