import type { ScanLineConfig, WidgetConfigEditorProps } from '../../../types';
import { SCAN_LINE_DEFAULTS } from '../../../types';
import { NumberField, SelectField } from './fields';
import { FxColorSelect, FxFields, FxThicknessSelect } from './FxFields';

export function ScanLineConfigEditor({ config, onChange }: WidgetConfigEditorProps<ScanLineConfig>) {
  const c = { ...SCAN_LINE_DEFAULTS, ...config };
  return (
    <>
      <FxColorSelect value={c.color} onChange={(color) => onChange({ color })} />
      <SelectField
        label="Direction"
        value={c.direction}
        options={[
          { value: 'down', label: 'Down' },
          { value: 'up', label: 'Up' },
          { value: 'right', label: 'Right' },
          { value: 'left', label: 'Left' },
        ]}
        onChange={(direction) => onChange({ direction })}
      />
      <NumberField
        label="Sweep Speed (seconds)"
        min={1}
        max={20}
        step={0.5}
        fallback={SCAN_LINE_DEFAULTS.speed}
        value={c.speed}
        onChange={(speed) => onChange({ speed })}
        hint="Seconds per full sweep cycle"
      />
      <FxThicknessSelect thickPx={4} value={c.thickness} onChange={(thickness) => onChange({ thickness })} />
      <FxFields
        values={c}
        onChange={onChange}
        effectHint="Secondary animation applied to the beam"
        gridLabel="Show grid lines"
        gridHint="Faint horizontal grid lines for sci-fi texture"
      />
    </>
  );
}
