import { useState, useCallback, useEffect, useRef } from 'react';
import type { DecryptionResult } from '../../../../types';
import type { FrequencyScenario } from '../../types';
import { useMinigameTimer, formatTime } from '../../useMinigameTimer';
import './FrequencyHopper.css';

interface FrequencyHopperProps {
  scenario: FrequencyScenario;
  onProgress: (progress: number, chunks: string[]) => void;
  onComplete: (result: DecryptionResult) => void;
  onCancel: () => void;
}

interface ActiveBurst {
  channel: number;
  endTime: number;
  isDecoy: boolean;
}

export function FrequencyHopper({
  scenario,
  onProgress,
  onComplete,
  onCancel,
}: FrequencyHopperProps) {
  const [cursorChannel, setCursorChannel] = useState(Math.floor(scenario.channelCount / 2));
  const [totalLockTime, setTotalLockTime] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [activeBurst, setActiveBurst] = useState<ActiveBurst | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(Date.now());
  const gameLoopRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Refs for values that the game loop needs to read (avoid stale closures)
  const cursorChannelRef = useRef(cursorChannel);
  const isLockedRef = useRef(isLocked);
  const totalLockTimeRef = useRef(totalLockTime);

  // Sync refs when state changes
  useEffect(() => { cursorChannelRef.current = cursorChannel; }, [cursorChannel]);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);
  useEffect(() => { totalLockTimeRef.current = totalLockTime; }, [totalLockTime]);

  // Handle timeout
  const handleTimeout = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    const progress = totalLockTime / scenario.totalLockTimeRequired;
    const chunksRevealed = Math.floor(progress * scenario.plaintextChunks.length);
    const revealed = scenario.plaintextChunks.slice(0, chunksRevealed);

    onComplete({
      success: false,
      progress,
      revealed_chunks: revealed,
      mistakes: misses,
      time_ms: scenario.timeLimit * 1000,
      detection_risk: misses / 10,
      score: Math.round(progress * 400 + maxStreak * 10),
    });
  }, [totalLockTime, misses, maxStreak, scenario, onComplete]);

  // Timer
  const [timerState, timerControls] = useMinigameTimer(
    scenario.timeLimit,
    handleTimeout
  );
  const { timeRemaining } = timerState;
  const { start: startTimer, pause: pauseTimer } = timerControls;

  // Handle success
  const handleSuccess = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    pauseTimer();

    const timeTaken = Date.now() - startTimeRef.current;
    const baseScore = 1000;
    const timeBonus = Math.max(0, scenario.timeLimit * 1000 - timeTaken) / 50;
    const streakBonus = maxStreak * 20;
    const missPenalty = misses * 30;
    const score = Math.round(baseScore + timeBonus + streakBonus - missPenalty);

    onComplete({
      success: true,
      progress: 1,
      revealed_chunks: scenario.plaintextChunks,
      mistakes: misses,
      time_ms: timeTaken,
      detection_risk: Math.min(1, misses / 15),
      score: Math.max(100, score),
    });
  }, [misses, maxStreak, scenario, onComplete, pauseTimer]);

  // Check for win condition
  useEffect(() => {
    if (totalLockTime >= scenario.totalLockTimeRequired && !isComplete) {
      setIsComplete(true);
      handleSuccess();
    }
  }, [totalLockTime, scenario.totalLockTimeRequired, isComplete, handleSuccess]);

  // Update progress
  useEffect(() => {
    const progress = Math.min(1, totalLockTime / scenario.totalLockTimeRequired);
    const chunksRevealed = Math.floor(progress * scenario.plaintextChunks.length);
    const revealed = scenario.plaintextChunks.slice(0, chunksRevealed);
    onProgress(progress, revealed);
  }, [totalLockTime, scenario, onProgress]);

  // Game loop
  useEffect(() => {
    startTimer();
    lastTickRef.current = Date.now();

    const tick = () => {
      if (completedRef.current) return;

      const now = Date.now();
      const deltaMs = now - lastTickRef.current;
      lastTickRef.current = now;

      const elapsed = now - startTimeRef.current;
      setGameTime(elapsed);

      // Find current burst based on game time
      let currentBurst: ActiveBurst | null = null;
      for (const hop of scenario.hopSequence) {
        if (elapsed >= hop.startTime && elapsed < hop.startTime + hop.duration) {
          currentBurst = {
            channel: hop.channel,
            endTime: hop.startTime + hop.duration,
            isDecoy: hop.isDecoy,
          };
          break;
        }
      }

      setActiveBurst(currentBurst);

      // Use refs to get current values (avoid stale closures)
      const currentCursor = cursorChannelRef.current;
      const wasLocked = isLockedRef.current;

      // Check if cursor is on the correct channel
      if (currentBurst && !currentBurst.isDecoy) {
        if (currentCursor === currentBurst.channel) {
          setIsLocked(true);
          setTotalLockTime(prev => {
            totalLockTimeRef.current = prev + deltaMs;
            return prev + deltaMs;
          });
          setCurrentStreak(prev => {
            const newStreak = prev + deltaMs;
            setMaxStreak(max => Math.max(max, newStreak));
            return newStreak;
          });
        } else {
          if (wasLocked) {
            setMisses(m => m + 1);
          }
          setIsLocked(false);
          setCurrentStreak(0);
        }
      } else {
        // No active burst or decoy
        if (currentBurst?.isDecoy && currentCursor === currentBurst.channel) {
          // Locked onto decoy - penalty
          if (wasLocked) {
            setMisses(m => m + 1);
          }
        }
        setIsLocked(false);
        setCurrentStreak(0);
      }

      gameLoopRef.current = requestAnimationFrame(tick);
    };

    gameLoopRef.current = requestAnimationFrame(tick);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [scenario, startTimer]); // Removed cursorChannel and isLocked - using refs instead

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (completedRef.current) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          setCursorChannel(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          setCursorChannel(prev => Math.min(scenario.channelCount - 1, prev + 1));
          break;
        case 'Escape':
          onCancel();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scenario.channelCount, onCancel]);

  const progress = totalLockTime / scenario.totalLockTimeRequired;
  const isLowTime = timeRemaining < 20;

  // Generate channel labels
  const channels = Array.from({ length: scenario.channelCount }, (_, i) => {
    const baseFreq = 2400 + i * 5;
    return `${baseFreq} MHz`;
  });

  return (
    <div className="frequency-hopper">
      <div className="game-header">
        <div className="game-info">
          <span className="info-label">LOCK</span>
          <span className="info-value">{Math.round(progress * 100)}%</span>
        </div>
        <div className="game-info">
          <span className="info-label">STREAK</span>
          <span className="info-value">{Math.round(currentStreak / 1000)}s</span>
        </div>
        <div className="game-info">
          <span className="info-label">MISSES</span>
          <span className="info-value">{misses}</span>
        </div>
        <div className={`game-info timer ${isLowTime ? 'low-time' : ''}`}>
          <span className="info-label">TIME</span>
          <span className="info-value">{formatTime(timeRemaining)}</span>
        </div>
        <button className="cancel-btn" onClick={onCancel}>ABORT</button>
      </div>

      <div className="game-instructions">
        Use <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> to track the signal across frequencies
      </div>

      {/* Progress bar */}
      <div className="lock-progress">
        <div className="lock-progress-bar" style={{ width: `${progress * 100}%` }} />
        <span className="lock-progress-label">
          {(totalLockTime / 1000).toFixed(1)}s / {(scenario.totalLockTimeRequired / 1000).toFixed(1)}s LOCK TIME
        </span>
      </div>

      {/* Spectrum display */}
      <div className="spectrum-display">
        <div className="spectrum-header">
          <span className="spectrum-title">FREQUENCY SPECTRUM</span>
          <span className={`signal-status ${isLocked ? 'locked' : activeBurst ? 'searching' : 'idle'}`}>
            {isLocked ? 'SIGNAL LOCKED' : activeBurst ? 'SIGNAL DETECTED' : 'SCANNING...'}
          </span>
        </div>

        <div className="channel-grid">
          {channels.map((freq, index) => {
            const isCursor = cursorChannel === index;
            const hasBurst = activeBurst?.channel === index;
            const isDecoy = hasBurst && activeBurst?.isDecoy;
            const isLockedOn = isCursor && hasBurst && !isDecoy;

            return (
              <div
                key={index}
                className={`channel ${isCursor ? 'cursor' : ''} ${hasBurst ? 'burst' : ''} ${isDecoy ? 'decoy' : ''} ${isLockedOn ? 'locked' : ''}`}
              >
                <div className="channel-bar">
                  <div
                    className="channel-signal"
                    style={{
                      height: hasBurst ? (isDecoy ? '40%' : '80%') : '10%',
                      opacity: hasBurst ? 1 : 0.3,
                    }}
                  />
                </div>
                <span className="channel-label">{freq}</span>
                {isCursor && <div className="cursor-indicator">▼</div>}
              </div>
            );
          })}
        </div>

        {/* Waterfall - Guitar Hero style scrolling */}
        <div className="waterfall">
          {/* Target zone indicator at top */}
          <div className="waterfall-target-zone">
            <span className="target-label">ACTIVE</span>
          </div>

          {/* Time markers */}
          <div className="waterfall-time-markers">
            <span className="time-marker" style={{ top: '10%' }}>NOW</span>
            <span className="time-marker" style={{ top: '40%' }}>+1s</span>
            <span className="time-marker" style={{ top: '70%' }}>+2s</span>
            <span className="time-marker" style={{ top: '95%' }}>+3s</span>
          </div>

          {/* Scrolling blips - show window from -500ms to +3500ms (faster scrolling) */}
          {scenario.hopSequence
            .filter(hop => {
              const hopEndTime = hop.startTime + hop.duration;
              // Show if hop is currently active or coming up in next 3.5 seconds
              return hopEndTime > gameTime - 500 && hop.startTime < gameTime + 3500;
            })
            .map((hop) => {
              const isActive = gameTime >= hop.startTime && gameTime < hop.startTime + hop.duration;
              const isPast = gameTime >= hop.startTime + hop.duration;

              // Calculate vertical position based on time relative to now
              // Top of waterfall (10%) = current time, Bottom (95%) = +3.5 seconds ahead
              const timeFromNow = hop.startTime - gameTime;
              const normalizedTime = (timeFromNow + 500) / 4000; // -500ms to +3500ms -> 0 to 1
              const topPercent = 10 + normalizedTime * 85; // Map to 10% - 95%

              const left = ((hop.channel + 0.5) / scenario.channelCount) * 100;
              const opacity = isPast ? 0.3 : isActive ? 1 : 0.7;

              return (
                <div
                  key={`${hop.startTime}-${hop.channel}`}
                  className={`waterfall-blip ${hop.isDecoy ? 'decoy' : ''} ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                  style={{
                    left: `${left}%`,
                    top: `${topPercent}%`,
                    opacity,
                    height: `${(hop.duration / 4000) * 85}%`, // Height proportional to duration
                  }}
                />
              );
            })}
        </div>
      </div>

      {/* Visual feedback */}
      <div className={`lock-indicator ${isLocked ? 'active' : ''}`}>
        <div className="lock-ring" />
        <div className="lock-ring" />
        <div className="lock-ring" />
      </div>
    </div>
  );
}
