import type { WidgetRendererProps } from '../../types';
import './DividerWidget.css';

/**
 * Divider Widget
 *
 * A layout widget that renders a horizontal or vertical separator line.
 * Supports multiple styles: solid, dashed, double, and glow.
 *
 * Config options:
 * - orientation: 'horizontal' | 'vertical' (default: 'horizontal')
 * - style: 'solid' | 'dashed' | 'double' | 'glow' (default: 'solid')
 * - thickness: number in pixels (default: 1)
 * - opacity: 0-1 (default: 0.3)
 * - color: optional CSS color value
 */
export function DividerWidget({ instance }: WidgetRendererProps) {
  const orientation = (instance.config?.orientation as string) ?? 'horizontal';
  const style = (instance.config?.style as string) ?? 'solid';
  const thickness = (instance.config?.thickness as number) ?? 1;
  const opacity = (instance.config?.opacity as number) ?? 0.3;
  const color = instance.config?.color as string | undefined;

  const cssVars = {
    '--divider-thickness': `${thickness}px`,
    '--divider-opacity': opacity,
    ...(color && { '--divider-color': color }),
  } as React.CSSProperties;

  return (
    <div
      className={`divider-widget divider-${orientation} divider-style-${style}`}
      style={cssVars}
    >
      <div className="divider-line" />
      {style === 'double' && <div className="divider-line divider-line-second" />}
    </div>
  );
}
