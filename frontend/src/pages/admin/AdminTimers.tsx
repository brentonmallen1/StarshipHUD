import { useState, useMemo, useEffect } from 'react';
import { useTimers, useScenarios } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useCreateTimer, useDeleteTimer, usePauseTimer, useResumeTimer, useTriggerTimer } from '../../hooks/useMutations';
import type { Timer, EventSeverity } from '../../types';
import './Admin.css';

type TimerFilter = 'all' | 'active' | 'expired';

const SEVERITY_OPTIONS: { value: EventSeverity; label: string }[] = [
  { value: 'info', label: 'Info (Calm)' },
  { value: 'warning', label: 'Warning (Urgent)' },
  { value: 'critical', label: 'Critical (Emergency)' },
];

const SEVERITY_DISPLAY: Record<EventSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

const SEVERITY_CLASS: Record<EventSeverity, string> = {
  info: 'status-operational',
  warning: 'status-degraded',
  critical: 'status-critical',
};

/**
 * Format remaining time as human-readable string (countdown)
 */
function formatRemaining(endTime: string, pausedAt?: string | null): string {
  const end = new Date(endTime).getTime();
  const now = pausedAt ? new Date(pausedAt).getTime() : Date.now();
  const remaining = end - now;

  if (remaining <= 0) return 'Expired';

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format elapsed time as human-readable string (countup)
 */
function formatElapsed(startTime: string, pausedAt?: string | null): string {
  const start = new Date(startTime).getTime();
  const now = pausedAt ? new Date(pausedAt).getTime() : Date.now();
  const elapsed = now - start;

  if (elapsed < 0) return '+0s';

  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `+${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `+${minutes}m ${seconds}s`;
  }
  return `+${seconds}s`;
}

/**
 * Format timer time display based on direction
 */
function formatTimerTime(timer: Timer): string {
  if (timer.direction === 'countup' && timer.start_time) {
    return formatElapsed(timer.start_time, timer.paused_at);
  }
  if (timer.end_time) {
    return formatRemaining(timer.end_time, timer.paused_at);
  }
  return '—';
}

/**
 * Check if timer has expired
 */
function isExpired(timer: Timer): boolean {
  if (timer.paused_at) return false;
  // Countup timers don't expire
  if (timer.direction === 'countup' || !timer.end_time) return false;
  return new Date(timer.end_time).getTime() <= Date.now();
}

export function AdminTimers() {
  const shipId = useCurrentShipId();
  const { data: timers, isLoading } = useTimers(shipId ?? undefined); // All timers
  const { data: scenarios } = useScenarios(shipId ?? undefined);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filter, setFilter] = useState<TimerFilter>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState('');
  const [formMinutes, setFormMinutes] = useState(5);
  const [formSeconds, setFormSeconds] = useState(0);
  const [formSeverity, setFormSeverity] = useState<EventSeverity>('warning');
  const [formScenarioId, setFormScenarioId] = useState('');
  const [formVisible, setFormVisible] = useState(true);

  // Force re-render every second for countdown updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const createTimer = useCreateTimer();
  const deleteTimer = useDeleteTimer();
  const pauseTimer = usePauseTimer();
  const resumeTimer = useResumeTimer();
  const triggerTimer = useTriggerTimer();

  // Filter timers
  const filteredTimers = useMemo(() => {
    if (!timers) return [];
    return timers.filter(timer => {
      if (filter === 'active') return !isExpired(timer);
      if (filter === 'expired') return isExpired(timer);
      return true;
    }).sort((a, b) => {
      // Sort active timers first, then by end_time/start_time
      const aExpired = isExpired(a);
      const bExpired = isExpired(b);
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      // Use end_time for countdown, start_time for countup
      const aTime = a.end_time || a.start_time || a.created_at;
      const bTime = b.end_time || b.start_time || b.created_at;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
  }, [timers, filter]);

  const activeCount = useMemo(() => {
    return timers?.filter(t => !isExpired(t)).length ?? 0;
  }, [timers]);

  const expiredCount = useMemo(() => {
    return timers?.filter(t => isExpired(t)).length ?? 0;
  }, [timers]);

  const resetForm = () => {
    setFormLabel('');
    setFormMinutes(5);
    setFormSeconds(0);
    setFormSeverity('warning');
    setFormScenarioId('');
    setFormVisible(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipId || !formLabel.trim()) return;

    const durationSeconds = formMinutes * 60 + formSeconds;
    if (durationSeconds <= 0) return;

    createTimer.mutate(
      {
        ship_id: shipId,
        label: formLabel.trim(),
        duration_seconds: durationSeconds,
        severity: formSeverity,
        scenario_id: formScenarioId || undefined,
        visible: formVisible,
      },
      {
        onSuccess: () => {
          setIsFormOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteTimer.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const handlePause = (id: string) => {
    pauseTimer.mutate(id);
  };

  const handleResume = (id: string) => {
    resumeTimer.mutate(id);
  };

  const handleTrigger = (id: string) => {
    triggerTimer.mutate(id);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="admin-page">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Countdown Timers</h2>
        <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
          + New Timer
        </button>
      </div>

      <div className="admin-filter-bar">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({timers?.length ?? 0})
        </button>
        <button
          className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active ({activeCount})
        </button>
        <button
          className={`filter-tab ${filter === 'expired' ? 'active' : ''}`}
          onClick={() => setFilter('expired')}
        >
          Expired ({expiredCount})
        </button>
      </div>

      {/* Create Timer Form */}
      {isFormOpen && (
        <div className="admin-form-section">
          <h3>Create Timer</h3>
          <form onSubmit={handleCreate} className="admin-form">
            <div className="form-row">
              <label className="form-label">
                Label
                <input
                  type="text"
                  className="form-input"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  placeholder="Self-Destruct Sequence"
                  required
                  autoFocus
                />
              </label>
            </div>

            <div className="form-row">
              <label className="form-label">
                Duration
                <div className="duration-inputs">
                  <input
                    type="number"
                    className="form-input form-input-small"
                    value={formMinutes}
                    onChange={e => setFormMinutes(parseInt(e.target.value) || 0)}
                    min={0}
                    max={999}
                  />
                  <span className="duration-unit">min</span>
                  <input
                    type="number"
                    className="form-input form-input-small"
                    value={formSeconds}
                    onChange={e => setFormSeconds(parseInt(e.target.value) || 0)}
                    min={0}
                    max={59}
                  />
                  <span className="duration-unit">sec</span>
                </div>
              </label>
            </div>

            <div className="form-row">
              <label className="form-label">
                Severity
                <select
                  className="form-select"
                  value={formSeverity}
                  onChange={e => setFormSeverity(e.target.value as EventSeverity)}
                >
                  {SEVERITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label className="form-label">
                On Expire (Optional)
                <select
                  className="form-select"
                  value={formScenarioId}
                  onChange={e => setFormScenarioId(e.target.value)}
                >
                  <option value="">No action</option>
                  {scenarios?.map(scenario => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row form-row-checkbox">
              <label className="form-label-inline">
                <input
                  type="checkbox"
                  checked={formVisible}
                  onChange={e => setFormVisible(e.target.checked)}
                />
                Visible to players
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={createTimer.isPending}>
                {createTimer.isPending ? 'Creating...' : 'Create Timer'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="admin-loading">Loading timers...</div>
      ) : filteredTimers.length === 0 ? (
        <div className="admin-empty">
          <p>No timers found</p>
          <button className="btn" onClick={() => setIsFormOpen(true)}>
            Create First Timer
          </button>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Remaining</th>
                <th>Severity</th>
                <th>On Expire</th>
                <th>Visible</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTimers.map(timer => {
                const expired = isExpired(timer);
                const paused = !!timer.paused_at;
                return (
                  <tr key={timer.id} className={expired ? 'row-muted' : paused ? 'row-paused' : ''}>
                    <td className="timer-label-cell">
                      <span className="timer-label-text">{timer.label}</span>
                    </td>
                    <td>
                      <span className={`timer-remaining ${expired ? 'expired' : ''} ${paused ? 'paused' : ''}`}>
                        {expired ? 'Expired' : formatTimerTime(timer)}
                        {paused && !expired && ' (Paused)'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${SEVERITY_CLASS[timer.severity]}`}>
                        {SEVERITY_DISPLAY[timer.severity]}
                      </span>
                    </td>
                    <td>
                      {timer.scenario_id
                        ? scenarios?.find(s => s.id === timer.scenario_id)?.name || timer.scenario_id
                        : '-'}
                    </td>
                    <td>
                      <span className={timer.visible ? 'visible-yes' : 'visible-no'}>
                        {timer.visible ? 'Yes' : 'Hidden'}
                      </span>
                    </td>
                    <td className="time-cell">{formatTime(timer.created_at)}</td>
                    <td>
                      <div className="action-buttons">
                        {!expired && (
                          <>
                            {paused ? (
                              <button
                                className="btn btn-small btn-success"
                                onClick={() => handleResume(timer.id)}
                                disabled={resumeTimer.isPending}
                                title="Resume timer"
                              >
                                Resume
                              </button>
                            ) : (
                              <button
                                className="btn btn-small"
                                onClick={() => handlePause(timer.id)}
                                disabled={pauseTimer.isPending}
                                title="Pause timer"
                              >
                                Pause
                              </button>
                            )}
                            {timer.scenario_id && (
                              <button
                                className="btn btn-small btn-warning"
                                onClick={() => handleTrigger(timer.id)}
                                disabled={triggerTimer.isPending}
                                title="Trigger now (execute scenario)"
                              >
                                Trigger
                              </button>
                            )}
                          </>
                        )}
                        {deleteConfirmId === timer.id ? (
                          <>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => handleDelete(timer.id)}
                              disabled={deleteTimer.isPending}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => setDeleteConfirmId(timer.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
