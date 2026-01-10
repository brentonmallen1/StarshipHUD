import type { WidgetRendererProps } from '../../types';

/**
 * InvisibleSpacerWidget - A completely invisible widget for layout spacing.
 *
 * Unlike the regular SpacerWidget, this has no visible border or line.
 * Useful for creating gaps in panel layouts without any visual elements.
 */
export function InvisibleSpacerWidget(_props: WidgetRendererProps) {
  return <div className="invisible-spacer-widget" />;
}
