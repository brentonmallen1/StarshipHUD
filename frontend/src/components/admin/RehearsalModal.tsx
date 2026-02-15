import { useModalA11y } from '../../hooks/useModalA11y';
import type { ScenarioRehearsalResult } from '../../types';
import './ScenarioForm.css';

interface RehearsalModalProps {
  result: ScenarioRehearsalResult;
  isOpen: boolean;
  onClose: () => void;
  onExecute: () => void;
  isExecuting?: boolean;
}

export function RehearsalModal({
  result,
  isOpen,
  onClose,
  onExecute,
  isExecuting,
}: RehearsalModalProps) {
  const modalRef = useModalA11y(onClose);

  if (!isOpen) return null;

  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;
  const hasSystemChanges = result.system_changes.length > 0;
  const hasPostureChange = !!result.posture_change;
  const hasEvents = result.events_preview.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content rehearsal-modal" role="dialog" aria-modal="true" aria-label={`Rehearsal: ${result.scenario_name}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Rehearsal: {result.scenario_name}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="rehearsal-content">
            {/* Errors */}
            {hasErrors && (
              <div className="rehearsal-section">
                <h4>Errors</h4>
                <div className="errors-list">
                  {result.errors.map((error, i) => (
                    <div key={i} className="error-item">{error}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {hasWarnings && (
              <div className="rehearsal-section">
                <h4>Warnings</h4>
                <div className="warnings-list">
                  {result.warnings.map((warning, i) => (
                    <div key={i} className="warning-item">{warning}</div>
                  ))}
                </div>
              </div>
            )}

            {/* System Changes */}
            {hasSystemChanges && (
              <div className="rehearsal-section">
                <h4>System Changes</h4>
                <table className="changes-table">
                  <thead>
                    <tr>
                      <th>System</th>
                      <th>Before</th>
                      <th></th>
                      <th>After</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.system_changes.map((change, i) => (
                      <tr key={i}>
                        <td>{change.system_name}</td>
                        <td className={`status-cell status-${change.before_status}`}>
                          {change.before_status.replace('_', ' ')}
                        </td>
                        <td className="arrow-cell">→</td>
                        <td className={`status-cell status-${change.after_status}`}>
                          {change.after_status.replace('_', ' ')}
                        </td>
                        <td>
                          {change.before_value.toFixed(0)} → {change.after_value.toFixed(0)} / {change.max_value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Posture Change */}
            {hasPostureChange && (
              <div className="rehearsal-section">
                <h4>Posture Change</h4>
                <div className="posture-change">
                  <span className={`posture-badge posture-${result.posture_change!.before_posture}`}>
                    {result.posture_change!.before_posture.replace('_', ' ')}
                  </span>
                  <span className="arrow-cell">→</span>
                  <span className={`posture-badge posture-${result.posture_change!.after_posture}`}>
                    {result.posture_change!.after_posture.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}

            {/* Events */}
            {hasEvents && (
              <div className="rehearsal-section">
                <h4>Events to Emit</h4>
                <div className="events-list">
                  {result.events_preview.map((event, i) => (
                    <div key={i} className="event-preview">
                      <span className="event-type">{event.type}</span>
                      <span className={`event-severity severity-${event.severity}`}>
                        {event.severity}
                      </span>
                      <span className="event-message">{event.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No changes message */}
            {!hasSystemChanges && !hasPostureChange && !hasErrors && (
              <div className="rehearsal-section">
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  No system or posture changes will occur.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onExecute}
            disabled={!result.can_execute || isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Execute Scenario'}
          </button>
        </div>
      </div>
    </div>
  );
}
