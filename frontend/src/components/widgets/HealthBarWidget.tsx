import type { WidgetRendererProps } from '../../types';

export function HealthBarWidget({ instance, systemStates }: WidgetRendererProps) {
  const systemId = instance.bindings.system_state_id;
  const system = systemId ? systemStates.get(systemId) : null;

  const title = (instance.config.title as string) ?? system?.name ?? 'Unknown';
  const value = system?.value ?? 0;
  const maxValue = system?.max_value ?? 100;
  const unit = system?.unit ?? '%';
  const status = system?.status ?? 'offline';

  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="health-bar-widget">
      <div className="health-bar-header">
        <span className="health-bar-title">{title}</span>
        <span className={`health-bar-value status-${status}`}>
          {value}{unit}
        </span>
      </div>

      <div className="health-bar-container">
        <div
          className={`health-bar-fill ${status}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className={`health-bar-status status-${status}`}>
        <span className={`status-dot status-${status}`} style={{ backgroundColor: 'currentColor' }} />
        <span>{status.toUpperCase()}</span>
      </div>
    </div>
  );
}
