/**
 * Shared status color and threshold constants for gauge widgets.
 */

export const STATUS_COLORS: Record<string, string> = {
  optimal: '#00ffcc',
  operational: '#3fb950',
  degraded: '#d4a72c',
  compromised: '#db6d28',
  critical: '#f85149',
  destroyed: '#8b0000',
  offline: '#6e7681',
};

export const STATUS_THRESHOLDS = [
  { pct: 100, status: 'optimal' },
  { pct: 80, status: 'operational' },
  { pct: 60, status: 'degraded' },
  { pct: 40, status: 'compromised' },
  { pct: 1, status: 'critical' },
  { pct: 0, status: 'destroyed' },
] as const;
