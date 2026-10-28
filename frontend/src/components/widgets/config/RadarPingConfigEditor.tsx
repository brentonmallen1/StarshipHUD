import type { RadarPingConfig, WidgetConfigEditorProps } from '../../../types';
import { RADAR_PING_DEFAULTS } from '../../../types';
import { NumberField, SelectField } from './fields';
import { FxColorSelect, FxFields, FxThicknessSelect } from './FxFields';

export function RadarPingConfigEditor({ config, onChange }: WidgetConfigEditorProps<RadarPingConfig>) {
  const c = { ...RADAR_PING_DEFAULTS, ...config };
  const showsSweep = c.mode === 'sweep' || c.mode === 'both';
  const showsPulse = c.mode === 'pulse' || c.mode === 'both';
  return (
    <>
      <SelectField
        label="Mode"
        value={c.mode}
        options={[
          { value: 'both', label: 'Sweep + Pulse' },
          { value: 'sweep', label: 'Sweep Only' },
          { value: 'pulse', label: 'Pulse Only' },
        ]}
        onChange={(mode) => onChange({ mode })}
        hint="Rotating sweep line, expanding pulse rings, or both"
      />
      <FxColorSelect value={c.color} onChange={(color) => onChange({ color })} />
      {showsSweep && (
        <>
          <SelectField
            label="Rotation"
            value={c.direction}
            options={[
              { value: 'cw', label: 'Clockwise' },
              { value: 'ccw', label: 'Counter-clockwise' },
            ]}
            onChange={(direction) => onChange({ direction })}
          />
          <NumberField
            label="Rotation Speed (seconds)"
            min={1}
            max={20}
            step={0.5}
            fallback={RADAR_PING_DEFAULTS.speed}
            value={c.speed}
            onChange={(speed) => onChange({ speed })}
            hint="Seconds per full rotation"
          />
        </>
      )}
      {showsPulse && (
        <NumberField
          label="Ping Frequency (seconds)"
          min={0.5}
          max={10}
          step={0.5}
          fallback={RADAR_PING_DEFAULTS.ping_frequency}
          value={c.ping_frequency}
          onChange={(ping_frequency) => onChange({ ping_frequency })}
          hint="Seconds between expanding ping rings"
        />
      )}
      <FxThicknessSelect thickPx={3} value={c.thickness} onChange={(thickness) => onChange({ thickness })} />
      <FxFields
        values={c}
        onChange={onChange}
        effectHint="Secondary animation applied to the sweep beam"
        gridHint="Concentric circles and crosshair lines"
      />
    </>
  );
}
