import type { TicksWidgetConfig, WidgetConfigEditorProps } from '../../../types';
import { TICKS_DEFAULTS } from '../../../types';
import { CheckboxField, NumberField, SelectField, TextField } from './fields';

export function TicksConfigEditor({ config, onChange }: WidgetConfigEditorProps<TicksWidgetConfig>) {
  const c = { ...TICKS_DEFAULTS, ...config };
  const filled = Math.min(c.filled_count, c.tick_count);
  return (
    <>
      <TextField
        label="Title (Optional)"
        value={c.title ?? ''}
        onChange={(title) => onChange({ title: title || undefined })}
        placeholder="e.g., Stress, Fuel, Charges"
        hint="Label displayed above the ticks"
      />
      <NumberField
        label="Number of Ticks"
        min={1}
        max={20}
        fallback={TICKS_DEFAULTS.tick_count}
        value={c.tick_count}
        onChange={(n) => {
          const tick_count = Math.min(20, Math.max(1, n));
          onChange({ tick_count, filled_count: Math.min(c.filled_count, tick_count) });
        }}
        hint="How many tick segments to display (1-20)"
      />
      <NumberField
        label="Initially Filled"
        min={0}
        max={c.tick_count}
        fallback={0}
        value={filled}
        onChange={(n) => onChange({ filled_count: Math.min(c.tick_count, Math.max(0, n)) })}
        hint={`Number of ticks filled at start (0-${c.tick_count})`}
      />
      <SelectField
        label="Tick Size"
        value={c.tick_size}
        options={[
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ]}
        onChange={(tick_size) => onChange({ tick_size })}
        hint="Size of each tick segment"
      />
      <SelectField
        label="Widget Orientation"
        value={c.orientation}
        options={[
          { value: 'horizontal', label: 'Horizontal (fill left-to-right)' },
          { value: 'vertical', label: 'Vertical (fill top-to-bottom)' },
        ]}
        onChange={(orientation) => onChange({ orientation })}
        hint="Direction ticks flow and fill"
      />
      <SelectField
        label="Color"
        value={c.color}
        options={[
          { value: 'secondary', label: 'Secondary (amber)' },
          { value: 'primary', label: 'Primary (cyan)' },
          ...(c.color !== 'primary' && c.color !== 'secondary' ? [{ value: c.color, label: `Custom (${c.color})` }] : []),
        ]}
        onChange={(color) => onChange({ color })}
        hint="Color theme for the ticks"
      />
      <CheckboxField
        label="Allow click to edit"
        checked={c.editable}
        onChange={(editable) => onChange({ editable })}
        hint="When enabled, players can click ticks to fill/unfill them"
      />
    </>
  );
}
