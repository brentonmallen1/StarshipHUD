import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page they were trying to access, default to /ships
  const from = (location.state as { from?: string })?.from || '/ships';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon" />
          </div>
          <h1 className="login-title">AUTHORIZATION REQUIRED</h1>
          <p className="login-subtitle">Vessel Access Control System</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="username">
              OPERATOR ID
            </label>
            <input
              id="username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={isSubmitting}
              placeholder="Enter credentials"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">
              ACCESS CODE
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isSubmitting}
              placeholder="Enter access code"
            />
          </div>

          {error && (
            <div className="login-error">
              <span className="error-icon">!</span>
              <span className="error-text">{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting || !username || !password}
          >
            {isSubmitting ? (
              <span className="button-loading">AUTHENTICATING...</span>
            ) : (
              <span className="button-text">AUTHENTICATE</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="scan-line" />
          <p className="footer-text">STARSHIP HUD v2026</p>
        </div>
      </div>
    </div>
  );
}
