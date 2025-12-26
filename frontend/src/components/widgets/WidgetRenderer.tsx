import type { WidgetInstance, SystemState } from '../../types';
import { getWidgetType } from './widgetRegistry';
import { FallbackWidget } from './FallbackWidget';
import './widgets.css';

interface Props {
  instance: WidgetInstance;
  systemStates: Map<string, SystemState>;
  isEditing: boolean;
  isSelected: boolean;
  canEditData: boolean;
}

export function WidgetRenderer({ instance, systemStates, isEditing, isSelected, canEditData }: Props) {
  const widgetType = getWidgetType(instance.widget_type);
  const WidgetComponent = widgetType?.Renderer ?? FallbackWidget;

  return (
    <div className={`widget ${isSelected ? 'selected' : ''}`} data-widget-type={instance.widget_type}>
      <WidgetComponent
        instance={instance}
        systemStates={systemStates}
        isEditing={isEditing}
        isSelected={isSelected}
        canEditData={canEditData}
      />
      {instance.label && (
        <div className="widget-custom-label">{instance.label}</div>
      )}
      {isEditing && widgetType && (
        <div className="widget-type-label">{widgetType.name}</div>
      )}
    </div>
  );
}
