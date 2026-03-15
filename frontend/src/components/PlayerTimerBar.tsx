import { useState, useEffect, useRef } from 'react';
import { useTimers } from '../hooks/useShipData';
import type { Timer } from '../types';
import './PlayerTimerBar.css';

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
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
  return `+${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Check if timer has actually run (advanced from starting position)
 * Used to determine if we should show "Paused" styling
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

interface TimerItemProps {
  timer: Timer;
}

function TimerItem({ timer }: TimerItemProps) {
  const [, setTick] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Update every second for countdown/countup
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

  // Check if countdown is expired
  const isExpired = isCountdown && timer.end_time && !timer.paused_at
    && new Date(timer.end_time).getTime() <= Date.now();

  // Severity-based styling
  const severityClass = `timer-${timer.severity}`;

  // Pulsing for critical or nearly expired countdown
  const isPulsing = timer.severity === 'critical' || (
    isCountdown && timer.end_time && !timer.paused_at && !isExpired &&
    (new Date(timer.end_time).getTime() - Date.now()) < 30000
  );

  const showTime = timer.display_preset !== 'title_only';
  const showTitle = timer.display_preset !== 'time_only';

  // Only show paused state if timer has actually run (not just created and sitting at start)
  const isPaused = !!timer.paused_at && hasTimerRun(timer);

  return (
    <div className={`player-timer-item ${severityClass} ${isPulsing ? 'pulsing' : ''} ${isPaused ? 'paused' : ''} ${isExpired ? 'expired' : ''}`}>
      {showTitle && <span className="player-timer-label">{timer.label}</span>}
      {showTime && <span className="player-timer-time">{timeStr}</span>}
    </div>
  );
}

export function PlayerTimerBar() {
  const { data: timers } = useTimers(undefined, { visibleOnly: true, gmOnly: false });
  const [isVisible, setIsVisible] = useState(false);

  // Filter to active timers (not expired countdown timers)
  const activeTimers = (timers ?? []).filter(timer => {
    if (timer.direction === 'countup') return true;
    if (!timer.end_time) return false;
    if (timer.paused_at) return true;
    return new Date(timer.end_time).getTime() > Date.now();
  });

  // Fade in/out animation
  useEffect(() => {
    if (activeTimers.length > 0) {
      setIsVisible(true);
    } else {
      // Delay hide for fade-out animation
      const timeout = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [activeTimers.length]);

  if (!isVisible && activeTimers.length === 0) {
    return null;
  }

  return (
    <div className={`player-timer-bar ${activeTimers.length > 0 ? 'visible' : 'hidden'}`}>
      {activeTimers.map(timer => (
        <TimerItem key={timer.id} timer={timer} />
      ))}
    </div>
  );
}
