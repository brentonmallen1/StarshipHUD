import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { ShipEvent, TransmissionData, DecryptionResult, DecryptionDifficulty } from '../../types';
import type { PacketScenario, FrequencyScenario, ConstellationScenario, AnyGameScenario, PacketData, HopBurst } from './types';
import { useMinigameSeed } from './useMinigameSeed';
import { DIFFICULTY_CONFIG } from './config';
import { useAttemptDecryption } from '../../hooks/useMutations';
import { PacketReassembly } from './games/PacketReassembly';
import { FrequencyHopper } from './games/FrequencyHopper';
import { ConstellationCalibrator } from './games/ConstellationCalibrator';
import './DecryptionModal.css';

interface DecryptionModalProps {
  transmission: ShipEvent;
  onClose: () => void;
  onSuccess: () => void;
}

type GamePhase = 'ready' | 'playing' | 'result';

export function DecryptionModal({ transmission, onClose, onSuccess }: DecryptionModalProps) {
  const modalRef = useModalA11y(onClose);
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [result, setResult] = useState<DecryptionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [revealedChunks, setRevealedChunks] = useState<string[]>([]);

  const handleProgress = useCallback((prog: number, chunks: string[]) => {
    setProgress(prog);
    setRevealedChunks(chunks);
  }, []);

  const attemptDecryption = useAttemptDecryption();

  const data = transmission.data as unknown as TransmissionData;
  const difficulty = (data.difficulty ?? 'easy') as DecryptionDifficulty;
  const config = DIFFICULTY_CONFIG[difficulty];
  const seed = data.minigame_seed ?? Date.now();

  const rng = useMinigameSeed(seed);

  // Generate the game scenario based on difficulty and seed
  const scenario = useMemo<AnyGameScenario>(() => {
    const plaintext = data.text ?? 'Message content unavailable.';

    // Split plaintext into chunks for progressive reveal
    const words = plaintext.split(' ');
    const chunkSize = Math.ceil(words.length / 5);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    const baseScenario = {
      seed,
      difficulty,
      plaintextChunks: chunks,
      timeLimit: config.timeLimit,
      metadata: {
        sender: data.sender_name ?? 'Unknown',
        frequency: data.frequency,
        timestamp: transmission.created_at,
      },
    };

    // Generate difficulty-specific game data
    if (difficulty === 'easy') {
      const packets: PacketData[] = chunks.map((chunk, i) => ({
        id: `pkt-${i}`,
        seq: i,
        time: new Date(Date.now() - Math.floor(rng.next() * 10000)).toISOString(),
        snr: 0.7 + rng.next() * 0.3,
        payload: chunk.slice(0, 12),
        isDecoy: false,
        checksum: `0x${Math.floor(rng.next() * 0xFFFF).toString(16).padStart(4, '0')}`,
      }));

      const packetScenario: PacketScenario = {
        ...baseScenario,
        gameType: 'packet_reassembly',
        packets: rng.shuffle([...packets]),
        correctOrder: packets.map(p => p.id),
      };
      return packetScenario;
    } else if (difficulty === 'medium') {
      const channelCount = 8;
      const hopSequence: HopBurst[] = [];

      // Generate enough hops to cover the full game duration plus buffer
      const gameTimeMs = config.timeLimit * 1000;
      const hopInterval = 2000; // 2 seconds between hop starts
      const hopCount = Math.ceil(gameTimeMs / hopInterval) + 3; // Extra buffer

      for (let i = 0; i < hopCount; i++) {
        hopSequence.push({
          channel: Math.floor(rng.next() * channelCount),
          startTime: i * hopInterval,
          duration: 500 + rng.next() * 1000, // 500-1500ms (more diverse, more challenging)
          isDecoy: rng.next() < 0.10, // 10% chance of decoy (reduced from 15%)
        });
      }

      // Generate drift pattern (kept for potential future use)
      const driftPattern: { time: number; drift: number }[] = [];
      for (let t = 0; t < gameTimeMs; t += 2000) {
        driftPattern.push({
          time: t,
          drift: (rng.next() - 0.5) * 0.3,
        });
      }

      const freqScenario: FrequencyScenario = {
        ...baseScenario,
        gameType: 'frequency_hopper',
        channelCount,
        hopSequence,
        driftPattern,
        totalLockTimeRequired: 12000, // 12 seconds of lock time to win (more achievable)
      };
      return freqScenario;
    } else {
      const constellationScenario: ConstellationScenario = {
        ...baseScenario,
        gameType: 'constellation_calibrator',
        targetRotation: rng.next() * 360,
        targetGain: 0.8 + rng.next() * 0.4,
        targetNoiseFilter: 50 + rng.next() * 30, // 50-80 (higher baseline for solvability)
        noiseLevel: 0.15 + rng.next() * 0.15, // 0.15-0.30 (reduced for solvability)
        driftRate: 0, // No drift - sliders stay where player puts them
        berThreshold: 0.08, // 8% threshold - achievable with tuned params
        lockDuration: 2000, // 2 seconds
      };
      return constellationScenario;
    }
  }, [seed, difficulty, data, transmission.created_at, rng, config.timeLimit]);

  const handleComplete = useCallback((gameResult: DecryptionResult) => {
    setResult(gameResult);
    setPhase('result');

    // Submit the result to the server
    attemptDecryption.mutate({
      id: transmission.id,
      success: gameResult.success,
      cooldownSeconds: config.cooldownSeconds,
      maxRetries: config.maxRetries,
    }, {
      onSuccess: () => {
        if (gameResult.success) {
          // Small delay before calling onSuccess to show result screen
          setTimeout(onSuccess, 2000);
        }
      }
    });
  }, [attemptDecryption, transmission.id, config, onSuccess]);

  const handleStart = useCallback(() => {
    setPhase('playing');
  }, []);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleCloseResult = useCallback(() => {
    onClose();
  }, [onClose]);

  // Render the appropriate game based on difficulty
  const renderGame = useCallback(() => {
    const commonProps = {
      onComplete: handleComplete,
      onCancel: handleCancel,
      onProgress: handleProgress,
    };

    switch (difficulty) {
      case 'easy':
        // Use the real PacketReassembly game
        return (
          <PacketReassembly
            scenario={scenario as PacketScenario}
            {...commonProps}
          />
        );
      case 'medium':
        // Use the real FrequencyHopper game
        return (
          <FrequencyHopper
            scenario={scenario as FrequencyScenario}
            {...commonProps}
          />
        );
      case 'hard':
        return (
          <ConstellationCalibrator
            scenario={scenario as ConstellationScenario}
            {...commonProps}
          />
        );
      default:
        return (
          <PacketReassembly
            scenario={scenario as PacketScenario}
            {...commonProps}
          />
        );
    }
  }, [difficulty, scenario, handleComplete, handleCancel, handleProgress]);

  // Use portal to render modal at document body level (escape widget overflow:hidden)
  return createPortal(
    <div className="decryption-modal-overlay" onClick={handleCancel}>
      <div ref={modalRef} className="decryption-modal" role="dialog" aria-modal="true" aria-label="Decryption Interface" onClick={(e) => e.stopPropagation()}>
        <div className="decryption-modal-header">
          <div className="modal-title-row">
            <span className="modal-icon">🔓</span>
            <h2>DECRYPTION INTERFACE</h2>
          </div>
          <div className="modal-meta">
            <span className="meta-sender">FROM: {data.sender_name}</span>
            <span className={`meta-difficulty difficulty-${difficulty}`}>
              {difficulty.toUpperCase()}
            </span>
          </div>
          <button className="modal-close" onClick={handleCancel}>✕</button>
        </div>

        <div className="decryption-modal-body">
          {phase === 'ready' && (
            <div className="phase-ready">
              <div className="ready-info">
                <h3>ENCRYPTED TRANSMISSION DETECTED</h3>
                <p className="ready-description">
                  {difficulty === 'easy' && 'Reassemble fragmented data packets to decode the message.'}
                  {difficulty === 'medium' && 'Track the frequency-hopping signal to maintain lock and decode.'}
                  {difficulty === 'hard' && 'Calibrate the constellation receiver to minimize bit errors.'}
                </p>
                <div className="ready-stats">
                  <div className="stat">
                    <span className="stat-label">Time Limit</span>
                    <span className="stat-value">{config.timeLimit}s</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Attempts Left</span>
                    <span className="stat-value">{config.maxRetries - (data.decryption_attempts ?? 0)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Cooldown on Fail</span>
                    <span className="stat-value">{config.cooldownSeconds}s</span>
                  </div>
                </div>
              </div>
              <div className="ready-actions">
                <button className="btn btn-primary btn-large" onClick={handleStart}>
                  BEGIN DECRYPTION
                </button>
                <button className="btn btn-ghost" onClick={handleCancel}>
                  ABORT
                </button>
              </div>
            </div>
          )}

          {phase === 'playing' && (
            <div className="phase-playing">
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              {revealedChunks.length > 0 && (
                <div className="revealed-text">
                  {revealedChunks.join(' ')}
                  <span className="cursor-blink">_</span>
                </div>
              )}
              <div className="game-container">
                {renderGame()}
              </div>
            </div>
          )}

          {phase === 'result' && result && (
            <div className={`phase-result ${result.success ? 'success' : 'failure'}`}>
              <div className="result-header">
                <span className="result-icon">{result.success ? '✓' : '✗'}</span>
                <h3>{result.success ? 'DECRYPTION SUCCESSFUL' : 'DECRYPTION FAILED'}</h3>
              </div>

              {result.success ? (
                <div className="result-content">
                  <div className="decrypted-message">
                    <span className="message-label">MESSAGE:</span>
                    <p className="message-text">{data.text}</p>
                  </div>
                </div>
              ) : (
                <div className="result-content">
                  <p className="failure-message">
                    Signal lost. Encryption key could not be recovered.
                  </p>
                  {revealedChunks.length > 0 && (
                    <div className="partial-decode">
                      <span className="partial-label">PARTIAL DECODE:</span>
                      <p className="partial-text">{revealedChunks.join(' ')}...</p>
                    </div>
                  )}
                </div>
              )}

              <div className="result-stats">
                <div className="stat">
                  <span className="stat-label">Progress</span>
                  <span className="stat-value">{Math.round(result.progress * 100)}%</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Time</span>
                  <span className="stat-value">{(result.time_ms / 1000).toFixed(1)}s</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Score</span>
                  <span className="stat-value">{result.score}</span>
                </div>
              </div>

              <div className="result-actions">
                <button className="btn btn-primary" onClick={handleCloseResult}>
                  {result.success ? 'CONTINUE' : 'ACKNOWLEDGE'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
