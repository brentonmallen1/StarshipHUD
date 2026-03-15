import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetRendererProps, Timer, EventSeverity } from '../../types';
import { useTimers, useTimer } from '../../hooks/useShipData';
import { useDeleteTimer, usePauseTimer, useResumeTimer, useTriggerTimer, useResetTimer } from '../../hooks/useMutations';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import { TimerEditModal } from '../admin/TimerEditModal';
import './CountdownTimerWidget.css';
import './WidgetCreationModal.css';

interface TimerConfig {
  timer_id?: string;      // Specific timer to display (legacy, single timer)
  timer_ids?: string[];   // List of timer IDs to show (if set, filters to these)
  show_label?: boolean;   // Show timer label (default: true)
  compact?: boolean;      // Smaller display mode
}

/**
 * Format remaining milliseconds as HH:MM:SS or MM:SS
 */
function formatTimeRemaining(ms: number, showHours = false): string {
  if (ms <= 0) return '00:00';

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0 || showHours) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format elapsed milliseconds as +HH:MM:SS or +MM:SS
 */
function formatTimeElapsed(ms: number, showHours = false): string {
  if (ms < 0) return '+00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0 || showHours) {
    return `+${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `+${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get severity-based CSS class for timer styling
 */
function getSeverityClass(severity: EventSeverity): string {
  switch (severity) {
    case 'critical':
      return 'timer-critical';
    case 'warning':
      return 'timer-warning';
    case 'info':
      return 'timer-info';
    default:
      return 'timer-info';
  }
}

/**
 * Calculate if timer should pulse (last 30 seconds or under 10%)
 */
function shouldPulse(remainingMs: number, totalDurationMs?: number): boolean {
  // Always pulse in last 30 seconds
  if (remainingMs <= 30000) return true;
  // Pulse when under 10% remaining (if we know total duration)
  if (totalDurationMs && remainingMs / totalDurationMs < 0.1) return true;
  return false;
}

// ─── Timer Selector Modal ────────────────────────────────────────────

interface TimerSelectorModalProps {
  shipId: string;
  existingIds: string[];
  onAdd: (timerId: string) => void;
  onClose: () => void;
}

function TimerSelectorModal({ shipId, existingIds, onAdd, onClose }: TimerSelectorModalProps) {
  const modalRef = useModalA11y(onClose);
  const { data: allTimers } = useTimers(shipId);

  // Filter to timers not already in the widget
  const availableTimers = (allTimers ?? []).filter(t => !existingIds.includes(t.id));

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal-content"
        style={{ maxWidth: '400px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Add Existing Timer</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {availableTimers.length === 0 ? (
            <div className="timer-selector-empty">
              <p>No other timers available to add.</p>
              <p className="timer-selector-hint">Create new timers from the Comms & Timers admin page.</p>
            </div>
          ) : (
            <div className="timer-selector-list">
              {availableTimers.map((timer) => (
                <button
                  key={timer.id}
                  type="button"
                  className={`timer-selector-item timer-${timer.severity}`}
                  onClick={() => {
                    onAdd(timer.id);
                    onClose();
                  }}
                >
                  <span className="timer-selector-label">{timer.label}</span>
                  <span className="timer-selector-type">
                    {timer.direction === 'countup' ? 'Stopwatch' : 'Countdown'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Single Timer Display ───────────────────────────────────────────

interface SingleTimerProps {
  timer: Timer;
  compact?: boolean;
  showLabel?: boolean;
  canEditData?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onRemoveFromWidget?: () => void;  // Remove from widget config (doesn't delete timer)
}

function SingleTimer({ timer, compact = false, showLabel = true, canEditData, onEdit, onDelete, onRemoveFromWidget }: SingleTimerProps) {
  const [timeMs, setTimeMs] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const pauseTimer = usePauseTimer();
  const resumeTimer = useResumeTimer();
  const triggerTimer = useTriggerTimer();
  const resetTimer = useResetTimer();

  const isCountdown = timer.direction === 'countdown';
  const isCountup = timer.direction === 'countup';

  useEffect(() => {
    // Countup timer logic
    if (isCountup && timer.start_time) {
      if (timer.paused_at) {
        const start = new Date(timer.start_time).getTime();
        const pausedTime = new Date(timer.paused_at).getTime();
        setTimeMs(pausedTime - start);
        return;
      }

      const startTime = new Date(timer.start_time).getTime();

      const updateElapsed = () => {
        const now = Date.now();
        setTimeMs(now - startTime);
        animFrameRef.current = requestAnimationFrame(updateElapsed);
      };

      updateElapsed();

      return () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }

    // Countdown timer logic
    if (!timer.end_time) {
      setTimeMs(0);
      setIsExpired(false);
      return;
    }

    if (timer.paused_at) {
      const endTime = new Date(timer.end_time).getTime();
      const pausedTime = new Date(timer.paused_at).getTime();
      setTimeMs(Math.max(0, endTime - pausedTime));
      setIsExpired(false);
      return;
    }

    const endTime = new Date(timer.end_time).getTime();

    const updateRemaining = () => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeMs(0);
        setIsExpired(true);
        return;
      }

      setTimeMs(remaining);
      setIsExpired(false);
      animFrameRef.current = requestAnimationFrame(updateRemaining);
    };

    updateRemaining();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [timer.end_time, timer.start_time, timer.paused_at, isCountup]);

  const severityClass = getSeverityClass(timer.severity);
  const isPulsing = isCountdown && !timer.paused_at && !isExpired && shouldPulse(timeMs);
  const showHours = timeMs >= 3600000;

  const timeDisplay = isCountup
    ? formatTimeElapsed(timeMs, showHours)
    : formatTimeRemaining(timeMs, showHours);

  // Respect display_preset
  const displayLabel = timer.display_preset !== 'time_only';
  const displayTime = timer.display_preset !== 'title_only';

  const handlePauseResume = () => {
    if (timer.paused_at) {
      resumeTimer.mutate(timer.id);
    } else {
      pauseTimer.mutate(timer.id);
    }
  };

  const handleTrigger = () => {
    if (confirm(`Trigger "${timer.label}" now?`)) {
      triggerTimer.mutate(timer.id);
    }
  };

  // Visibility indicator - only show lock for GM-only timers
  const visibilityIcon = timer.gm_only ? '🔒' : '👁️';
  const visibilityTitle = timer.gm_only ? 'GM Only' : 'Visible to Players';

  // Determine if timer has actually run (for PAUSED indicator)
  // Don't show PAUSED if timer is at starting position (hasn't been started yet)
  const hasTimerRun = (() => {
    if (isCountup) {
      // Countup: has run if elapsed time > 0
      return timeMs > 0;
    } else {
      // Countdown: has run if remaining time < original duration
      if (timer.end_time && timer.created_at) {
        const originalDuration = new Date(timer.end_time).getTime() - new Date(timer.created_at).getTime();
        return timeMs < originalDuration;
      }
      return false;
    }
  })();

  const showPausedIndicator = timer.paused_at && hasTimerRun && !isExpired;

  return (
    <div
      className={`countdown-timer ${severityClass} ${compact ? 'compact' : ''} ${isPulsing ? 'pulsing' : ''} ${timer.paused_at ? 'paused' : ''} ${isExpired ? 'expired' : ''} ${isCountup ? 'countup' : ''}`}
    >
      {/* Visibility indicator */}
      {visibilityIcon && (
        <span className="timer-visibility-indicator" title={visibilityTitle}>
          {visibilityIcon}
        </span>
      )}

      <div className="timer-content">
        {showLabel && displayLabel && <div className="timer-label">{timer.label}</div>}
        {displayTime && (
          <div className="timer-display">
            <span className="timer-digits">{timeDisplay}</span>
            {showPausedIndicator && <span className="timer-paused-indicator">PAUSED</span>}
            {isExpired && <span className="timer-expired-indicator">EXPIRED</span>}
          </div>
        )}
        {/* Progress bar showing time remaining (countdown only) */}
        {isCountdown && timer.end_time && timer.created_at && !isExpired && displayTime && (
          <div className="timer-progress">
            <div
              className="timer-progress-fill"
              style={{
                width: `${Math.max(0, Math.min(100, (timeMs / (new Date(timer.end_time).getTime() - new Date(timer.created_at).getTime())) * 100))}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Inline controls when canEditData */}
      {canEditData && (
        <div className="timer-inline-actions">
          <button
            type="button"
            className="timer-inline-btn"
            onClick={handlePauseResume}
            title={timer.paused_at ? 'Resume' : 'Pause'}
            disabled={isExpired}
          >
            {timer.paused_at ? '▶' : '⏸'}
          </button>
          <button
            type="button"
            className="timer-inline-btn timer-inline-btn--reset"
            onClick={() => resetTimer.mutate(timer.id)}
            title="Reset"
          >
            ↺
          </button>
          {isCountdown && timer.scenario_id && (
            <button
              type="button"
              className="timer-inline-btn timer-inline-btn--trigger"
              onClick={handleTrigger}
              title="Trigger Now"
              disabled={isExpired}
            >
              ⚡
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className="timer-inline-btn"
              onClick={onEdit}
              title="Edit"
            >
              ✎
            </button>
          )}
          {onRemoveFromWidget && (
            <button
              type="button"
              className="timer-inline-btn timer-inline-btn--remove"
              onClick={onRemoveFromWidget}
              title="Remove from widget"
            >
              ⊖
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="timer-inline-btn timer-inline-btn--delete"
              onClick={onDelete}
              title="Delete"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Widget Component ──────────────────────────────────────────

export function CountdownTimerWidget({ instance, isEditing, canEditData, onConfigChange }: WidgetRendererProps) {
  const shipId = useCurrentShipId();
  const config = (instance.config || {}) as TimerConfig;
  const timerId = instance.bindings?.timer_id as string | undefined ?? config.timer_id;
  const timerIds = config.timer_ids;
  const showLabel = config.show_label ?? true;
  const compact = config.compact ?? false;

  // Container dimensions for responsive layout
  const { containerRef, width, ready } = useContainerDimensions();
  const isCompact = ready && width < 200;

  // Modal state
  const [isAddingTimer, setIsAddingTimer] = useState(false);
  const [isSelectingTimer, setIsSelectingTimer] = useState(false);
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch all timers for this ship (no filtering - GM sees everything)
  const { data: singleTimer } = useTimer(timerId || '');
  const { data: allTimers } = useTimers(shipId ?? undefined);
  const deleteTimer = useDeleteTimer();

  // Determine which timers to show:
  // 1. If a specific timer_id is bound (legacy), show only that timer
  // 2. If timer_ids array is set, filter to those timers
  // 3. Otherwise, show ALL timers for the ship (GM sees everything)
  const timersToShow: Timer[] = (() => {
    if (timerId && singleTimer) {
      return [singleTimer];
    }
    if (timerIds && timerIds.length > 0 && allTimers) {
      return allTimers.filter(t => timerIds.includes(t.id));
    }
    return allTimers || [];
  })();

  // Handler for adding existing timer to widget config
  const handleAddExistingTimer = useCallback((addTimerId: string) => {
    const currentIds = timerIds ?? [];
    onConfigChange?.({
      ...instance.config,
      timer_ids: [...currentIds, addTimerId],
    });
  }, [timerIds, onConfigChange, instance.config]);

  // Handler for removing timer from widget (not deleting the timer itself)
  const handleRemoveFromWidget = useCallback((removeTimerId: string) => {
    // If timer_ids isn't set yet (showing all timers), initialize it with all timer IDs except the removed one
    const currentIds = timerIds ?? (allTimers?.map(t => t.id) ?? []);
    onConfigChange?.({
      ...instance.config,
      timer_ids: currentIds.filter(id => id !== removeTimerId),
    });
  }, [timerIds, allTimers, onConfigChange, instance.config]);

  const handleDelete = useCallback((id: string) => {
    deleteTimer.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  }, [deleteTimer]);

  // Determine layout class
  const layoutClass = isCompact ? 'countdown-timer-widget--compact' : 'countdown-timer-widget--grid';

  if (isEditing) {
    return (
      <div ref={containerRef} className="countdown-timer-widget editing">
        <div className="widget-placeholder">
          <div className="placeholder-icon">TIMERS</div>
          <div className="placeholder-text">
            {timerId ? `Timer: ${timerId}` : 'All Timers'}
          </div>
        </div>
      </div>
    );
  }

  if (timersToShow.length === 0) {
    return (
      <div ref={containerRef} className={`countdown-timer-widget empty ${layoutClass}`}>
        <div className="no-timers">
          <p>No timers yet</p>
          {canEditData && shipId && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddingTimer(true)}
            >
              + Add Timer
            </button>
          )}
        </div>

        {/* Add Timer Modal */}
        {isAddingTimer && shipId && (
          <TimerEditModal
            shipId={shipId}
            onClose={() => setIsAddingTimer(false)}
            onTimerCreated={handleAddExistingTimer}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`countdown-timer-widget ${layoutClass} ${timersToShow.length > 1 ? 'multi' : 'single'}`}>
      <div className="timer-list">
        {timersToShow.map(timer => (
          <div key={timer.id} className="timer-item-wrapper">
            {deleteConfirmId === timer.id ? (
              <div className="timer-delete-confirm">
                <span>Delete "{timer.label}"?</span>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => handleDelete(timer.id)}
                  disabled={deleteTimer.isPending}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setDeleteConfirmId(null)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <SingleTimer
                timer={timer}
                compact={compact}
                showLabel={showLabel}
                canEditData={canEditData}
                onEdit={() => setEditingTimer(timer)}
                onRemoveFromWidget={() => handleRemoveFromWidget(timer.id)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add timer buttons */}
      {canEditData && shipId && (
        <div className="timer-add-buttons">
          <button
            type="button"
            className="timer-add-btn"
            onClick={() => setIsAddingTimer(true)}
          >
            + New Timer
          </button>
          <button
            type="button"
            className="timer-add-btn timer-add-btn--secondary"
            onClick={() => setIsSelectingTimer(true)}
          >
            + Add Existing
          </button>
        </div>
      )}

      {/* Modals */}
      {isAddingTimer && shipId && (
        <TimerEditModal
          shipId={shipId}
          onClose={() => setIsAddingTimer(false)}
          onTimerCreated={handleAddExistingTimer}
        />
      )}

      {isSelectingTimer && shipId && (
        <TimerSelectorModal
          shipId={shipId}
          existingIds={timerIds ?? []}
          onAdd={handleAddExistingTimer}
          onClose={() => setIsSelectingTimer(false)}
        />
      )}

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
