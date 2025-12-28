import { useState, useCallback, useEffect, useRef } from 'react';
import type { DecryptionResult } from '../../../../types';
import type { ConstellationScenario } from '../../types';
import { useMinigameTimer, formatTime } from '../../useMinigameTimer';
import './ConstellationCalibrator.css';

interface ConstellationCalibratorProps {
  scenario: ConstellationScenario;
  onProgress: (progress: number, chunks: string[]) => void;
  onComplete: (result: DecryptionResult) => void;
  onCancel: () => void;
}

// Calculate Bit Error Rate based on calibration accuracy
function calculateBER(
  rotation: number,
  gain: number,
  noiseFilter: number,
  targetRotation: number,
  targetGain: number,
  targetNoiseFilter: number,
  noiseLevel: number
): number {
  // Calculate distance from optimal settings
  const rotationError = Math.abs(rotation - targetRotation) / 180; // Normalize to 0-2
  const gainError = Math.abs(gain - targetGain) / 0.4; // Normalize based on range
  const filterError = Math.abs(noiseFilter - targetNoiseFilter) / 100;

  // Weighted combination of errors
  const combinedError = (rotationError * 0.4 + gainError * 0.35 + filterError * 0.25);

  // Add noise influence
  const baseNoise = noiseLevel * 0.3;

  // BER is 0-1, with 0 being perfect
  return Math.min(1, combinedError + baseNoise * (1 - noiseFilter / 100));
}

// 16-APSK constellation (4+12) - DVB-S2 style
// Inner ring: 4 points at radius 0.4, starting at 45° (diamond orientation)
// Outer ring: 12 points at radius 0.85, starting at 15° (offset from inner)
// This breaks 4-fold symmetry - only ONE rotation produces correct alignment
interface IdealPoint {
  x: number;
  y: number;
  ring: 'inner' | 'outer';
}

function generateIdealPoints(): IdealPoint[] {
  const points: IdealPoint[] = [];

  // Inner ring: 4 points at radius 0.4, starting at 45° (diamond orientation)
  const innerRadius = 0.4;
  for (let i = 0; i < 4; i++) {
    const angle = (45 + i * 90) * Math.PI / 180; // 45°, 135°, 225°, 315°
    points.push({
      x: innerRadius * Math.cos(angle),
      y: innerRadius * Math.sin(angle),
      ring: 'inner',
    });
  }

  // Outer ring: 12 points at radius 0.85, starting at 15° (offset from inner)
  const outerRadius = 0.85;
  for (let i = 0; i < 12; i++) {
    const angle = (15 + i * 30) * Math.PI / 180; // 15°, 45°, 75°, ...
    points.push({
      x: outerRadius * Math.cos(angle),
      y: outerRadius * Math.sin(angle),
      ring: 'outer',
    });
  }

  return points; // 16 total points
}

// Pre-generate ideal points (static)
const IDEAL_POINTS = generateIdealPoints();

// Generate constellation points for 16-APSK display
// Uses deterministic noise based on seed to avoid chaotic jumping between renders
function generateConstellationPoints(
  rotation: number,
  gain: number,
  noiseLevel: number,
  targetRotation: number,
  targetGain: number,
  seed: number
): { x: number; y: number; ring: 'inner' | 'outer' }[] {
  const points: { x: number; y: number; ring: 'inner' | 'outer' }[] = [];

  // Apply rotation difference
  const rotationDiff = (rotation - targetRotation) * Math.PI / 180;
  const gainDiff = gain / targetGain;

  // Deterministic noise function - returns stable value for same inputs
  const noise = (i: number, offset: number) => {
    const val = Math.sin(seed * 0.001 + i * 12.9898 + offset * 78.233) * 43758.5453;
    return (val - Math.floor(val)) - 0.5; // Returns -0.5 to 0.5
  };

  // Generate 4 scattered points around each of the 16 ideal positions (64 total)
  for (let i = 0; i < 64; i++) {
    const idealIdx = i % 16;
    const ideal = IDEAL_POINTS[idealIdx];

    // Apply rotation and gain
    const rotatedX = ideal.x * Math.cos(rotationDiff) - ideal.y * Math.sin(rotationDiff);
    const rotatedY = ideal.x * Math.sin(rotationDiff) + ideal.y * Math.cos(rotationDiff);
    const scaledX = rotatedX * gainDiff;
    const scaledY = rotatedY * gainDiff;

    // Add deterministic noise based on point index and seed
    // Scale noise by ring - inner ring gets less noise for visibility
    const noiseScale = ideal.ring === 'inner' ? 0.6 : 0.8;
    const noiseX = noise(i, 0) * noiseLevel * noiseScale;
    const noiseY = noise(i, 1) * noiseLevel * noiseScale;

    points.push({
      x: scaledX + noiseX,
      y: scaledY + noiseY,
      ring: ideal.ring,
    });
  }

  return points;
}

