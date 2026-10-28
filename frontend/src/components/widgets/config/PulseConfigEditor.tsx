import type { PulseConfig, WidgetConfigEditorProps } from '../../../types';
import { PULSE_DEFAULTS } from '../../../types';
import { NumberField, SelectField } from './fields';
import { FxColorSelect, FxFields, FxThicknessSelect } from './FxFields';

export function PulseConfigEditor({ config, onChange }: WidgetConfigEditorProps<PulseConfig>) {
  const c = { ...PULSE_DEFAULTS, ...config };
  return (
    <>
      <SelectField
        label="Pulse Origin"
        value={c.origin}
        options={[
          { value: 'top-left', label: 'Top Left' },
          { value: 'top', label: 'Top' },
          { value: 'top-right', label: 'Top Right' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'bottom-left', label: 'Bottom Left' },
          { value: 'bottom', label: 'Bottom' },
          { value: 'bottom-right', label: 'Bottom Right' },
        ]}
        onChange={(origin) => onChange({ origin })}
        hint="Edge or corner where pulse rings emanate from"
      />
      <FxColorSelect value={c.color} onChange={(color) => onChange({ color })} />
      <NumberField
        label="Ping Frequency (seconds)"
        min={0.5}
        max={10}
        step={0.5}
        fallback={PULSE_DEFAULTS.ping_frequency}
        value={c.ping_frequency}
        onChange={(ping_frequency) => onChange({ ping_frequency })}
        hint="Seconds between expanding pulse rings"
      />
      <FxThicknessSelect
        label="Ring Thickness"
        thickPx={3}
        value={c.thickness}
        onChange={(thickness) => onChange({ thickness })}
      />
      <FxFields
        values={c}
        onChange={onChange}
        effectHint="Secondary animation applied to the rings"
        gridHint="Faint concentric reference arcs from origin"
      />
    </>
  );
}
