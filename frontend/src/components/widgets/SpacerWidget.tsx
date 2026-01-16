import type { WidgetRendererProps } from '../../types';

/**
 * SpacerWidget - A completely invisible widget for layout spacing.
 *
 * Useful for creating gaps in panel layouts without any visual elements.
 * For a visible line separator, use the DividerWidget instead.
 */
export function SpacerWidget(_props: WidgetRendererProps) {
  return <div className="spacer-widget" />;
}
