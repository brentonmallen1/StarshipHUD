/**
 * Shared timer duration formatting.
 *
 * Call sites intentionally differ in presentation (the player timer bar pads
 * minutes, the compact GM floater does not, the widget pads hours, the admin
 * table uses words), so those differences are options rather than copies.
 */

export interface DurationFormatOptions {
  /**
   * 'clock'   → `MM:SS` / `H:MM:SS` (default)
   * 'verbose' → `1h 2m 3s` / `2m 3s` / `3s`
   */
  style?: 'clock' | 'verbose';
  /** Clock style: zero-pad minutes when there are no hours (`05:09` vs `5:09`). Default true. */
  padMinutes?: boolean;
  /** Clock style: zero-pad the hour field (`01:02:03` vs `1:02:03`). Default false. */
  padHours?: boolean;
  /** Clock style: always render the hour field, even when zero. Default false. */
  forceHours?: boolean;
  /** Text returned when a countdown has run out. Default `00:00` (`Expired` for verbose). */
  expiredText?: string;
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

function formatSeconds(totalSeconds: number, prefix: string, opts: DurationFormatOptions): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (opts.style === 'verbose') {
    if (hours > 0) return `${prefix}${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${prefix}${minutes}m ${seconds}s`;
    return `${prefix}${seconds}s`;
  }

  const { padMinutes = true, padHours = false, forceHours = false } = opts;
  if (hours > 0 || forceHours) {
    return `${prefix}${padHours ? pad2(hours) : hours}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${prefix}${padMinutes ? pad2(minutes) : minutes}:${pad2(seconds)}`;
}

/** Format milliseconds remaining on a countdown (rounds up to the next second). */
export function formatRemainingMs(ms: number, opts: DurationFormatOptions = {}): string {
  if (ms <= 0) return opts.expiredText ?? (opts.style === 'verbose' ? 'Expired' : '00:00');
  return formatSeconds(Math.ceil(ms / 1000), '', opts);
}

/** Format milliseconds elapsed on a count-up timer, prefixed with `+` (rounds down). */
export function formatElapsedMs(ms: number, opts: DurationFormatOptions = {}): string {
  if (ms < 0) return opts.style === 'verbose' ? '+0s' : '+00:00';
  return formatSeconds(Math.floor(ms / 1000), '+', opts);
}

/** Reference "now" for a timer: the pause instant when paused, otherwise the wall clock. */
function timerNow(pausedAt?: string | null): number {
  return pausedAt ? new Date(pausedAt).getTime() : Date.now();
}

/** Format time remaining until `endTime` (frozen at `pausedAt` when paused). */
export function formatRemaining(
  endTime: string,
  pausedAt?: string | null,
  opts?: DurationFormatOptions,
): string {
  return formatRemainingMs(new Date(endTime).getTime() - timerNow(pausedAt), opts);
}

/** Format time elapsed since `startTime` (frozen at `pausedAt` when paused). */
export function formatElapsed(
  startTime: string,
  pausedAt?: string | null,
  opts?: DurationFormatOptions,
): string {
  return formatElapsedMs(timerNow(pausedAt) - new Date(startTime).getTime(), opts);
}
