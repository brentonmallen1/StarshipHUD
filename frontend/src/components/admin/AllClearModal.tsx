import { useState, useEffect } from 'react';
import type { SystemState, BulkResetRequest } from '../../types';
import './ScenarioForm.css';

const STATUS_OPTIONS = [
  { value: 'fully_operational', label: 'Fully Operational' },
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'compromised', label: 'Compromised' },
  { value: 'critical', label: 'Critical' },
];

interface AllClearModalProps {
  shipId: string;
  systems: SystemState[];
  isOpen: boolean;
  onClose: () => void;
  onReset: (request: BulkResetRequest) => void;
  isResetting?: boolean;
}

export function AllClearModal({
  shipId,
  systems,
  isOpen,
  onClose,
  onReset,
  isResetting,
}: AllClearModalProps) {
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState('operational');

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      // Default to all systems selected
      setSelectedSystems(new Set(systems.map(s => s.id)));
      setTargetStatus('operational');
    }
  }, [isOpen, systems]);

  if (!isOpen) return null;

  const toggleSystem = (id: string) => {
    const newSelected = new Set(selectedSystems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSystems(newSelected);
  };

  const selectAll = () => {
    setSelectedSystems(new Set(systems.map(s => s.id)));
  };

  const selectNone = () => {
    setSelectedSystems(new Set());
  };

  const handleReset = () => {
    const request: BulkResetRequest = {
      ship_id: shipId,
      reset_all: selectedSystems.size === systems.length,
      systems: Array.from(selectedSystems).map(id => ({
        system_id: id,
        target_status: targetStatus,
      })),
      emit_event: true,
    };
    onReset(request);
  };

  // Group systems by category
  const groupedSystems = systems.reduce((acc, system) => {
    const category = system.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(system);
    return acc;
  }, {} as Record<string, SystemState[]>);

  const getStatusClass = (status: string) => {
    return `status-${status}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content all-clear-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>All Clear - Reset Systems</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <h3>Target Status</h3>
            <div className="form-field">
              <select
                value={targetStatus}
                onChange={e => setTargetStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3>Systems to Reset</h3>
            <div className="bulk-select-buttons">
              <button type="button" className="btn" onClick={selectAll}>
                Select All
              </button>
              <button type="button" className="btn" onClick={selectNone}>
                Select None
              </button>
            </div>

            <div className="system-checkboxes">
              {Object.entries(groupedSystems).map(([category, categorySystems]) => (
                <div key={category}>
                  <div style={{
                    padding: '8px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--color-text-muted)',
                    marginTop: '8px',
                  }}>
                    {category}
                  </div>
                  {categorySystems.map(system => (
                    <label key={system.id} className="system-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedSystems.has(system.id)}
                        onChange={() => toggleSystem(system.id)}
                      />
                      <span className="system-checkbox-label">{system.name}</span>
                      <span className={`system-checkbox-status ${getStatusClass(system.status)}`}>
                        {system.status.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <div className="reset-preview">
              Reset {selectedSystems.size} system{selectedSystems.size !== 1 ? 's' : ''} to {targetStatus.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleReset}
            disabled={selectedSystems.size === 0 || isResetting}
          >
            {isResetting ? 'Resetting...' : 'Reset Systems'}
          </button>
        </div>
      </div>
    </div>
  );
}
