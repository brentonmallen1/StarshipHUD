import { useState, useEffect } from 'react';
import type { Panel, StationGroup } from '../types';
import './PanelCreationModal.css';

interface Props {
  panel: Panel;
  onClose: () => void;
  onUpdate: (data: {
    name: string;
    station_group: StationGroup;
    description?: string;
  }) => Promise<void>;
}

const STATION_OPTIONS: { value: StationGroup; label: string }[] = [
  { value: 'command', label: 'Command' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'sensors', label: 'Sensors' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'life_support', label: 'Life Support' },
  { value: 'communications', label: 'Communications' },
  { value: 'operations', label: 'Operations' },
  { value: 'admin', label: 'Admin' },
];

export function PanelEditModal({ panel, onClose, onUpdate }: Props) {
  const [name, setName] = useState(panel.name);
  const [stationGroup, setStationGroup] = useState<StationGroup>(panel.station_group);
  const [description, setDescription] = useState(panel.description || '');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setName(panel.name);
    setStationGroup(panel.station_group);
    setDescription(panel.description || '');
  }, [panel]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      alert('Panel name is required');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate({
        name: name.trim(),
        station_group: stationGroup,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update panel:', err);
      alert('Failed to update panel');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content panel-creation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Panel Details</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <label className="form-label">
              Panel Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Engineering Console"
              autoFocus
            />
          </div>

          <div className="form-section">
            <label className="form-label">
              Station Group <span className="required">*</span>
            </label>
            <select
              className="form-input"
              value={stationGroup}
              onChange={(e) => setStationGroup(e.target.value as StationGroup)}
            >
              {STATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-section">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-input form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this panel's purpose"
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleUpdate}
            disabled={isUpdating || !name.trim()}
          >
            {isUpdating ? 'Updating...' : 'Update Panel'}
          </button>
        </div>
      </div>
    </div>
  );
}
