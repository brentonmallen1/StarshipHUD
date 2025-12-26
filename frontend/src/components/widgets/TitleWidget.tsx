import type { WidgetRendererProps } from '../../types';

export function TitleWidget({ instance }: WidgetRendererProps) {
  const text = (instance.config.text as string) ?? 'Untitled';

  return (
    <div className="widget-title-display">
      <h2 className="widget-title-text">{text}</h2>
    </div>
  );
}
