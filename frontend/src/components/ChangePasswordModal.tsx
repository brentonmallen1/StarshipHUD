import { useState, FormEvent } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './ChangePasswordModal.css';

function PasswordToggleIcon({ show }: { show: boolean }) {
  return show ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  forced?: boolean; // If true, user cannot dismiss without changing password
}

export function ChangePasswordModal({ isOpen, onClose, forced = false }: ChangePasswordModalProps) {
  const modalRef = useModalA11y(forced ? () => {} : onClose);
  const { logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      // For forced changes, don't send current password
      await authApi.changePassword(forced ? null : currentPassword, newPassword);
      // Password changed successfully - will be logged out
      await logout();
      // Navigate to login happens automatically via auth context
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content change-password-modal" ref={modalRef}>
        <div className="modal-header">
          <h2>{forced ? 'Password Change Required' : 'Change Password'}</h2>
          {!forced && (
            <button className="modal-close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {forced && (
              <div className="password-notice">
                <p>Your password must be changed before continuing.</p>
              </div>
            )}

            {!forced && (
              <div className="form-field">
                <label className="form-label" htmlFor="currentPassword">
                  Current Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    tabIndex={-1}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    <PasswordToggleIcon show={showCurrentPassword} />
                  </button>
                </div>
              </div>
            )}

            <div className="form-field">
              <label className="form-label" htmlFor="newPassword">
                New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus={forced}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  <PasswordToggleIcon show={showNewPassword} />
                </button>
              </div>
              <span className="form-hint">Minimum 8 characters</span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <PasswordToggleIcon show={showConfirmPassword} />
                </button>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
          </div>

          <div className="modal-footer">
            {!forced && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || (!forced && !currentPassword) || !newPassword || !confirmPassword}
            >
              {isSubmitting ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
