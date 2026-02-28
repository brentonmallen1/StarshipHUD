import { useState, useEffect, useRef } from 'react';
import type { WidgetRendererProps, Timer, EventSeverity } from '../../types';
import { useTimers, useTimer } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import './CountdownTimerWidget.css';

interface TimerConfig {
  timer_id?: string;      // Specific timer to display
  show_label?: boolean;   // Show timer label (default: true)
  compact?: boolean;      // Smaller display mode
  show_all?: boolean;     // Show all visible timers (overrides timer_id)
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

interface SingleTimerProps {
  timer: Timer;
  compact?: boolean;
  showLabel?: boolean;
}

function SingleTimer({ timer, compact = false, showLabel = true }: SingleTimerProps) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (timer.paused_at) {
      // Timer is paused - show frozen time
      const endTime = new Date(timer.end_time).getTime();
      const pausedTime = new Date(timer.paused_at).getTime();
      setRemainingMs(Math.max(0, endTime - pausedTime));
      setIsExpired(false);
      return;
    }

    const endTime = new Date(timer.end_time).getTime();

    const updateRemaining = () => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        setRemainingMs(0);
        setIsExpired(true);
        return;
      }

      setRemainingMs(remaining);
      setIsExpired(false);
      animFrameRef.current = requestAnimationFrame(updateRemaining);
    };

    updateRemaining();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [timer.end_time, timer.paused_at]);

  const severityClass = getSeverityClass(timer.severity);
  const isPulsing = !timer.paused_at && !isExpired && shouldPulse(remainingMs);
  const showHours = remainingMs >= 3600000; // Show hours format if >= 1 hour

  return (
    <div
      className={`countdown-timer ${severityClass} ${compact ? 'compact' : ''} ${isPulsing ? 'pulsing' : ''} ${timer.paused_at ? 'paused' : ''} ${isExpired ? 'expired' : ''}`}
    >
      {showLabel && <div className="timer-label">{timer.label}</div>}
      <div className="timer-display">
        <span className="timer-digits">{formatTimeRemaining(remainingMs, showHours)}</span>
        {timer.paused_at && <span className="timer-paused-indicator">PAUSED</span>}
        {isExpired && <span className="timer-expired-indicator">EXPIRED</span>}
      </div>
      {/* Progress bar showing time remaining */}
      {timer.created_at && !isExpired && (
        <div className="timer-progress">
          <div
            className="timer-progress-fill"
            style={{
              width: `${Math.max(0, Math.min(100, (remainingMs / (new Date(timer.end_time).getTime() - new Date(timer.created_at).getTime())) * 100))}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CountdownTimerWidget({ instance, isEditing }: WidgetRendererProps) {
  const shipId = useCurrentShipId();
  const config = (instance.config || {}) as TimerConfig;
  const timerId = instance.bindings?.timer_id as string | undefined ?? config.timer_id;
  const showAll = config.show_all ?? false;
  const showLabel = config.show_label ?? true;
  const compact = config.compact ?? false;

  // Fetch single timer or all visible timers
  const { data: singleTimer } = useTimer(timerId || '');
  const { data: allTimers } = useTimers(shipId ?? undefined, true); // visibleOnly=true

  // Determine which timers to show
  const timersToShow: Timer[] = showAll
    ? (allTimers || []).filter((t: Timer) => t.visible)
    : singleTimer
      ? [singleTimer]
      : [];

  if (isEditing) {
    return (
      <div className="countdown-timer-widget editing">
        <div className="widget-placeholder">
          <div className="placeholder-icon">COUNTDOWN</div>
          <div className="placeholder-text">
            {timerId ? `Timer: ${timerId}` : showAll ? 'All Visible Timers' : 'No timer bound'}
          </div>
        </div>
      </div>
    );
  }

  if (timersToShow.length === 0) {
    // No timers to show - render minimal placeholder
    return (
      <div className="countdown-timer-widget empty">
        <div className="no-timers">
          {showAll ? 'No active timers' : 'Timer not found'}
        </div>
      </div>
    );
  }

  return (
    <div className={`countdown-timer-widget ${showAll ? 'multi' : 'single'}`}>
      {timersToShow.map(timer => (
        <SingleTimer
          key={timer.id}
          timer={timer}
          compact={compact}
          showLabel={showLabel}
        />
      ))}
    </div>
  );
}
