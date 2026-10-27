/**
 * Single source of truth for system-status presentation.
 *
 * CLAUDE.md rule: status is always communicated by colour + shape, never by
 * colour alone, and colours come from the `--color-{status}` design tokens.
 */

import type { SystemState, SystemStatus } from '../types';

export type StatusShape = 'circle' | 'triangle' | 'diamond' | 'x' | 'hollow';

export interface StatusMeta {
  /** Human-readable label ("Operational"). Upper-case it in CSS/JS for HUD readouts. */
  label: string;
  /** Three-letter readout code used where space is tight ("OPR"). */
  code: string;
  /** CSS custom property holding the colour, e.g. `--color-operational`. */
  cssVar: `--color-${SystemStatus}`;
  /** Documented token value, used when the CSS variable can't be read (canvas before styles load). */
  hex: string;
  /** Icon shape paired with the colour (`.status-icon-{shape}`). */
  shape: StatusShape;
  /** Display order, best → worst, with offline last. */
  order: number;
  /**
   * Health rank for comparisons (lower = worse). Matches the backend cascade,
   * where an offline parent is treated as better than a degraded one.
   */
  severity: number;
}

export const STATUS_META: Record<SystemStatus, StatusMeta> = {
  optimal:     { label: 'Optimal',     code: 'OPT', cssVar: '--color-optimal',     hex: '#00ffcc', shape: 'circle',   order: 0, severity: 6 },
  operational: { label: 'Operational', code: 'OPR', cssVar: '--color-operational', hex: '#3fb950', shape: 'circle',   order: 1, severity: 5 },
  degraded:    { label: 'Degraded',    code: 'DGR', cssVar: '--color-degraded',    hex: '#d4a72c', shape: 'triangle', order: 2, severity: 3 },
  compromised: { label: 'Compromised', code: 'CMP', cssVar: '--color-compromised', hex: '#db6d28', shape: 'diamond',  order: 3, severity: 2 },
  critical:    { label: 'Critical',    code: 'CRT', cssVar: '--color-critical',    hex: '#f85149', shape: 'diamond',  order: 4, severity: 1 },
  destroyed:   { label: 'Destroyed',   code: 'DST', cssVar: '--color-destroyed',   hex: '#8b0000', shape: 'x',        order: 5, severity: 0 },
  offline:     { label: 'Offline',     code: 'OFF', cssVar: '--color-offline',     hex: '#6e7681', shape: 'hollow',   order: 6, severity: 4 },
};

/** All statuses in display order (best → worst, offline last). */
export const STATUS_ORDER: SystemStatus[] = (Object.keys(STATUS_META) as SystemStatus[]).sort(
  (a, b) => STATUS_META[a].order - STATUS_META[b].order,
);

export function isSystemStatus(value: unknown): value is SystemStatus {
  return typeof value === 'string' && value in STATUS_META;
}

/** Metadata for a status, falling back to offline for unknown values. */
export function getStatusMeta(status: string | null | undefined): StatusMeta {
  return isSystemStatus(status) ? STATUS_META[status] : STATUS_META.offline;
}

export function getStatusLabel(status: string | null | undefined): string {
  return getStatusMeta(status).label;
}

export function getStatusShape(status: string | null | undefined): StatusShape {
  return getStatusMeta(status).shape;
}

/** `var(--color-{status})` for use in CSS / inline styles / SVG attributes. */
export function statusCssColor(status: string | null | undefined): string {
  return `var(${getStatusMeta(status).cssVar})`;
}

const resolvedCache = new Map<string, string>();

/**
 * Concrete colour for a status, for canvas and other places that can't use
 * `var()`. Reads the design token from the document so theme overrides win,
 * and falls back to the documented hex value.
 */
export function resolveStatusColor(status: string | null | undefined): string {
  const meta = getStatusMeta(status);
  const cached = resolvedCache.get(meta.cssVar);
  if (cached) return cached;
  if (typeof document === 'undefined') return meta.hex;
  const value = getComputedStyle(document.documentElement).getPropertyValue(meta.cssVar).trim();
  if (!value) return meta.hex; // styles not loaded yet; don't cache
  resolvedCache.set(meta.cssVar, value);
  return value;
}

/**
 * The status to display for a system: its dependency-capped effective status,
 * else its own status, else `fallback`.
 */
export function getEffectiveStatus(
  system: Pick<SystemState, 'status' | 'effective_status'> | null | undefined,
  fallback: SystemStatus = 'offline',
): SystemStatus {
  return system?.effective_status ?? system?.status ?? fallback;
}
