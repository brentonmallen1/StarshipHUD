import type { WidgetInstance, SystemState } from '../../types';
import { getWidgetType } from './widgetRegistry';
import { FallbackWidget } from './FallbackWidget';
import { ErrorBoundary } from '../ErrorBoundary';
import './widgets.css';

interface Props {
  instance: WidgetInstance;
  systemStates: Map<string, SystemState>;
  isEditing: boolean;
  isSelected: boolean;
  canEditData: boolean;
  onConfigChange?: (config: Record<string, unknown>) => void;
}

export function WidgetRenderer({ instance, systemStates, isEditing, isSelected, canEditData, onConfigChange }: Props) {
  const widgetType = getWidgetType(instance.widget_type);
  const WidgetComponent = widgetType?.Renderer ?? FallbackWidget;

  const hideBorder = instance.config?.hide_border === true;

  return (
    <div className={`widget ${isSelected ? 'selected' : ''}${hideBorder ? ' widget--no-border' : ''}`} data-widget-type={instance.widget_type}>
      <ErrorBoundary level="widget" widgetType={widgetType?.name ?? instance.widget_type}>
        <WidgetComponent
          instance={instance}
          systemStates={systemStates}
          isEditing={isEditing}
          isSelected={isSelected}
          canEditData={canEditData}
          onConfigChange={onConfigChange}
        />
      </ErrorBoundary>
      {instance.label && (
        <div className="widget-custom-label">{instance.label}</div>
      )}
      {isEditing && widgetType && (
        <div className="widget-type-label">{widgetType.name}</div>
      )}
    </div>
  );
}
