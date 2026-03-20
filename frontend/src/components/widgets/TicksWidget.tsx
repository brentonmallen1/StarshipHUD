import { useState, useMemo, useCallback, useEffect } from 'react';
import type { WidgetRendererProps } from '../../types';
import { getConfig } from '../../types';
import type { TicksWidgetConfig } from '../../types';
import './TicksWidget.css';

/**
 * TicksWidget - Discrete progress tracker with toggleable parallelogram ticks
 *
 * Displays a grid of parallelogram-shaped ticks that can be clicked to fill/unfill.
 * Similar to progress clocks in Scum and Villainy but player-focused.
 *
 * Orientation:
 * - Horizontal: vertical parallelograms, fill left-to-right, wrap to rows
 * - Vertical: horizontal parallelograms, fill top-to-bottom, wrap to columns
 */
export function TicksWidget({
  instance,
  isEditing,
  canEditData,
  onConfigChange,
}: WidgetRendererProps) {
  const config = getConfig<TicksWidgetConfig>(instance.config);

  // Config with defaults
  const title = config.title ?? '';
  const tickCount = Math.min(Math.max(config.tick_count ?? 4, 1), 20);
  const configFilledCount = Math.min(Math.max(config.filled_count ?? 0, 0), tickCount);
  const tickSize = config.tick_size ?? 'medium';
  const color = config.color ?? 'secondary';
  const orientation = config.orientation ?? 'horizontal';
  const editable = config.editable ?? true;

  // Local state for immediate UI feedback
  const [localFilledCount, setLocalFilledCount] = useState(configFilledCount);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sync local state when config changes (e.g., from modal)
  useEffect(() => {
    setLocalFilledCount(configFilledCount);
  }, [configFilledCount]);

  // Compute CSS color value
  const colorValue = useMemo(() => {
    if (color === 'primary') return 'var(--theme-accent-primary)';
    if (color === 'secondary') return 'var(--theme-accent-secondary)';
    return color; // Custom color string
  }, [color]);

  // Handle tick click - toggle fill state with immediate feedback
  const handleTickClick = useCallback(
    (index: number) => {
      // Disable clicks when not editable, in editing mode, or when data editing is off
      if (!editable || isEditing || !canEditData || !onConfigChange) return;

      // If clicking a filled tick, unfill it and all after it
      // If clicking an unfilled tick, fill it and all before it
      const newFilledCount = index < localFilledCount ? index : index + 1;

      // Immediate local update for snappy feedback
      setLocalFilledCount(newFilledCount);

      // Persist to config in background
      onConfigChange({
        ...instance.config,
        filled_count: newFilledCount,
      });
    },
    [editable, localFilledCount, isEditing, canEditData, onConfigChange, instance.config]
  );

  // Compute which ticks are affected by hovering
  const getTickClasses = useCallback(
    (index: number, filled: boolean) => {
      const classes = ['ticks-widget__tick'];
      if (filled) classes.push('ticks-widget__tick--filled');

      // Only show hover effects when interactive
      if (hoveredIndex !== null && editable && canEditData && !isEditing) {
        const isHoveringUnfilled = hoveredIndex >= localFilledCount;

        if (isHoveringUnfilled) {
          // Hovering unfilled tick: all ticks from current fill to hovered will be filled
          if (index >= localFilledCount && index <= hoveredIndex) {
            classes.push('ticks-widget__tick--will-fill');
          }
        } else {
          // Hovering filled tick: all ticks from hovered to current fill will be unfilled
          if (index >= hoveredIndex && index < localFilledCount) {
            classes.push('ticks-widget__tick--will-unfill');
          }
        }
      }

      return classes.join(' ');
    },
    [hoveredIndex, localFilledCount, editable, canEditData, isEditing]
  );

  // Generate ticks array using local state for immediate feedback
  const ticks = useMemo(() => {
    return Array.from({ length: tickCount }, (_, i) => ({
      index: i,
      filled: i < localFilledCount,
    }));
  }, [tickCount, localFilledCount]);

  return (
    <div
      className={`ticks-widget ticks-widget--${orientation} ticks-widget--${tickSize}${isEditing ? ' ticks-widget--editing' : ''}`}
      style={{ '--tick-color': colorValue } as React.CSSProperties}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {title && <div className="ticks-widget__title">{title}</div>}
      <div className="ticks-widget__grid">
        {ticks.map((tick) => (
          <button
            key={tick.index}
            type="button"
            className={getTickClasses(tick.index, tick.filled)}
            onClick={() => handleTickClick(tick.index)}
            onMouseEnter={() => editable && canEditData && !isEditing && setHoveredIndex(tick.index)}
            disabled={!editable || isEditing || !canEditData}
            aria-label={`Tick ${tick.index + 1} of ${tickCount}, ${tick.filled ? 'filled' : 'empty'}`}
            aria-pressed={tick.filled}
          />
        ))}
      </div>
    </div>
  );
}
