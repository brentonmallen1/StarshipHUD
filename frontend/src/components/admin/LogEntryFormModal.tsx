import { useState } from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { EventSeverity } from '../../types';
import './ShipEditModal.css';

interface LogEntryFormModalProps {
  isOpen: boolean;
  shipId: string;
  onClose: () => void;
  onSubmit: (data: {
    ship_id: string;
    severity: EventSeverity;
    message: string;
    transmitted: boolean;
  }) => void;
  isSubmitting?: boolean;
}

const SEVERITIES: { value: EventSeverity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

export function LogEntryFormModal({
  isOpen,
  shipId,
  onClose,
  onSubmit,
  isSubmitting = false,
}: LogEntryFormModalProps) {
  const modalRef = useModalA11y(onClose);
  const [severity, setSeverity] = useState<EventSeverity>('info');
  const [message, setMessage] = useState('');
  const [asDraft, setAsDraft] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    onSubmit({
      ship_id: shipId,
      severity,
      message: message.trim(),
      transmitted: !asDraft,
    });

    setSeverity('info');
    setMessage('');
    setAsDraft(true);
  };

  const handleClose = () => {
    setSeverity('info');
    setMessage('');
    setAsDraft(true);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div ref={modalRef} className="modal-content modal-medium" role="dialog" aria-modal="true" aria-label="Create Log Entry" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Log Entry</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-section">
              <div className="form-field">
                <label htmlFor="log-severity">Severity</label>
                <select
                  id="log-severity"
                  value={severity}
                  onChange={e => setSeverity(e.target.value as EventSeverity)}
                  className="form-select"
                >
                  {SEVERITIES.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="log-message">Message *</label>
                <textarea
                  id="log-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Enter narrative log entry..."
                  required
                  autoFocus
                  rows={4}
                />
              </div>

              <div className="form-field form-field-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={asDraft}
                    onChange={e => setAsDraft(e.target.checked)}
                  />
                  <span className="checkbox-text">Create as draft</span>
                </label>
                <span className="form-hint">
                  Drafts are hidden from players until you make them visible
                </span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={handleClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!message.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Log Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
