import { useState, useEffect, useRef } from 'react';
import { useTimers } from '../../hooks/useShipData';
import { usePauseTimer, useResumeTimer, useTriggerTimer } from '../../hooks/mutations/useTimerMutations';
import type { Timer } from '../../types';
import './GmTimerFloating.css';

const STORAGE_KEY = 'gm-timer-floating-collapsed';

/**
 * Format remaining time for countdown timers
 */
function formatRemaining(endTime: string, pausedAt?: string | null): string {
  const end = new Date(endTime).getTime();
  const now = pausedAt ? new Date(pausedAt).getTime() : Date.now();
  const remaining = end - now;

  if (remaining <= 0) return '00:00';

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format elapsed time for countup timers
 */
function formatElapsed(startTime: string, pausedAt?: string | null): string {
  const start = new Date(startTime).getTime();
  const now = pausedAt ? new Date(pausedAt).getTime() : Date.now();
  const elapsed = now - start;

  if (elapsed < 0) return '+00:00';

  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `+${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `+${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface TimerRowProps {
  timer: Timer;
}

function TimerRow({ timer }: TimerRowProps) {
  const [, setTick] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const pauseTimer = usePauseTimer();
  const resumeTimer = useResumeTimer();
  const triggerTimer = useTriggerTimer();

  // Update every second
  useEffect(() => {
    if (timer.paused_at) return;

    intervalRef.current = window.setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer.paused_at]);

  const isCountdown = timer.direction === 'countdown';
  const timeStr = isCountdown && timer.end_time
    ? formatRemaining(timer.end_time, timer.paused_at)
    : timer.start_time
      ? formatElapsed(timer.start_time, timer.paused_at)
      : '--:--';

  const isExpired = !!(isCountdown && timer.end_time && !timer.paused_at
    && new Date(timer.end_time).getTime() <= Date.now());

  const isPaused = !!timer.paused_at;

  const handlePauseResume = () => {
    if (isPaused) {
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

  return (
    <div className={`gm-timer-row timer-${timer.severity} ${isPaused ? 'paused' : ''} ${isExpired ? 'expired' : ''}`}>
      <div className="gm-timer-info">
        <span className="gm-timer-label">{timer.label}</span>
        <span className="gm-timer-time">{timeStr}</span>
      </div>
      <div className="gm-timer-actions">
        <button
          className="gm-timer-btn"
          onClick={handlePauseResume}
          title={isPaused ? 'Resume' : 'Pause'}
          disabled={isExpired}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
        {isCountdown && (
          <button
            className="gm-timer-btn trigger"
            onClick={handleTrigger}
            title="Trigger Now"
            disabled={isExpired}
          >
            ⚡
          </button>
        )}
      </div>
    </div>
  );
}

export function GmTimerFloating() {
  const { data: timers } = useTimers(undefined, { gmOnly: true });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });
  const prevCountRef = useRef(0);

  // Filter to active timers
  const activeTimers = (timers ?? []).filter(timer => {
    if (timer.direction === 'countup') return true;
    if (!timer.end_time) return false;
    if (timer.paused_at) return true;
    return new Date(timer.end_time).getTime() > Date.now();
  });

  // Auto-expand when new timer is added
  useEffect(() => {
    if (activeTimers.length > prevCountRef.current && prevCountRef.current > 0) {
      setIsCollapsed(false);
    }
    prevCountRef.current = activeTimers.length;
  }, [activeTimers.length]);

  // Save collapsed state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Check if any timer is critical (for pulsing badge)
  const hasCritical = activeTimers.some(t => {
    if (t.severity === 'critical') return true;
    // Also pulse if countdown is < 30 seconds
    if (t.direction === 'countdown' && t.end_time && !t.paused_at) {
      const remaining = new Date(t.end_time).getTime() - Date.now();
      return remaining < 30000 && remaining > 0;
    }
    return false;
  });

  if (activeTimers.length === 0) {
    return null;
  }

  return (
    <div className={`gm-timer-floating ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <button
        className={`gm-timer-toggle ${hasCritical ? 'pulsing' : ''}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand timers' : 'Collapse timers'}
      >
        <span className="gm-timer-badge">{activeTimers.length}</span>
        <span className="gm-timer-icon">⏱</span>
      </button>

      {!isCollapsed && (
        <div className="gm-timer-list">
          <div className="gm-timer-header">
            <span>GM Timers</span>
            <button
              className="gm-timer-collapse-btn"
              onClick={() => setIsCollapsed(true)}
              title="Collapse"
            >
              ✕
            </button>
          </div>
          {activeTimers.map(timer => (
            <TimerRow key={timer.id} timer={timer} />
          ))}
        </div>
      )}
    </div>
  );
}
