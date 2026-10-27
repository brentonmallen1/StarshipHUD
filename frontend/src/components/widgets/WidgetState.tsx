import type { ReactNode } from 'react';
import './WidgetState.css';

export type WidgetStateKind = 'loading' | 'error' | 'empty';

interface WidgetStateProps {
  kind: WidgetStateKind;
  /** Readout text, e.g. "Acquiring contacts" / "Sensor link lost" / "No active tasks". */
  message?: ReactNode;
  /** Optional secondary line or action (e.g. a "Create" button for empty states). */
  children?: ReactNode;
  /** Tighter variant for small widgets. */
  compact?: boolean;
}

/** Glyph paired with colour so the state never relies on colour alone. */
const GLYPH: Record<WidgetStateKind, string> = {
  loading: '◌',
  error: '◆',
  empty: '○',
};

const DEFAULT_MESSAGE: Record<WidgetStateKind, string> = {
  loading: 'Establishing link',
  error: 'Link failure',
  empty: 'No data',
};

/**
 * Diegetic loading / error / empty readout shared by data-backed widgets.
 * Fills the space it is given and never scrolls.
 */
export function WidgetState({ kind, message, children, compact = false }: WidgetStateProps) {
  return (
    <div
      className={`widget-state widget-state--${kind}${compact ? ' widget-state--compact' : ''}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
    >
      <span className="widget-state__glyph" aria-hidden="true">
        {GLYPH[kind]}
      </span>
      <span className="widget-state__message">{message ?? DEFAULT_MESSAGE[kind]}</span>
      {kind === 'loading' && <span className="widget-state__scan" aria-hidden="true" />}
      {children && <div className="widget-state__extra">{children}</div>}
    </div>
  );
}
