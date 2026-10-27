import type { ShipLogConfig, WidgetConfigEditorProps } from '../../../types';
import { SHIP_LOG_DEFAULTS } from '../../../types';
import { NumberField } from './fields';

export function ShipLogConfigEditor({ config, onChange }: WidgetConfigEditorProps<ShipLogConfig>) {
  const c = { ...SHIP_LOG_DEFAULTS, ...config };
  return (
    <NumberField
      label="Events Loaded"
      min={10}
      max={500}
      step={10}
      fallback={SHIP_LOG_DEFAULTS.maxEvents}
      value={c.maxEvents}
      onChange={(n) => onChange({ maxEvents: Math.min(500, Math.round(n)) })}
      hint="How many of the most recent log entries the widget fetches (max 500)"
    />
  );
}
