import type { WidgetRendererProps } from '../../types';
import { getConfig, PHASE_BARS_DEFAULTS, type PhaseBarsConfig } from '../../types';
import './PhaseBarsWidget.css';

const GLOW_MAP = {
  low: '0 0 4px var(--bar-color)',
  medium: '0 0 8px var(--bar-color), 0 0 20px var(--bar-color)',
  high: '0 0 12px var(--bar-color), 0 0 30px var(--bar-color), 0 0 50px var(--bar-color)',
} as const;

export function PhaseBarsWidget({ instance }: WidgetRendererProps) {
  const config = getConfig<PhaseBarsConfig>(instance.config);
  const D = PHASE_BARS_DEFAULTS;

  // Config with defaults
  const barCount = Math.max(1, Math.min(10, config.bar_count ?? D.bar_count));
  const barWidth = Math.max(5, Math.min(50, config.bar_width ?? D.bar_width));
  const speed = Math.max(1, Math.min(10, config.speed ?? D.speed));
  const orientation = config.orientation ?? D.orientation;
  const color = config.color ?? D.color;
  const baseOpacity = Math.max(0, Math.min(1, config.base_opacity ?? D.base_opacity));
  const glow = config.glow ?? D.glow;
  const thickness = Math.max(10, Math.min(100, config.thickness ?? D.thickness));
  const showGrid = config.show_grid ?? D.show_grid;
  const durationVariance = config.duration_variance ?? D.duration_variance; // Default has some variance
  const delayVariance = config.delay_variance ?? D.delay_variance;

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
