/**
 * Minigame configuration and tuning constants
 */

import type { DecryptionDifficulty } from '../../types';

export interface DifficultyConfig {
  timeLimit: number;        // seconds
  maxRetries: number;       // before GM lock
  cooldownSeconds: number;  // between retries
  targetTime: number;       // for scoring (seconds)
}

export const DIFFICULTY_CONFIG: Record<DecryptionDifficulty, DifficultyConfig> = {
  easy: {
    timeLimit: 90,
    maxRetries: 5,
    cooldownSeconds: 15,
    targetTime: 45,
  },
  medium: {
    timeLimit: 120,
    maxRetries: 3,
    cooldownSeconds: 30,
    targetTime: 75,
  },
  hard: {
    timeLimit: 180,
    maxRetries: 2,
    cooldownSeconds: 60,
    targetTime: 120,
  },
};

// Packet Reassembly (Easy) tuning
export const PACKET_REASSEMBLY_CONFIG = {
  easy: {
    packetCount: 8,
    decoyCount: 0,
    payloadLength: { min: 3, max: 5 },
    corruptionChance: 0,
  },
  medium: {
    packetCount: 10,
    decoyCount: 1,
    payloadLength: { min: 2, max: 4 },
    corruptionChance: 0,
  },
  hard: {
    packetCount: 12,
    decoyCount: 2,
    payloadLength: { min: 2, max: 3 },
    corruptionChance: 0.1,
  },
};

// Frequency Hopper (Medium) tuning
export const FREQUENCY_HOPPER_CONFIG = {
  easy: {
    channelCount: 6,
    hopDuration: { min: 2000, max: 4000 },  // ms
    lockWindowMs: 1500,
    totalLockTime: 20,  // seconds
    driftAmount: 0,
    decoyFrequency: 0,
    assistAfterMisses: 2,
  },
  medium: {
    channelCount: 8,
    hopDuration: { min: 1500, max: 3000 },
    lockWindowMs: 1200,
    totalLockTime: 30,
    driftAmount: 0.3,
    decoyFrequency: 0.15,
    assistAfterMisses: 3,
  },
  hard: {
    channelCount: 10,
    hopDuration: { min: 1000, max: 2500 },
    lockWindowMs: 800,
    totalLockTime: 40,
    driftAmount: 0.5,
    decoyFrequency: 0.25,
    assistAfterMisses: 5,
  },
};

// Constellation Calibrator (Hard) tuning
export const CONSTELLATION_CALIBRATOR_CONFIG = {
  easy: {
    noiseLevel: 15,
    berThreshold: 10,       // percent
    lockDuration: 2,        // seconds
    driftRate: 0,
    rotationRange: 30,      // degrees from center
    gainRange: 0.1,         // deviation from 1.0
  },
  medium: {
    noiseLevel: 25,
    berThreshold: 7,
    lockDuration: 2.5,
    driftRate: 0.5,
    rotationRange: 60,
    gainRange: 0.15,
  },
  hard: {
    noiseLevel: 35,
    berThreshold: 5,
    lockDuration: 3,
    driftRate: 1.0,
    rotationRange: 90,
    gainRange: 0.2,
  },
};

// Scoring weights
export const SCORING_CONFIG = {
  timeWeight: 0.4,          // 40% of score
  accuracyWeight: 0.35,     // 35% of score
  riskWeight: 0.25,         // 25% of score (inverse of detection risk)
  baseScore: 1000,
  perfectBonus: 500,
  streakMultiplier: 1.1,
};

// UI timing
export const UI_CONFIG = {
  progressRevealInterval: 0.1,  // reveal text every 10% progress
  resultDisplayDuration: 3000,  // ms to show results
  countdownWarningAt: 30,       // seconds remaining for warning color
  countdownCriticalAt: 10,      // seconds remaining for critical color
};
