import type { WidgetRendererProps } from '../../types';
import './DividerWidget.css';

/**
 * DividerWidget - A visible horizontal separator line.
 *
 * For an invisible spacer, use the SpacerWidget instead.
 */
export function DividerWidget(_props: WidgetRendererProps) {
  return (
    <div className="divider-widget">
      <div className="divider-line" />
    </div>
  );
}
