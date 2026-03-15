import { useState, useMemo, useEffect } from 'react';
import { useTimers, useScenarios } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useDeleteTimer, usePauseTimer, useResumeTimer, useTriggerTimer, useResetTimer } from '../../hooks/useMutations';
import { TimerEditModal } from '../../components/admin/TimerEditModal';
import type { Timer, EventSeverity, Scenario } from '../../types';
import './Admin.css';

type TimerFilter = 'all' | 'active' | 'expired' | 'gm_only' | 'player';

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

/**
 * Check if timer has actually run (advanced from starting position)
 * Used to determine if we should show "Paused" indicator
 */
function hasTimerRun(timer: Timer): boolean {
  if (timer.direction === 'countup') {
    // Countup: has run if elapsed time > 0
    if (!timer.start_time) return false;
    const now = timer.paused_at ? new Date(timer.paused_at).getTime() : Date.now();
    const elapsed = now - new Date(timer.start_time).getTime();
    return elapsed > 0;
  } else {
    // Countdown: has run if remaining time < original duration
    if (!timer.end_time || !timer.created_at) return false;
    const originalDuration = new Date(timer.end_time).getTime() - new Date(timer.created_at).getTime();
    const now = timer.paused_at ? new Date(timer.paused_at).getTime() : Date.now();
    const remaining = new Date(timer.end_time).getTime() - now;
    return remaining < originalDuration;
  }
}

export function AdminTimers() {
  const shipId = useCurrentShipId();
  const { data: timers, isLoading } = useTimers(shipId ?? undefined); // All timers
  const { data: scenarios } = useScenarios(shipId ?? undefined);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState<TimerFilter>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null);

  // Force re-render every second for countdown updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const deleteTimer = useDeleteTimer();
  const pauseTimer = usePauseTimer();
  const resumeTimer = useResumeTimer();
  const triggerTimer = useTriggerTimer();
  const resetTimer = useResetTimer();

  // Filter timers
  const filteredTimers = useMemo(() => {
    if (!timers) return [];
    return timers.filter(timer => {
      if (filter === 'active') return !isExpired(timer);
      if (filter === 'expired') return isExpired(timer);
      if (filter === 'gm_only') return timer.gm_only;
      if (filter === 'player') return !timer.gm_only;
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

  const gmOnlyCount = useMemo(() => {
    return timers?.filter(t => t.gm_only).length ?? 0;
  }, [timers]);

  const playerCount = useMemo(() => {
    return timers?.filter(t => !t.gm_only).length ?? 0;
  }, [timers]);

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

  const handleReset = (id: string) => {
    resetTimer.mutate(id);
  };

  return (
    <div className="admin-page">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Countdown Timers</h2>
        <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
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
        <span className="filter-separator">|</span>
        <button
          className={`filter-tab ${filter === 'player' ? 'active' : ''}`}
          onClick={() => setFilter('player')}
        >
          Player ({playerCount})
        </button>
        <button
          className={`filter-tab ${filter === 'gm_only' ? 'active' : ''}`}
          onClick={() => setFilter('gm_only')}
        >
          GM Only ({gmOnlyCount})
        </button>
      </div>

      {/* Create Timer Modal */}
      {isCreateModalOpen && shipId && (
        <TimerEditModal
          shipId={shipId}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {isLoading ? (
        <div className="admin-loading">Loading timers...</div>
      ) : filteredTimers.length === 0 ? (
        <div className="admin-empty">
          <p>No timers found</p>
          <button className="btn" onClick={() => setIsCreateModalOpen(true)}>
            Create First Timer
          </button>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                <th>Time</th>
                <th>Severity</th>
                <th>Display</th>
                <th>Visibility</th>
                <th>Scenario</th>
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
                      <span className={`badge ${timer.direction === 'countup' ? 'badge-countup' : 'badge-countdown'}`}>
                        {timer.direction === 'countup' ? 'Stopwatch' : 'Countdown'}
                      </span>
                    </td>
                    <td>
                      <span className={`timer-remaining ${expired ? 'expired' : ''} ${paused ? 'paused' : ''}`}>
                        {expired ? 'Expired' : formatTimerTime(timer)}
                        {paused && !expired && hasTimerRun(timer) && ' (Paused)'}
                      </span>
                    </td>
                    <td>
                      <span className={`${SEVERITY_CLASS[timer.severity]}`}>
                        {SEVERITY_DISPLAY[timer.severity]}
                      </span>
                    </td>
                    <td>
                      <span className="display-preset">
                        {timer.display_preset === 'full' ? 'Full' :
                          timer.display_preset === 'time_only' ? 'Time' : 'Title'}
                      </span>
                    </td>
                    <td>
                      <div className="visibility-badges">
                        {timer.gm_only
                          ? <span className="badge badge-gm">GM</span>
                          : <span className="badge badge-user">Players, GM</span>
                        }
                      </div>
                    </td>
                    <td>
                      {timer.scenario_id
                        ? scenarios?.find((s: Scenario) => s.id === timer.scenario_id)?.name || timer.scenario_id
                        : '-'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {/* Pause/Resume for active timers */}
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

                        {/* Reset - always available */}
                        <button
                          className="btn btn-small btn-success-secondary"
                          onClick={() => handleReset(timer.id)}
                          disabled={resetTimer.isPending}
                          title="Reset timer"
                        >
                          Reset
                        </button>

                        {/* Edit button - always available */}
                        <button
                          className="btn btn-small"
                          onClick={() => setEditingTimer(timer)}
                          title="Edit timer"
                        >
                          Edit
                        </button>

                        {/* Delete with confirmation */}
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

      {/* Edit Timer Modal */}
      {editingTimer && shipId && (
        <TimerEditModal
          timer={editingTimer}
          shipId={shipId}
          onClose={() => setEditingTimer(null)}
        />
      )}
    </div>
  );
}
