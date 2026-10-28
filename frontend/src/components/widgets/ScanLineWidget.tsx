import { useMemo } from 'react';
import type { WidgetRendererProps } from '../../types';
import './ScanLineWidget.css';
import { hashString } from '../../utils/hash';
import { getConfig, SCAN_LINE_DEFAULTS, type ScanLineConfig } from '../../types';

const THICKNESS_MAP = { thin: '1px', normal: '2px', thick: '4px' } as const;
const TRAIL_MAP = { thin: '20px', normal: '40px', thick: '60px' } as const;
const GLOW_MAP = {
  low: '0 0 4px var(--scan-color)',
  medium: '0 0 8px var(--scan-color), 0 0 20px var(--scan-color)',
  high: '0 0 12px var(--scan-color), 0 0 30px var(--scan-color), 0 0 50px var(--scan-color)',
} as const;

export function ScanLineWidget({ instance }: WidgetRendererProps) {
  const config = getConfig<ScanLineConfig>(instance.config);
  const D = SCAN_LINE_DEFAULTS;
  const baseSpeed = config.speed ?? D.speed;
  const color = config.color ?? D.color;
  const direction = config.direction ?? D.direction;
  const glow = config.glow ?? D.glow;
  const thickness = config.thickness ?? D.thickness;
  const effect = config.effect ?? D.effect;
  const showGrid = config.show_grid ?? D.show_grid;
  const durationVariance = config.duration_variance ?? D.duration_variance;
  const delayVariance = config.delay_variance ?? D.delay_variance;

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
