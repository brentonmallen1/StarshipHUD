import { useMemo } from 'react';
import type { WidgetRendererProps } from '../../types';
import './ScanLineWidget.css';

interface ScanLineConfig {
  speed?: number;
  color?: string;
  direction?: 'down' | 'up' | 'left' | 'right';
  glow?: 'low' | 'medium' | 'high';
  thickness?: 'thin' | 'normal' | 'thick';
  effect?: 'none' | 'flicker' | 'jitter' | 'pulse' | 'strobe';
  show_grid?: boolean;
  duration_variance?: number;
  delay_variance?: number;
}

const THICKNESS_MAP = { thin: '1px', normal: '2px', thick: '4px' } as const;
const TRAIL_MAP = { thin: '20px', normal: '40px', thick: '60px' } as const;
const GLOW_MAP = {
  low: '0 0 4px var(--scan-color)',
  medium: '0 0 8px var(--scan-color), 0 0 20px var(--scan-color)',
  high: '0 0 12px var(--scan-color), 0 0 30px var(--scan-color), 0 0 50px var(--scan-color)',
} as const;

/** Generate deterministic pseudo-random value from string (0-1 range) */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}

export function ScanLineWidget({ instance }: WidgetRendererProps) {
  const config = instance.config as ScanLineConfig;
  const baseSpeed = config.speed ?? 4;
  const color = config.color ?? 'var(--color-accent-cyan, #00d4ff)';
  const direction = config.direction ?? 'down';
  const glow = config.glow ?? 'medium';
  const thickness = config.thickness ?? 'normal';
  const effect = config.effect ?? 'none';
  const showGrid = config.show_grid ?? true;
  const durationVariance = config.duration_variance ?? 0;
  const delayVariance = config.delay_variance ?? 0;

  // Compute variance based on widget instance ID (deterministic)
  const { actualSpeed, actualDelay } = useMemo(() => {
    const seed = hashString(instance.id);
    const varianceFactor = 1 + (durationVariance * (seed - 0.5) * 2);
    const speed = baseSpeed * varianceFactor;
    const delay = delayVariance > 0 ? baseSpeed * delayVariance * seed : 0;
    return { actualSpeed: speed, actualDelay: delay };
  }, [instance.id, baseSpeed, durationVariance, delayVariance]);

  const classes = [
    'scan-line-widget',
    `scan-line--${direction}`,
    !showGrid && 'scan-line--no-grid',
    effect !== 'none' && `scan-line--fx-${effect}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={
        {
          '--scan-speed': `${actualSpeed}s`,
          '--scan-delay': `-${actualDelay}s`,
          '--scan-color': color,
          '--scan-thickness': THICKNESS_MAP[thickness],
          '--scan-trail-size': TRAIL_MAP[thickness],
          '--scan-glow': GLOW_MAP[glow],
        } as React.CSSProperties
      }
    >
      <div className="scan-line__beam" />
    </div>
  );
}
