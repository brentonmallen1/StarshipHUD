import type { WidgetRendererProps } from '../../types';
import './PhaseBarsWidget.css';

interface PhaseBarsConfig {
  bar_count?: number;
  bar_width?: number;
  speed?: number;
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  base_opacity?: number;
  glow?: 'low' | 'medium' | 'high';
  thickness?: number;
  show_grid?: boolean;
  hide_border?: boolean;
  duration_variance?: number;
  delay_variance?: number;
}

const GLOW_MAP = {
  low: '0 0 4px var(--bar-color)',
  medium: '0 0 8px var(--bar-color), 0 0 20px var(--bar-color)',
  high: '0 0 12px var(--bar-color), 0 0 30px var(--bar-color), 0 0 50px var(--bar-color)',
} as const;

export function PhaseBarsWidget({ instance }: WidgetRendererProps) {
  const config = instance.config as PhaseBarsConfig;

  // Config with defaults
  const barCount = Math.max(1, Math.min(10, config.bar_count ?? 4));
  const barWidth = Math.max(5, Math.min(50, config.bar_width ?? 15));
  const speed = Math.max(1, Math.min(10, config.speed ?? 3));
  const orientation = config.orientation ?? 'horizontal';
  const color = config.color ?? '#00d4ff';
  const baseOpacity = Math.max(0, Math.min(1, config.base_opacity ?? 1));
  const glow = config.glow ?? 'medium';
  const thickness = Math.max(10, Math.min(100, config.thickness ?? 100));
  const showGrid = config.show_grid ?? false;
  const durationVariance = config.duration_variance ?? 0.2; // Default has some variance
  const delayVariance = config.delay_variance ?? 0;

  // Generate bars with phase offsets and opacity variance
  const bars = Array.from({ length: barCount }, (_, i) => {
    // Vary speed per bar based on config variance (centered around base speed)
    const varianceSeed = (((i * 7) % 10) / 10); // 0-1 range, deterministic per bar
    const speedVarianceFactor = 1 + (durationVariance * (varianceSeed - 0.5) * 2);
    const barSpeed = speed * speedVarianceFactor;
    // Opacity varies from 0.4 to 1.0 based on index, scaled by base opacity
    const relativeOpacity = 0.4 + (0.6 * ((i + 1) / barCount));
    const opacity = relativeOpacity * baseOpacity;
    // Stagger animation delay to create phase offset effect
    const baseDelay = (i / barCount) * speed * speedVarianceFactor;
    const extraDelay = delayVariance > 0 ? speed * delayVariance * varianceSeed : 0;
    const delay = baseDelay + extraDelay;

    return {
      index: i,
      barSpeed,
      opacity,
      delay,
    };
  });

  const classes = [
    'phase-bars-widget',
    `phase-bars--${orientation}`,
    showGrid && 'phase-bars--grid',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={
        {
          '--bar-color': color,
          '--bar-glow': GLOW_MAP[glow],
          '--bar-width': barWidth,
          '--bar-thickness': thickness,
        } as React.CSSProperties
      }
    >
      {bars.map((bar) => (
        <div
          key={bar.index}
          className="phase-bars__bar"
          style={
            {
              '--bar-speed': `${bar.barSpeed}s`,
              '--bar-opacity': bar.opacity,
              '--bar-delay': `-${bar.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
