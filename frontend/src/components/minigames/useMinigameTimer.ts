/**
 * Timer hook for minigame countdown
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface TimerState {
  timeRemaining: number;  // seconds
  elapsed: number;        // ms
  isRunning: boolean;
  isExpired: boolean;
}

interface TimerControls {
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useMinigameTimer(
  initialTime: number,
  onExpire?: () => void
): [TimerState, TimerControls] {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);
  const onExpireRef = useRef(onExpire);

  // Keep callback ref updated
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Timer tick effect
  useEffect(() => {
    if (!isRunning || isExpired) return;

    const interval = setInterval(() => {
      if (startTimeRef.current === null) return;

      const now = Date.now();
      const totalElapsed = pausedElapsedRef.current + (now - startTimeRef.current);
      const remaining = Math.max(0, initialTime - Math.floor(totalElapsed / 1000));

      setElapsed(totalElapsed);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        setIsExpired(true);
        setIsRunning(false);
        onExpireRef.current?.();
      }
    }, 100); // Update every 100ms for smooth countdown

    return () => clearInterval(interval);
  }, [isRunning, isExpired, initialTime]);

  const start = useCallback(() => {
    if (isExpired) return;
    startTimeRef.current = Date.now();
    pausedElapsedRef.current = 0;
    setIsRunning(true);
  }, [isExpired]);

  const pause = useCallback(() => {
    if (!isRunning || startTimeRef.current === null) return;
    pausedElapsedRef.current += Date.now() - startTimeRef.current;
    startTimeRef.current = null;
    setIsRunning(false);
  }, [isRunning]);

  const resume = useCallback(() => {
    if (isRunning || isExpired) return;
    startTimeRef.current = Date.now();
    setIsRunning(true);
  }, [isRunning, isExpired]);

  const reset = useCallback(() => {
    startTimeRef.current = null;
    pausedElapsedRef.current = 0;
    setTimeRemaining(initialTime);
    setElapsed(0);
    setIsRunning(false);
    setIsExpired(false);
  }, [initialTime]);

  return [
    { timeRemaining, elapsed, isRunning, isExpired },
    { start, pause, resume, reset },
  ];
}

/**
 * Format seconds to MM:SS display
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
