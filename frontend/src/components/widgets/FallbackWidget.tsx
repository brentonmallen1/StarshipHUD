import type { WidgetRendererProps } from '../../types';

export function FallbackWidget({ instance }: WidgetRendererProps) {
  return (
    <div className="fallback-widget">
      <span className="fallback-type">{instance.widget_type}</span>
      <span className="fallback-message">Widget not implemented</span>
    </div>
  );
}
