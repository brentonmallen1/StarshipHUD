import { useState, FormEvent } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import './UserSettingsModal.css';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const modalRef = useModalA11y(onClose);
  const { user, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  if (!isOpen) return null;

  const hasChanges = displayName !== user?.display_name;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!hasChanges) {
      return;
    }

    if (displayName.trim().length < 1) {
      setError('Display name cannot be empty');
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.updateMe({ display_name: displayName.trim() });
      await refreshUser();
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-content user-settings-modal" ref={modalRef}>
          <div className="modal-header">
            <h2>Settings</h2>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="settings-section">
                <h3 className="section-title">Profile</h3>

                <div className="form-field">
                  <label className="form-label" htmlFor="username">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    className="form-input readonly"
                    value={user?.username ?? ''}
                    disabled
                    readOnly
                  />
                  <span className="form-hint">Username cannot be changed</span>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="displayName">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    className="form-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isSubmitting}
                    maxLength={100}
                  />
                  <span className="form-hint">This name appears throughout the HUD</span>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="role">
                    Role
                  </label>
                  <input
                    id="role"
                    type="text"
                    className="form-input readonly"
                    value={user?.role ?? ''}
                    disabled
                    readOnly
                  />
                </div>
              </div>

              <div className="settings-section">
                <h3 className="section-title">Security</h3>
                <button
                  type="button"
                  className="btn btn-secondary password-change-btn"
                  onClick={() => setShowPasswordModal(true)}
                >
                  Change Password
                </button>
              </div>

              {error && <div className="form-error">{error}</div>}
              {success && <div className="form-success">{success}</div>}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Close
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !hasChanges}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
}
