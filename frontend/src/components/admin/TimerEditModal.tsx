import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Timer, EventSeverity, TimerDirection, TimerDisplayPreset } from '../../types';
import { useScenarios } from '../../hooks/useShipData';
import { useCreateTimer, useUpdateTimer } from '../../hooks/useMutations';
import { useModalA11y } from '../../hooks/useModalA11y';

// ─── Constants ───────────────────────────────────────────────────────

const SEVERITY_OPTIONS: { value: EventSeverity; label: string; hint: string }[] = [
  { value: 'info', label: 'Normal', hint: 'Cyan glow' },
  { value: 'warning', label: 'Urgent', hint: 'Amber glow' },
  { value: 'critical', label: 'Emergency', hint: 'Red pulse' },
];

type TimerVisibility = 'players' | 'gm_only';

const VISIBILITY_OPTIONS: { value: TimerVisibility; label: string; hint: string }[] = [
  { value: 'players', label: 'Show to Players', hint: 'Visible on player panels' },
  { value: 'gm_only', label: 'GM Only', hint: 'Only visible to GM' },
];

const DISPLAY_PRESET_OPTIONS: { value: TimerDisplayPreset; label: string }[] = [
  { value: 'full', label: 'Full (Title + Time)' },
  { value: 'time_only', label: 'Time Only (Suspense)' },
  { value: 'title_only', label: 'Title Only (Narrative)' },
];

// ─── Component ───────────────────────────────────────────────────────

export interface TimerEditModalProps {
  timer?: Timer;
  shipId: string;
  onClose: () => void;
  onTimerCreated?: (timerId: string) => void;
}

export function TimerEditModal({ timer, shipId, onClose, onTimerCreated }: TimerEditModalProps) {
  const modalRef = useModalA11y(onClose);
  const { data: scenarios } = useScenarios(shipId);
  const createTimer = useCreateTimer();
  const updateTimer = useUpdateTimer();

  const isEdit = !!timer;

  // Form state
  const [label, setLabel] = useState(timer?.label ?? '');
  const [direction, setDirection] = useState<TimerDirection>(timer?.direction ?? 'countdown');
  const [minutes, setMinutes] = useState(() => {
    // Use stored duration_seconds if available, otherwise calculate from end_time
    if (timer?.duration_seconds) {
      return Math.floor(timer.duration_seconds / 60);
    }
    if (timer?.end_time && timer.created_at) {
      const duration = new Date(timer.end_time).getTime() - new Date(timer.created_at).getTime();
      return Math.floor(duration / 60000);
    }
    return 5;
  });
  const [seconds, setSeconds] = useState(() => {
    // Use stored duration_seconds if available, otherwise calculate from end_time
    if (timer?.duration_seconds) {
      return timer.duration_seconds % 60;
    }
    if (timer?.end_time && timer.created_at) {
      const duration = new Date(timer.end_time).getTime() - new Date(timer.created_at).getTime();
      return Math.floor((duration % 60000) / 1000);
    }
    return 0;
  });
  const [severity, setSeverity] = useState<EventSeverity>(timer?.severity ?? 'warning');
  const [displayPreset, setDisplayPreset] = useState<TimerDisplayPreset>(timer?.display_preset ?? 'full');
  const [visibility, setVisibility] = useState<TimerVisibility>(() => {
    if (timer) {
      return timer.gm_only ? 'gm_only' : 'players';
    }
    return 'players';
  });
  const [scenarioId, setScenarioId] = useState(timer?.scenario_id ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    // Convert visibility to visible/gm_only flags
    const visible = true; // Always visible now
    const gm_only = visibility === 'gm_only';
    const durationSeconds = minutes * 60 + seconds;

    // Validate countdown duration
    if (direction === 'countdown' && durationSeconds <= 0) return;

    if (isEdit && timer) {
      // Update existing timer - send all editable fields
      updateTimer.mutate(
        {
          id: timer.id,
          data: {
            label: label.trim(),
            direction,
            duration_seconds: direction === 'countdown' ? durationSeconds : undefined,
            severity,
            display_preset: displayPreset,
            visible,
            gm_only,
            scenario_id: direction === 'countdown' && scenarioId ? scenarioId : undefined,
          },
        },
        { onSuccess: onClose }
      );
    } else {
      // Create new timer
      createTimer.mutate(
        {
          ship_id: shipId,
          label: label.trim(),
          direction,
          duration_seconds: direction === 'countdown' ? durationSeconds : undefined,
          severity,
          display_preset: displayPreset,
          visible,
          gm_only,
          scenario_id: direction === 'countdown' && scenarioId ? scenarioId : undefined,
        },
        {
          onSuccess: (newTimer) => {
            onTimerCreated?.(newTimer.id);
            onClose();
          },
        }
      );
    }
  };

  const isPending = createTimer.isPending || updateTimer.isPending;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal-content"
        style={{ maxWidth: '420px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Timer' : 'Add Timer'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="config-section">
              <label className="configure-label">Label</label>
              <input
                type="text"
                className="config-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Self-Destruct Sequence"
                autoFocus
              />
            </div>

            <div className="config-section">
              <label className="configure-label">Type</label>
              <div className="timer-direction-toggle">
                <button
                  type="button"
                  className={`timer-direction-btn ${direction === 'countdown' ? 'timer-direction-btn--active' : ''}`}
                  onClick={() => setDirection('countdown')}
                >
                  Countdown
                </button>
                <button
                  type="button"
                  className={`timer-direction-btn ${direction === 'countup' ? 'timer-direction-btn--active' : ''}`}
                  onClick={() => setDirection('countup')}
                >
                  Stopwatch
                </button>
              </div>
            </div>

            {direction === 'countdown' && (
              <div className="config-section">
                <label className="configure-label">Duration</label>
                <div className="timer-duration-inputs">
                  <input
                    type="number"
                    className="config-input timer-duration-input"
                    value={minutes}
                    onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                    min={0}
                    max={999}
                  />
                  <span className="timer-duration-unit">min</span>
                  <input
                    type="number"
                    className="config-input timer-duration-input"
                    value={seconds}
                    onChange={(e) => setSeconds(parseInt(e.target.value) || 0)}
                    min={0}
                    max={59}
                  />
                  <span className="timer-duration-unit">sec</span>
                </div>
              </div>
            )}

            <div className="config-section">
              <label className="configure-label">Visibility</label>
              <select
                className="config-input"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as TimerVisibility)}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="config-hint">
                {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}
              </span>
            </div>

            <div className="config-section">
              <label className="configure-label">Style</label>
              <select
                className="config-input"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as EventSeverity)}
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} - {opt.hint}
                  </option>
                ))}
              </select>
            </div>

            {visibility === 'players' && (
              <div className="config-section">
                <label className="configure-label">Player Display</label>
                <select
                  className="config-input"
                  value={displayPreset}
                  onChange={(e) => setDisplayPreset(e.target.value as TimerDisplayPreset)}
                >
                  {DISPLAY_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {direction === 'countdown' && scenarios && scenarios.length > 0 && (
              <div className="config-section">
                <label className="configure-label">Trigger Scenario (On Expire)</label>
                <select
                  className="config-input"
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
                >
                  <option value="">No action</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!label.trim() || isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save' : 'Add Timer'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
