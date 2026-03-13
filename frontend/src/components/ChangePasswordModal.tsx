import { useState, FormEvent } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './ChangePasswordModal.css';

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
      await authApi.changePassword(currentPassword, newPassword);
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

            <div className="form-field">
              <label className="form-label" htmlFor="currentPassword">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="newPassword">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <span className="form-hint">Minimum 8 characters</span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
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
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
            >
              {isSubmitting ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
