import { useShip } from '../../hooks/useShipData';
import type { WidgetRendererProps } from '../../types';
import { getConfig, type TitleConfig } from '../../types';

export function TitleWidget({ instance }: WidgetRendererProps) {
  const { data: ship } = useShip();

  let text = getConfig<TitleConfig>(instance.config).text || 'Untitled';

  // Replace {{ship_name}} placeholder with actual ship name
  if (text.includes('{{ship_name}}') && ship?.name) {
    text = text.replace(/\{\{ship_name\}\}/g, ship.name);
  }

  return (
    <div className="widget-title-display">
      <h2 className="widget-title-text">{text}</h2>
    </div>
  );
}
