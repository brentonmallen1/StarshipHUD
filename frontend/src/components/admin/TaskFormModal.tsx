import { useState } from 'react';
import type { StationGroup } from '../../types';
import './ShipEditModal.css';

interface TaskFormModalProps {
  isOpen: boolean;
  shipId: string;
  onClose: () => void;
  onSubmit: (data: {
    ship_id: string;
    title: string;
    station: StationGroup;
    description?: string;
    time_limit?: number;
  }) => void;
  isSubmitting?: boolean;
}

// Stations available for task assignment (excluding admin)
const STATIONS: { value: StationGroup; label: string }[] = [
  { value: 'command', label: 'Command' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'sensors', label: 'Sensors' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'life_support', label: 'Life Support' },
  { value: 'communications', label: 'Communications' },
  { value: 'operations', label: 'Operations' },
];

export function TaskFormModal({
  isOpen,
  shipId,
  onClose,
  onSubmit,
  isSubmitting = false,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [station, setStation] = useState<StationGroup>('engineering');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const timeLimitMinutes = timeLimit ? parseInt(timeLimit, 10) : undefined;
    const timeLimitSeconds = timeLimitMinutes ? timeLimitMinutes * 60 : undefined;

    onSubmit({
      ship_id: shipId,
      title: title.trim(),
      station,
      ...(description.trim() && { description: description.trim() }),
      ...(timeLimitSeconds && { time_limit: timeLimitSeconds }),
    });

    // Reset form
    setTitle('');
    setStation('engineering');
    setDescription('');
    setTimeLimit('');
  };

  const handleClose = () => {
    setTitle('');
    setStation('engineering');
    setDescription('');
    setTimeLimit('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-medium" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Task</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-section">
              <div className="form-field">
                <label htmlFor="task-title">Title *</label>
                <input
                  id="task-title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter task title..."
                  required
                  autoFocus
                />
              </div>

              <div className="form-field">
                <label htmlFor="task-station">Station</label>
                <select
                  id="task-station"
                  value={station}
                  onChange={e => setStation(e.target.value as StationGroup)}
                >
                  {STATIONS.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="task-description">Description</label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional task details..."
                  rows={3}
                />
              </div>

              <div className="form-field">
                <label htmlFor="task-time-limit">Time Limit (minutes)</label>
                <input
                  id="task-time-limit"
                  type="number"
                  min="1"
                  max="120"
                  value={timeLimit}
                  onChange={e => setTimeLimit(e.target.value)}
                  placeholder="Optional"
                />
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
              disabled={!title.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
