/**
 * Seeded random number generator for deterministic puzzle generation
 * Uses a simple mulberry32 PRNG algorithm
 */

import { useMemo } from 'react';
import type { SeededRandom } from './types';

// Mulberry32 PRNG - simple, fast, good distribution
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRandom(seed: number): SeededRandom {
  const random = mulberry32(seed);

  return {
    next: random,

    nextInt: (min: number, max: number): number => {
      return Math.floor(random() * (max - min + 1)) + min;
    },

    shuffle: <T>(array: T[]): T[] => {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },

    pick: <T>(array: T[]): T => {
      return array[Math.floor(random() * array.length)];
    },
  };
}

/**
 * Hook to create a seeded random generator for minigames
 * The same seed will always produce the same sequence of random numbers
 */
export function useMinigameSeed(seed: number): SeededRandom {
  return useMemo(() => createSeededRandom(seed), [seed]);
}

/**
 * Generate a random seed for new transmissions
 */
export function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

export { createSeededRandom };
