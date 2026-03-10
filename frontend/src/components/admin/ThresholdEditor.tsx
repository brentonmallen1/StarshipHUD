import { useState, useMemo } from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { SystemState, SystemStatus, StatusThresholds } from '../../types';
import './ThresholdEditor.css';

interface ThresholdEditorProps {
  isOpen: boolean;
  system: SystemState;
  onSave: (thresholds: StatusThresholds | null) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Status order from best to worst (for display and validation)
const STATUS_ORDER: SystemStatus[] = [
  'optimal',
  'operational',
  'degraded',
  'compromised',
  'critical',
  'destroyed',
];

const STATUS_LABELS: Record<SystemStatus, string> = {
  optimal: 'Optimal',
  operational: 'Operational',
  degraded: 'Degraded',
  compromised: 'Compromised',
  critical: 'Critical',
  destroyed: 'Destroyed',
  offline: 'Offline',
};

const STATUS_COLORS: Record<SystemStatus, string> = {
  optimal: 'var(--color-optimal)',
  operational: 'var(--color-operational)',
  degraded: 'var(--color-degraded)',
  compromised: 'var(--color-compromised)',
  critical: 'var(--color-critical)',
  destroyed: 'var(--color-destroyed)',
  offline: 'var(--color-offline)',
};

/**
 * Smart distribute thresholds between min and max values
 * Handles cases where range < number of statuses gracefully
 */
function smartDistribute(min: number, max: number): StatusThresholds {
  const statuses = STATUS_ORDER.filter(s => s !== 'offline');
  const range = max - min;
  const thresholds: StatusThresholds = {};

  // Always set bookends
  thresholds.optimal = max;
  thresholds.destroyed = min;

  // Distribute middle statuses across remaining range
  const middleStatuses = statuses.slice(1, -1); // operational through critical
  const step = range / (statuses.length - 1);

  middleStatuses.forEach((status, i) => {
    // Round to nearest integer, working down from optimal
    thresholds[status] = Math.round(max - (i + 1) * step);
  });

  return thresholds;
}

/**
 * Default thresholds: full distribution from 0 to max (standard setup)
 */
function defaultThresholds(max: number): StatusThresholds {
  return smartDistribute(0, max);
}

/**
 * Calculate what status a value would have given thresholds
 */
function getStatusForValue(value: number, thresholds: StatusThresholds): SystemStatus {
  for (const status of STATUS_ORDER) {
    if (status in thresholds && value >= (thresholds[status] ?? 0)) {
      return status;
    }
  }
  return 'destroyed';
}

export function ThresholdEditor({
  isOpen,
  system,
  onSave,
  onCancel,
  isLoading,
}: ThresholdEditorProps) {
  const modalRef = useModalA11y(onCancel);

  // Initialize thresholds from system or use defaults
  const [thresholds, setThresholds] = useState<StatusThresholds>(() => {
    if (system.status_thresholds) {
      return { ...system.status_thresholds };
    }
    return defaultThresholds(system.max_value);
  });

  const [isEnabled, setIsEnabled] = useState(!!system.status_thresholds);

  // Distribution min input (max is always system.max_value)
  const [distributeMin, setDistributeMin] = useState(0);

  const maxValue = system.max_value;

  // Validation: check if thresholds are in descending order
  const validationError = useMemo(() => {
    if (!isEnabled) return null;

    const definedStatuses = STATUS_ORDER.filter(s => s in thresholds);
    for (let i = 0; i < definedStatuses.length - 1; i++) {
      const curr = definedStatuses[i];
      const next = definedStatuses[i + 1];
      const currVal = thresholds[curr] ?? 0;
      const nextVal = thresholds[next] ?? 0;
      if (currVal < nextVal) {
        return `${STATUS_LABELS[curr]} (${currVal}) must be >= ${STATUS_LABELS[next]} (${nextVal})`;
      }
    }
    return null;
  }, [thresholds, isEnabled]);

  // Preview: show what each integer value would map to
  const preview = useMemo(() => {
    if (!isEnabled) return [];

    const items: Array<{ value: number; status: SystemStatus }> = [];
    for (let v = Math.floor(maxValue); v >= 0; v--) {
      items.push({ value: v, status: getStatusForValue(v, thresholds) });
    }
    return items;
  }, [thresholds, maxValue, isEnabled]);

  const handleThresholdChange = (status: SystemStatus, value: string) => {
    // Allow empty string to clear the field
    if (value === '') {
      setThresholds(prev => {
        const next = { ...prev };
        delete next[status];
        return next;
      });
      return;
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;

    setThresholds(prev => ({
      ...prev,
      [status]: Math.min(numValue, maxValue),
    }));
  };

  const handleDefault = () => {
    setThresholds(defaultThresholds(maxValue));
  };

  const handleSmartDistribute = () => {
    const min = Math.max(0, Math.min(distributeMin, maxValue));
    setThresholds(smartDistribute(min, maxValue));
  };

  const handleToggleEnabled = () => {
    setIsEnabled(!isEnabled);
    if (!isEnabled) {
      // When enabling, use defaults if no thresholds exist
      if (!system.status_thresholds) {
        setThresholds(defaultThresholds(maxValue));
      }
    }
  };

  const handleSave = () => {
    if (isEnabled && !validationError) {
      onSave(thresholds);
    } else if (!isEnabled) {
      onSave(null); // Clear thresholds to use percentage-based
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        ref={modalRef}
        className="modal-content threshold-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit Status Thresholds"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Status Thresholds: {system.name}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="threshold-info">
            <p>
              Configure custom status thresholds for discrete values (0–{maxValue}).
              When enabled, status is determined by value instead of percentage.
            </p>
          </div>

          <div className="threshold-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={handleToggleEnabled}
              />
              <span>Use custom thresholds (discrete mode)</span>
            </label>
            {!isEnabled && (
              <span className="toggle-hint">
                Currently using percentage-based thresholds
              </span>
            )}
          </div>

          {isEnabled && (
            <>
              <div className="threshold-controls">
                <div className="threshold-header">
                  <span>Status</span>
                  <span>Min Value</span>
                </div>

                {STATUS_ORDER.map(status => (
                  <div key={status} className="threshold-row">
                    <label
                      className="threshold-status"
                      style={{ color: STATUS_COLORS[status] }}
                    >
                      <span
                        className="status-dot"
                        style={{ backgroundColor: STATUS_COLORS[status] }}
                      />
                      {STATUS_LABELS[status]}
                    </label>
                    <input
                      type="number"
                      className="threshold-input"
                      value={thresholds[status] ?? ''}
                      onChange={e => handleThresholdChange(status, e.target.value)}
                      min={0}
                      max={maxValue}
                      placeholder={status === 'destroyed' ? '0' : '—'}
                    />
                  </div>
                ))}

                <div className="threshold-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleDefault}
                    title="Set optimal to max, destroyed to 0, clear others"
                  >
                    Default
                  </button>

                  <div className="distribute-controls">
                    <label className="distribute-label">Distribute from</label>
                    <input
                      type="number"
                      className="threshold-input distribute-input"
                      value={distributeMin}
                      onChange={e => setDistributeMin(Number(e.target.value))}
                      min={0}
                      max={maxValue - 1}
                      title="Min value (destroyed threshold)"
                    />
                    <span className="distribute-separator">to {maxValue}</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSmartDistribute}
                      title="Evenly distribute all statuses from min to max"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              {validationError && (
                <div className="threshold-error">
                  {validationError}
                </div>
              )}

              <div className="threshold-preview">
                <h4>Value Preview</h4>
                <div className="preview-bar">
                  {preview.map(({ value, status }) => (
                    <div
                      key={value}
                      className="preview-segment"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                      title={`${value} → ${STATUS_LABELS[status]}`}
                    >
                      <span className="preview-value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isLoading || (isEnabled && !!validationError)}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
