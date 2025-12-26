import type { WidgetRendererProps } from '../../types';
import './SpacerWidget.css';

export function SpacerWidget({ instance }: WidgetRendererProps) {
  const size = (instance.config.size as string) ?? 'medium';

  return (
    <div className={`spacer-widget spacer-${size}`}>
      <div className="spacer-line" />
    </div>
  );
}
