/**
 * Deterministic pseudo-random value in [0, 1) derived from a string.
 *
 * Used to give each widget instance / crew member a stable animation offset
 * or variance so identical widgets don't pulse in lockstep.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}
