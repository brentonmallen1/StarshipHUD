import type { ArcGaugeConfig, WidgetConfigEditorProps } from '../../../types';
import { ARC_GAUGE_DEFAULTS } from '../../../types';
import { CheckboxField, SelectField } from './fields';

export function ArcGaugeConfigEditor({ config, onChange }: WidgetConfigEditorProps<ArcGaugeConfig>) {
  const c = { ...ARC_GAUGE_DEFAULTS, ...config };
  return (
    <>
      <SelectField
        label="Arc Sweep"
        value={c.sweep}
        options={[
          { value: 180, label: 'Semicircle (180°)' },
          { value: 270, label: 'Three-quarter (270°)' },
        ]}
        onChange={(sweep) => onChange({ sweep })}
        hint="The angular sweep of the gauge arc"
      />
      <CheckboxField
        label="Segmented display"
        checked={c.show_ticks}
        onChange={(show_ticks) => onChange({ show_ticks })}
        hint="Show discrete segments with gaps between status zones"
      />
    </>
  );
}
