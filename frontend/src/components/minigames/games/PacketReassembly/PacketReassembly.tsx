import { useState, useCallback, useEffect, useRef } from 'react';
import type { DecryptionResult } from '../../../../types';
import type { PacketScenario, PacketData } from '../../types';
import { useMinigameTimer, formatTime } from '../../useMinigameTimer';
import './PacketReassembly.css';

interface PacketReassemblyProps {
  scenario: PacketScenario;
  onProgress: (progress: number, chunks: string[]) => void;
  onComplete: (result: DecryptionResult) => void;
  onCancel: () => void;
}

export function PacketReassembly({
  scenario,
  onProgress,
  onComplete,
  onCancel,
}: PacketReassemblyProps) {
  // Packet state - we track their positions in the sequence
  const [arrangedPackets, setArrangedPackets] = useState<(PacketData | null)[]>(
    () => new Array(scenario.correctOrder.length).fill(null)
  );
  const [availablePackets, setAvailablePackets] = useState<PacketData[]>(
    () => [...scenario.packets]
  );
  const [draggedPacket, setDraggedPacket] = useState<PacketData | null>(null);
  const [dragSource, setDragSource] = useState<{ type: 'available' | 'slot'; index: number } | null>(null);
  const [moves, setMoves] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const timeoutHandledRef = useRef(false);

  // Handle timeout callback - defined before timer
  const handleTimeout = useCallback(() => {
    if (timeoutHandledRef.current) return;
    timeoutHandledRef.current = true;

    const progress = correctCount / scenario.correctOrder.length;
    const revealed = scenario.plaintextChunks.slice(0, correctCount);

    onComplete({
      success: false,
      progress,
      revealed_chunks: revealed,
      mistakes: moves,
      time_ms: scenario.timeLimit * 1000,
      detection_risk: 1,
      score: Math.round(progress * 300),
    });
  }, [correctCount, moves, scenario, onComplete]);

  // Timer - returns [state, controls] tuple
  const [timerState, timerControls] = useMinigameTimer(
    scenario.timeLimit,
    handleTimeout
  );
  const { timeRemaining } = timerState;
  const { start: startTimer, pause: pauseTimer } = timerControls;

  // Auto-start timer on mount
  useEffect(() => {
    startTimer();
  }, [startTimer]);

  // Success handler - defined before the effect that uses it
  const handleSuccess = useCallback(() => {
    const timeTaken = Date.now() - startTimeRef.current;
    const baseScore = 1000;
    const timeBonus = Math.max(0, scenario.timeLimit * 1000 - timeTaken) / 100;
    const movesPenalty = Math.max(0, moves - scenario.correctOrder.length) * 10;
    const score = Math.round(baseScore + timeBonus - movesPenalty);

    onComplete({
      success: true,
      progress: 1,
      revealed_chunks: scenario.plaintextChunks,
      mistakes: Math.max(0, moves - scenario.correctOrder.length),
      time_ms: timeTaken,
      detection_risk: moves / (scenario.correctOrder.length * 3),
      score: Math.max(100, score),
    });
  }, [moves, scenario, onComplete]);

  // Check for completion and update progress
  useEffect(() => {
    let correct = 0;
    const revealed: string[] = [];

    arrangedPackets.forEach((packet, index) => {
      if (packet && packet.id === scenario.correctOrder[index]) {
        correct++;
        // Find the chunk for this packet
        const chunkIndex = scenario.packets.findIndex(p => p.id === packet.id);
        if (chunkIndex !== -1 && scenario.plaintextChunks[chunkIndex]) {
          revealed.push(scenario.plaintextChunks[chunkIndex]);
        }
      }
    });

    setCorrectCount(correct);
    const progress = correct / scenario.correctOrder.length;
    onProgress(progress, revealed);

    // Check if all slots are filled correctly
    if (correct === scenario.correctOrder.length && !isComplete) {
      setIsComplete(true);
      pauseTimer();
      handleSuccess();
    }
  }, [arrangedPackets, scenario, onProgress, isComplete, pauseTimer, handleSuccess]);

  // Drag handlers
  const handleDragStart = useCallback((packet: PacketData, source: { type: 'available' | 'slot'; index: number }) => {
    setDraggedPacket(packet);
    setDragSource(source);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedPacket(null);
    setDragSource(null);
  }, []);

  const handleDropOnSlot = useCallback((slotIndex: number) => {
    if (!draggedPacket || !dragSource) return;

    setMoves(m => m + 1);

    // Get the packet currently in the target slot (if any)
    const existingPacket = arrangedPackets[slotIndex];

    // Update arranged packets
    setArrangedPackets(prev => {
      const next = [...prev];

      // If dragging from a slot, clear the source slot
      if (dragSource.type === 'slot') {
        next[dragSource.index] = existingPacket; // Swap with existing
      } else if (existingPacket) {
        // If dragging from available and slot is occupied, return to available
        setAvailablePackets(avail => [...avail, existingPacket]);
      }

      // Place the dragged packet in the target slot
      next[slotIndex] = draggedPacket;
      return next;
    });

    // If dragging from available, remove from available
    if (dragSource.type === 'available') {
      setAvailablePackets(prev => prev.filter(p => p.id !== draggedPacket.id));
    }

    handleDragEnd();
  }, [draggedPacket, dragSource, arrangedPackets, handleDragEnd]);

  const handleDropOnAvailable = useCallback(() => {
    if (!draggedPacket || !dragSource) return;
    if (dragSource.type === 'available') {
      // Already in available, do nothing
      handleDragEnd();
      return;
    }

    setMoves(m => m + 1);

    // Remove from slot and add back to available
    setArrangedPackets(prev => {
      const next = [...prev];
      next[dragSource.index] = null;
      return next;
    });
    setAvailablePackets(prev => [...prev, draggedPacket]);
    handleDragEnd();
  }, [draggedPacket, dragSource, handleDragEnd]);

  const isLowTime = timeRemaining < 15;

  return (
    <div className="packet-reassembly">
      <div className="game-header">
        <div className="game-info">
          <span className="info-label">PACKETS</span>
          <span className="info-value">{correctCount}/{scenario.correctOrder.length}</span>
        </div>
        <div className="game-info">
          <span className="info-label">MOVES</span>
          <span className="info-value">{moves}</span>
        </div>
        <div className={`game-info timer ${isLowTime ? 'low-time' : ''}`}>
          <span className="info-label">TIME</span>
          <span className="info-value">{formatTime(timeRemaining)}</span>
        </div>
        <button className="cancel-btn" onClick={onCancel}>ABORT</button>
      </div>

      <div className="game-instructions">
        Arrange the data packets in the correct sequence order (0 → {scenario.correctOrder.length - 1})
      </div>

      {/* Sequence Slots */}
      <div className="sequence-slots">
        {arrangedPackets.map((packet, index) => {
          const isCorrect = packet && packet.id === scenario.correctOrder[index];
          const isWrong = packet && !isCorrect;
          return (
            <div
              key={`slot-${index}`}
              className={`sequence-slot ${packet ? 'filled' : 'empty'} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''} ${draggedPacket ? 'drop-target' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnSlot(index)}
            >
              <div className="slot-label">SEQ {index}</div>
              {packet ? (
                <div
                  className={`packet-card ${isCorrect ? 'locked' : ''}`}
                  draggable={!isCorrect}
                  onDragStart={() => !isCorrect && handleDragStart(packet, { type: 'slot', index })}
                  onDragEnd={handleDragEnd}
                >
                  <div className="packet-header">
                    <span className="packet-id">{packet.checksum}</span>
                    <span className={`packet-snr ${packet.snr > 0.8 ? 'good' : packet.snr > 0.5 ? 'medium' : 'poor'}`}>
                      SNR {(packet.snr * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="packet-payload">{packet.payload}</div>
                  <div className="packet-meta">
                    <span className="packet-time">{new Date(packet.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>
              ) : (
                <div className="empty-slot-indicator">
                  <span className="drop-hint">DROP HERE</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Available Packets */}
      <div
        className="available-packets"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropOnAvailable}
      >
        <div className="available-header">
          <span className="available-title">INCOMING PACKETS</span>
          <span className="available-count">{availablePackets.length} remaining</span>
        </div>
        <div className="packets-grid">
          {availablePackets.map((packet, index) => (
            <div
              key={packet.id}
              className={`packet-card available ${draggedPacket?.id === packet.id ? 'dragging' : ''} ${packet.isDecoy ? 'decoy' : ''}`}
              draggable
              onDragStart={() => handleDragStart(packet, { type: 'available', index })}
              onDragEnd={handleDragEnd}
            >
              <div className="packet-header">
                <span className="packet-id">{packet.checksum}</span>
                <span className={`packet-snr ${packet.snr > 0.8 ? 'good' : packet.snr > 0.5 ? 'medium' : 'poor'}`}>
                  SNR {(packet.snr * 100).toFixed(0)}%
                </span>
              </div>
              <div className="packet-payload">{packet.payload}</div>
              <div className="packet-meta">
                <span className="packet-time">{new Date(packet.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </div>
          ))}
          {availablePackets.length === 0 && (
            <div className="no-packets">All packets placed. Check sequence order!</div>
          )}
        </div>
      </div>
    </div>
  );
}