export function ConstellationCalibrator({
  scenario,
  onProgress,
  onComplete,
  onCancel,
}: ConstellationCalibratorProps) {
  // Knob states - start with greater deviation from targets for harder gameplay
  const [rotation, setRotation] = useState(scenario.targetRotation + (Math.random() - 0.5) * 120); // ±60°
  const [gain, setGain] = useState(scenario.targetGain + (Math.random() - 0.5) * 0.5); // ±0.25
  const [noiseFilter, setNoiseFilter] = useState(Math.random() * 30); // 0-30 (harder start)

  // Game state
  const [ber, setBer] = useState(1);
  const [lockTime, setLockTime] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [adjustments, setAdjustments] = useState(0);
  const [bestBer, setBestBer] = useState(1);

  const startTimeRef = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(Date.now());
  const gameLoopRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Refs for values that the game loop needs to read (avoid stale closures)
  const rotationRef = useRef(rotation);
  const gainRef = useRef(gain);
  const noiseFilterRef = useRef(noiseFilter);
  const lockTimeRef = useRef(lockTime);

  // Sync refs when state changes
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);
  useEffect(() => { gainRef.current = gain; }, [gain]);
  useEffect(() => { noiseFilterRef.current = noiseFilter; }, [noiseFilter]);
  useEffect(() => { lockTimeRef.current = lockTime; }, [lockTime]);

  // Handle timeout
  const handleTimeout = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    const progress = Math.min(1, lockTime / scenario.lockDuration);
    const chunksRevealed = Math.floor(progress * scenario.plaintextChunks.length);
    const revealed = scenario.plaintextChunks.slice(0, chunksRevealed);

    onComplete({
      success: false,
      progress,
      revealed_chunks: revealed,
      mistakes: adjustments,
      time_ms: scenario.timeLimit * 1000,
      detection_risk: 1 - bestBer,
      score: Math.round(progress * 300 + (1 - bestBer) * 200),
    });
  }, [lockTime, adjustments, bestBer, scenario, onComplete]);

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
    const timeBonus = Math.max(0, scenario.timeLimit * 1000 - timeTaken) / 100;
    const accuracyBonus = (1 - bestBer) * 300;
    const adjustmentPenalty = adjustments * 5;
    const score = Math.round(baseScore + timeBonus + accuracyBonus - adjustmentPenalty);

    onComplete({
      success: true,
      progress: 1,
      revealed_chunks: scenario.plaintextChunks,
      mistakes: adjustments,
      time_ms: timeTaken,
      detection_risk: bestBer,
      score: Math.max(100, score),
    });
  }, [adjustments, bestBer, scenario, onComplete, pauseTimer]);

  // Game loop
  useEffect(() => {
    startTimer();
    lastTickRef.current = Date.now();

    const tick = () => {
      if (completedRef.current) return;

      const now = Date.now();
      const deltaMs = now - lastTickRef.current;
      lastTickRef.current = now;

      // Use refs to get current values (avoid stale closures)
      const currentRotation = rotationRef.current;
      const currentGain = gainRef.current;
      const currentNoiseFilter = noiseFilterRef.current;

      // Calculate current BER using ref values
      const currentBer = calculateBER(
        currentRotation,
        currentGain,
        currentNoiseFilter,
        scenario.targetRotation,
        scenario.targetGain,
        scenario.targetNoiseFilter,
        scenario.noiseLevel
      );

      setBer(currentBer);
      setBestBer(prev => Math.min(prev, currentBer));

      // Check if within threshold
      const withinThreshold = currentBer < scenario.berThreshold;
      setIsLocked(withinThreshold);

      if (withinThreshold) {
        setLockTime(prev => {
          const newLockTime = prev + deltaMs;
          lockTimeRef.current = newLockTime;

          // Check win condition
          if (newLockTime >= scenario.lockDuration && !completedRef.current) {
            handleSuccess();
          }

          return newLockTime;
        });
      } else {
        // Reset lock time if BER goes above threshold
        setLockTime(0);
        lockTimeRef.current = 0;
      }

      // Update progress using ref for current lock time
      const currentLockTime = lockTimeRef.current;
      const progress = Math.min(1, currentLockTime / scenario.lockDuration);
      const chunksRevealed = Math.floor(progress * scenario.plaintextChunks.length);
      const revealed = scenario.plaintextChunks.slice(0, chunksRevealed);
      onProgress(progress, revealed);

      gameLoopRef.current = requestAnimationFrame(tick);
    };

    gameLoopRef.current = requestAnimationFrame(tick);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [scenario, startTimer, handleSuccess, onProgress]); // Removed state values - using refs instead

  // Knob change handlers
  const handleRotationChange = useCallback((value: number) => {
    setRotation(value);
    setAdjustments(prev => prev + 1);
  }, []);

  const handleGainChange = useCallback((value: number) => {
    setGain(value);
    setAdjustments(prev => prev + 1);
  }, []);

  const handleNoiseFilterChange = useCallback((value: number) => {
    setNoiseFilter(value);
    setAdjustments(prev => prev + 1);
  }, []);

  // Generate constellation points for display
  // Using deterministic noise based on seed for smooth visuals
  const constellationPoints = generateConstellationPoints(
    rotation,
    gain,
    scenario.noiseLevel * (1 - noiseFilter / 100),
    scenario.targetRotation,
    scenario.targetGain,
    scenario.seed
  );

  const isLowTime = timeRemaining < 30;
  const lockProgress = lockTime / scenario.lockDuration;
  const berPercent = ber * 100;

  return (
    <div className="constellation-calibrator">
      <div className="game-header">
        <div className="game-info">
          <span className="info-label">BER</span>
          <span className={`info-value ${ber < scenario.berThreshold ? 'good' : ber < 0.2 ? 'medium' : 'poor'}`}>
            {berPercent.toFixed(1)}%
          </span>
        </div>
        <div className="game-info">
          <span className="info-label">LOCK</span>
          <span className="info-value">{Math.round(lockProgress * 100)}%</span>
        </div>
        <div className="game-info">
          <span className="info-label">ADJUST</span>
          <span className="info-value">{adjustments}</span>
        </div>
        <div className={`game-info timer ${isLowTime ? 'low-time' : ''}`}>
          <span className="info-label">TIME</span>
          <span className="info-value">{formatTime(timeRemaining)}</span>
        </div>
        <button className="cancel-btn" onClick={onCancel}>ABORT</button>
      </div>

      <div className="game-instructions">
        Adjust Rotation, Gain, and Noise Filter to reduce BER below {(scenario.berThreshold * 100).toFixed(0)}% for {(scenario.lockDuration / 1000).toFixed(0)}s
      </div>

      <div className="calibrator-layout">
        {/* Constellation Display */}
        <div className="constellation-panel">
          <div className="panel-header">
            <span className="panel-title">CONSTELLATION DIAGRAM</span>
            <span className={`lock-status ${isLocked ? 'locked' : 'unlocked'}`}>
              {isLocked ? 'LOCKED' : 'UNLOCKED'}
            </span>
          </div>
          <div className="constellation-display">
            <div className="constellation-grid">
              <div className="grid-line horizontal" />
              <div className="grid-line vertical" />
            </div>
            {/* APSK ring guides */}
            <div className="constellation-rings">
              <div className="ring-guide inner" />
              <div className="ring-guide outer" />
            </div>
            {/* Ideal point markers (16 total) */}
            <div className="ideal-markers">
              {IDEAL_POINTS.map((pt, i) => (
                <div
                  key={`ideal-${i}`}
                  className={`ideal-marker ${pt.ring}`}
                  style={{
                    left: `${(pt.x + 1) * 50}%`,
                    top: `${(-pt.y + 1) * 50}%`,
                  }}
                />
              ))}
            </div>
            {/* Scattered constellation points */}
            <div className="constellation-points">
              {constellationPoints.map((point, i) => (
                <div
                  key={i}
                  className={`point ${point.ring}`}
                  style={{
                    left: `${(point.x + 1) * 50}%`,
                    top: `${(-point.y + 1) * 50}%`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* BER Meter */}
          <div className="ber-meter">
            <div className="ber-bar-container">
              <div
                className={`ber-bar ${ber < scenario.berThreshold ? 'good' : ber < 0.2 ? 'medium' : 'poor'}`}
                style={{ width: `${Math.min(100, berPercent)}%` }}
              />
              <div className="ber-threshold" style={{ left: `${scenario.berThreshold * 100}%` }} />
            </div>
            <div className="ber-labels">
              <span>0%</span>
              <span className="threshold-label">THRESHOLD</span>
              <span>100%</span>
            </div>
          </div>

          {/* Lock Progress */}
          <div className="lock-progress-container">
            <div className="lock-progress-bar" style={{ width: `${lockProgress * 100}%` }} />
            <span className="lock-progress-label">
              {isLocked ? `HOLDING LOCK: ${(lockTime / 1000).toFixed(1)}s / ${(scenario.lockDuration / 1000).toFixed(0)}s` : 'ACQUIRE LOCK'}
            </span>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="controls-panel">
          <div className="panel-header">
            <span className="panel-title">CALIBRATION CONTROLS</span>
          </div>

          <div className="control-group">
            <label className="control-label">
              <span className="label-text">ROTATION</span>
              <span className="label-value">{rotation.toFixed(1)}°</span>
            </label>
            <input
              type="range"
              className="control-slider"
              min="0"
              max="360"
              step="0.5"
              value={rotation}
              onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              <span className="label-text">GAIN</span>
              <span className="label-value">{gain.toFixed(2)}</span>
            </label>
            <input
              type="range"
              className="control-slider"
              min="0.6"
              max="1.4"
              step="0.01"
              value={gain}
              onChange={(e) => handleGainChange(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              <span className="label-text">NOISE FILTER</span>
              <span className="label-value">{noiseFilter.toFixed(0)}%</span>
            </label>
            <input
              type="range"
              className="control-slider"
              min="0"
              max="100"
              step="1"
              value={noiseFilter}
              onChange={(e) => handleNoiseFilterChange(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-hints">
            <p>Align clusters to both inner and outer rings</p>
            <p>Reduce scatter with noise filter</p>
          </div>
        </div>
      </div>
    </div>
  );
}
