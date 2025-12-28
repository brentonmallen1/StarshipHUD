/**
 * Shared types for decryption minigames
 */

import type { DecryptionDifficulty, DecryptionResult } from '../../types';

// Common minigame props interface
export interface MinigameProps {
  scenario: GameScenario;
  onProgress: (progress: number, chunks: string[]) => void;
  onComplete: (result: DecryptionResult) => void;
  onCancel: () => void;
}

// Base scenario that all games share
export interface GameScenario {
  seed: number;
  difficulty: DecryptionDifficulty;
  plaintextChunks: string[];
  timeLimit: number;
  metadata: {
    sender: string;
    frequency?: string;
    timestamp: string;
  };
}

// Easy: Packet Reassembly types
export interface PacketData {
  id: string;
  seq: number;
  time: string;
  snr: number;
  payload: string;
  isDecoy: boolean;
  checksum: string;
}

export interface PacketScenario extends GameScenario {
  gameType: 'packet_reassembly';
  packets: PacketData[];
  correctOrder: string[]; // packet IDs in correct order
}

// Medium: Frequency Hopper types
export interface HopBurst {
  channel: number;
  startTime: number;
  duration: number;
  isDecoy: boolean;
}

export interface FrequencyScenario extends GameScenario {
  gameType: 'frequency_hopper';
  channelCount: number;
  hopSequence: HopBurst[];
  driftPattern: { time: number; drift: number }[];
  totalLockTimeRequired: number;
}

// Hard: Constellation Calibrator types
export interface ConstellationScenario extends GameScenario {
  gameType: 'constellation_calibrator';
  targetRotation: number;      // 0-360 degrees
  targetGain: number;          // 0.8-1.2
  targetNoiseFilter: number;   // 0-100
  noiseLevel: number;          // base noise
  driftRate: number;           // how fast settings drift
  berThreshold: number;        // target BER to achieve
  lockDuration: number;        // seconds to hold lock
}

// Union type for all scenarios
export type AnyGameScenario = PacketScenario | FrequencyScenario | ConstellationScenario;

// Game state for tracking progress
export interface GameState {
  status: 'briefing' | 'playing' | 'completed' | 'failed';
  startTime: number | null;
  elapsedMs: number;
  progress: number;
  revealedChunks: string[];
  mistakes: number;
  detectionRisk: number;
  score: number;
}

// Seeded random number generator interface
export interface SeededRandom {
  next: () => number;           // 0-1
  nextInt: (min: number, max: number) => number;
  shuffle: <T>(array: T[]) => T[];
  pick: <T>(array: T[]) => T;
}
