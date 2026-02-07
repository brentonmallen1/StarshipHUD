import { useState } from 'react';
import type { Role, StationGroup } from '../types';
import './PanelCreationModal.css';

interface Props {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    station_group: StationGroup;
    description?: string;
    grid_columns: number;
    grid_rows: number;
    role_visibility: Role[];
  }) => Promise<void>;
  defaultRoleVisibility?: Role[];
}

const PLAYER_STATION_OPTIONS: { value: StationGroup; label: string }[] = [
  { value: 'command', label: 'Command' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'sensors', label: 'Sensors' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'life_support', label: 'Life Support' },
  { value: 'communications', label: 'Communications' },
  { value: 'operations', label: 'Operations' },
];

export function PanelCreationModal({ onClose, onCreate, defaultRoleVisibility }: Props) {
  const isGmDefault = defaultRoleVisibility?.includes('gm') && !defaultRoleVisibility?.includes('player');
  const [name, setName] = useState('');
  const [isGmDashboard, setIsGmDashboard] = useState(isGmDefault ?? false);
  const [stationGroup, setStationGroup] = useState<StationGroup>('command');
  const [description, setDescription] = useState('');
  const [gridColumns, setGridColumns] = useState(24);
  const [gridRows, setGridRows] = useState(16);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Panel name is required');
      return;
    }

    setIsCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        station_group: isGmDashboard ? 'admin' : stationGroup,
        description: description.trim() || undefined,
        grid_columns: gridColumns,
        grid_rows: gridRows,
        role_visibility: isGmDashboard ? ['gm'] : ['player', 'gm'],
      });
      onClose();
    } catch (err) {
      console.error('Failed to create panel:', err);
      alert('Failed to create panel');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content panel-creation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create New Panel</h2>
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
            <label className="form-label">Panel Type</label>
            <div className="form-visibility-options">
              <button
                type="button"
                className={`visibility-option ${!isGmDashboard ? 'active' : ''}`}
                onClick={() => setIsGmDashboard(false)}
              >
                Player Panel
              </button>
              <button
                type="button"
                className={`visibility-option ${isGmDashboard ? 'active' : ''}`}
                onClick={() => setIsGmDashboard(true)}
              >
                GM Dashboard
              </button>
            </div>
            <p className="field-hint">GM Dashboards appear in the Dashboards area</p>
          </div>

          {!isGmDashboard && (
            <div className="form-section">
              <label className="form-label">
                Station Group <span className="required">*</span>
              </label>
              <select
                className="form-input"
                value={stationGroup}
                onChange={(e) => setStationGroup(e.target.value as StationGroup)}
              >
                {PLAYER_STATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          <div className="form-row">
            <div className="form-section">
              <label className="form-label">Grid Columns</label>
              <input
                type="number"
                className="form-input"
                value={gridColumns}
                onChange={(e) => setGridColumns(Math.max(12, Math.min(48, parseInt(e.target.value) || 24)))}
                min={12}
                max={48}
              />
              <p className="field-hint">Default: 24 (higher = finer horizontal control)</p>
            </div>

            <div className="form-section">
              <label className="form-label">Grid Rows</label>
              <input
                type="number"
                className="form-input"
                value={gridRows}
                onChange={(e) => setGridRows(Math.max(8, Math.min(32, parseInt(e.target.value) || 16)))}
                min={8}
                max={32}
              />
              <p className="field-hint">Default: 16</p>
            </div>
          </div>

          <div className="form-info">
            <p>The panel will be created with an empty grid. You can add widgets in edit mode after creation.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Panel'}
          </button>
        </div>
      </div>
    </div>
  );
}
