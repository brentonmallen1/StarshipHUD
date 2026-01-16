import { useState } from 'react';
import type { EventSeverity } from '../../types';
import './ShipEditModal.css';

interface AlertFormModalProps {
  isOpen: boolean;
  shipId: string;
  onClose: () => void;
  onSubmit: (data: {
    ship_id: string;
    type: string;
    severity: EventSeverity;
    message: string;
    data: { category?: string; location?: string; acknowledged: boolean; ship_wide?: boolean };
  }) => void;
  isSubmitting?: boolean;
}

const SEVERITIES: { value: EventSeverity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

export function AlertFormModal({
  isOpen,
  shipId,
  onClose,
  onSubmit,
  isSubmitting = false,
}: AlertFormModalProps) {
  const [severity, setSeverity] = useState<EventSeverity>('warning');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [shipWide, setShipWide] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    onSubmit({
      ship_id: shipId,
      type: 'alert',
      severity,
      message: message.trim(),
      data: {
        ...(category.trim() && { category: category.trim() }),
        ...(location.trim() && { location: location.trim() }),
        acknowledged: false,
        ...(shipWide && { ship_wide: true }),
      },
    });

    // Reset form
    setSeverity('warning');
    setMessage('');
    setCategory('');
    setLocation('');
    setShipWide(false);
  };

  const handleClose = () => {
    setSeverity('warning');
    setMessage('');
    setCategory('');
    setLocation('');
    setShipWide(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-medium" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Alert</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-section">
              <div className="form-field">
                <label htmlFor="alert-severity">Severity</label>
                <select
                  id="alert-severity"
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
                <label htmlFor="alert-message">Message *</label>
                <input
                  id="alert-message"
                  type="text"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Enter alert message..."
                  required
                  autoFocus
                />
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="alert-category">Category</label>
                  <input
                    id="alert-category"
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="e.g., Systems, Security"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="alert-location">Location</label>
                  <input
                    id="alert-location"
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g., Deck 3, Engineering"
                  />
                </div>
              </div>

              <div className="form-field form-field-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={shipWide}
                    onChange={e => setShipWide(e.target.checked)}
                  />
                  <span className="checkbox-text">Ship-wide Alert</span>
                </label>
                <span className="form-hint">
                  Displays prominently until acknowledged or cleared
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
              {isSubmitting ? 'Creating...' : 'Create Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
