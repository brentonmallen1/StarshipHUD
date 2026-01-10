import type { WidgetRendererProps } from '../../types';
import './SpacerWidget.css';

/**
 * SpacerWidget - A visible spacer with border and divider line.
 *
 * For a completely invisible spacer, use the InvisibleSpacerWidget instead.
 */
export function SpacerWidget(_props: WidgetRendererProps) {
  return (
    <div className="spacer-widget">
      <div className="spacer-line" />
    </div>
  );
}
