import type { WidgetRendererProps } from '../../types';

export function StatusDisplayWidget({ instance, systemStates }: WidgetRendererProps) {
  const systemId = instance.bindings.system_state_id;
  const system = systemId ? systemStates.get(systemId) : null;

  const title = (instance.config.title as string) ?? system?.name ?? 'Unknown';
  const value = system?.value ?? 0;
  const unit = system?.unit ?? '%';
  const status = system?.status ?? 'offline';

  return (
    <div className="status-display-widget">
      <span className="status-display-title">{title}</span>
      <div className="status-display-content">
        <span className={`status-display-value status-${status}`}>
          {value}{unit}
        </span>
        <span className={`status-display-label status-${status}`}>
          {status}
        </span>
      </div>
    </div>
  );
}
