import type { NumberDisplayConfig, WidgetConfigEditorProps } from '../../../types';
import { NUMBER_DISPLAY_DEFAULTS } from '../../../types';
import { CheckboxField, SelectField } from './fields';

export function NumberDisplayConfigEditor({ config, onChange }: WidgetConfigEditorProps<NumberDisplayConfig>) {
  const c = { ...NUMBER_DISPLAY_DEFAULTS, ...config };
  return (
    <>
      <SelectField
        label="Size"
        value={c.size}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'compact', label: 'Compact' },
        ]}
        onChange={(size) => onChange({ size })}
        hint="Compact size uses smaller fonts for tight spaces"
      />
      <CheckboxField
        label="Show max value"
        checked={c.show_max}
        onChange={(show_max) => onChange({ show_max })}
        hint="Display the maximum value (e.g., /100) next to the current value"
      />
      <CheckboxField
        label="Show unit"
        checked={c.show_unit}
        onChange={(show_unit) => onChange({ show_unit })}
        hint="Display the unit label (%, MW, etc.)"
      />
      <CheckboxField
        label="Show status label"
        checked={c.show_status}
        onChange={(show_status) => onChange({ show_status })}
        hint="Display the status text (OPTIMAL, CRITICAL, etc.)"
      />
      <CheckboxField
        label="Show title"
        checked={c.show_title}
        onChange={(show_title) => onChange({ show_title })}
        hint="Display the system name at the bottom"
      />
    </>
  );
}
