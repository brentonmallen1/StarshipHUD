import type { WaveformConfig, WidgetConfigEditorProps } from '../../../types';
import { WAVEFORM_DEFAULTS } from '../../../types';
import { CheckboxField, SelectField } from './fields';

export function WaveformConfigEditor({ config, onChange }: WidgetConfigEditorProps<WaveformConfig>) {
  const c = { ...WAVEFORM_DEFAULTS, ...config };
  return (
    <>
      <SelectField
        label="Wave Type"
        value={c.wave_type}
        options={[
          { value: 'sine', label: 'Sine' },
          { value: 'sawtooth', label: 'Sawtooth' },
          { value: 'square', label: 'Square' },
          { value: 'pulse', label: 'Pulse' },
          { value: 'heartbeat', label: 'Heartbeat' },
        ]}
        onChange={(wave_type) => onChange({ wave_type })}
        hint="The waveform shape rendered on the oscilloscope (heartbeat shows ECG-style rhythm)"
      />
      <CheckboxField
        label="Show system name"
        checked={c.show_name}
        onChange={(show_name) => onChange({ show_name })}
        hint="Display the bound system name on the waveform"
      />
    </>
  );
}
