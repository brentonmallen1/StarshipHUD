import type { SystemState, SystemStatus } from '../../types';
import './ShipEditModal.css';

interface SystemsByStatusModalProps {
  isOpen: boolean;
  status: SystemStatus | null;
  systems: SystemState[];
  onClose: () => void;
}

const STATUS_LABELS: Record<SystemStatus, string> = {
  fully_operational: 'Fully Operational',
  operational: 'Operational',
  degraded: 'Degraded',
  compromised: 'Compromised',
  critical: 'Critical',
  destroyed: 'Destroyed',
  offline: 'Offline',
};

export function SystemsByStatusModal({ isOpen, status, systems, onClose }: SystemsByStatusModalProps) {
  if (!isOpen || !status) return null;

  const filteredSystems = systems.filter(s => s.status === status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-medium" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <span className={`status-indicator status-${status}`} />
            {STATUS_LABELS[status]} Systems
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {filteredSystems.length === 0 ? (
            <div className="modal-empty-state">
              No systems with status "{STATUS_LABELS[status]}"
            </div>
          ) : (
            <div className="systems-list">
              {filteredSystems.map(system => (
                <div key={system.id} className="system-list-item">
                  <div className="system-list-main">
                    <span className="system-list-name">{system.name}</span>
                    {system.category && (
                      <span className="system-list-category">{system.category}</span>
                    )}
                  </div>
                  <div className="system-list-stats">
                    <span className="system-list-value">
                      {system.value}{system.unit}
                    </span>
                    {system.effective_status && system.effective_status !== system.status && (
                      <span className={`system-list-effective status-${system.effective_status}`}>
                        (eff: {system.effective_status})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className="modal-count">
            {filteredSystems.length} system{filteredSystems.length !== 1 ? 's' : ''}
          </span>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
