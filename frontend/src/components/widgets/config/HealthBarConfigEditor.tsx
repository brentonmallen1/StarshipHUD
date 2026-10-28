import type { HealthBarConfig, WidgetConfigEditorProps } from '../../../types';
import { HEALTH_BAR_DEFAULTS } from '../../../types';
import { CheckboxField, NumberField, SelectField, ORIENTATION_OPTIONS, ORIENTATION_HINT } from './fields';

export function HealthBarConfigEditor({ config, onChange }: WidgetConfigEditorProps<HealthBarConfig>) {
  const c = { ...HEALTH_BAR_DEFAULTS, ...config };
  return (
    <>
      <SelectField
        label="Orientation"
        value={c.orientation}
        options={ORIENTATION_OPTIONS}
        onChange={(orientation) => onChange({ orientation })}
        hint={ORIENTATION_HINT}
      />
      <CheckboxField
        label="Segmented display"
        checked={c.segmented}
        onChange={(segmented) => onChange({ segmented })}
        hint="Show discrete segments instead of a smooth fill bar"
      />
      {c.segmented && (
        <NumberField
          label="Segment Count"
          min={4}
          max={20}
          fallback={HEALTH_BAR_DEFAULTS.segment_count}
          value={c.segment_count}
          onChange={(segment_count) => onChange({ segment_count })}
          hint="Number of segments (4-20)"
        />
      )}
    </>
  );
}
