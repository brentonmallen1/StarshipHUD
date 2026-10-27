import type { PhaseBarsConfig, WidgetConfigEditorProps } from '../../../types';
import { ACCENT_COLOR, PHASE_BARS_DEFAULTS } from '../../../types';
import { NumberField, SelectField } from './fields';
import { FxFields } from './FxFields';
import './configEditors.css';

const HEX6 = /^#[0-9a-f]{6}$/i;

const SWATCHES = [
  { color: ACCENT_COLOR, label: 'Theme accent' },
  { color: '#00d4ff', label: 'Cyan' },
  { color: '#3fb950', label: 'Green' },
  { color: '#d4a72c', label: 'Amber' },
  { color: '#db6d28', label: 'Orange' },
  { color: '#f85149', label: 'Red' },
  { color: '#8957e5', label: 'Purple' },
  { color: '#e6edf3', label: 'White' },
];

/** `<input type="color">` only accepts #rrggbb; resolve `var(--x, #fallback)` for display. */
function toPickerHex(color: string): string {
  if (HEX6.test(color)) return color;
  const m = color.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (m) {
    const live = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
    if (HEX6.test(live)) return live;
    if (m[2] && HEX6.test(m[2].trim())) return m[2].trim();
  }
  return '#000000';
}

export function PhaseBarsConfigEditor({ config, onChange }: WidgetConfigEditorProps<PhaseBarsConfig>) {
  const c = { ...PHASE_BARS_DEFAULTS, ...config };
  const color: string = c.color;
  return (
    <>
      <NumberField
        label="Bar Count"
        min={1}
        max={10}
        step={1}
        fallback={PHASE_BARS_DEFAULTS.bar_count}
        value={c.bar_count}
        onChange={(bar_count) => onChange({ bar_count })}
        hint="Number of bouncing bars (1-10)"
      />
      <NumberField
        label="Bar Width (%)"
        min={5}
        max={50}
        step={5}
        fallback={PHASE_BARS_DEFAULTS.bar_width}
        value={c.bar_width}
        onChange={(bar_width) => onChange({ bar_width })}
        hint="Width of each bar as percentage of widget"
      />
      <NumberField
        label="Speed (seconds)"
        min={1}
        max={10}
        step={0.5}
        fallback={PHASE_BARS_DEFAULTS.speed}
        value={c.speed}
        onChange={(speed) => onChange({ speed })}
        hint="Base animation cycle duration"
      />
      <SelectField
        label="Orientation"
        value={c.orientation}
        options={[
          { value: 'horizontal', label: 'Horizontal (bars move up/down)' },
          { value: 'vertical', label: 'Vertical (bars move left/right)' },
        ]}
        onChange={(orientation) => onChange({ orientation })}
      />
      <div className="configure-section">
        <label className="configure-label">Color</label>
        <div className="config-swatches">
          {SWATCHES.map((s) => {
            const active = color.toLowerCase() === s.color.toLowerCase();
            return (
              <button
                key={s.color}
                type="button"
                title={s.label}
                aria-label={s.label}
                aria-pressed={active}
                className={`config-swatch${active ? ' config-swatch--active' : ''}`}
                style={{ backgroundColor: s.color }}
                onClick={() => onChange({ color: s.color })}
              />
            );
          })}
        </div>
        <div className="config-color-row">
          <input
            type="color"
            className="config-color-row__picker"
            value={toPickerHex(color)}
            onChange={(e) => onChange({ color: e.target.value })}
          />
          <input
            type="text"
            className="config-input config-color-row__text"
            value={color}
            onChange={(e) => onChange({ color: e.target.value })}
            placeholder={ACCENT_COLOR}
          />
        </div>
        <p className="field-hint">Pick a preset or custom color</p>
      </div>
      <div className="configure-section">
        <label className="configure-label">Base Opacity ({Math.round(c.base_opacity * 100)}%)</label>
        <input
          type="range"
          className="config-input config-input--full"
          min={0}
          max={1}
          step={0.05}
          value={c.base_opacity}
          onChange={(e) => onChange({ base_opacity: Number(e.target.value) })}
        />
        <p className="field-hint">Maximum opacity for bars (others scale relative to this)</p>
      </div>
      <div className="configure-section">
        <label className="configure-label">Thickness ({c.thickness}%)</label>
        <input
          type="range"
          className="config-input config-input--full"
          min={10}
          max={100}
          step={5}
          value={c.thickness}
          onChange={(e) => onChange({ thickness: Number(e.target.value) })}
        />
        <p className="field-hint">Bar size perpendicular to travel direction (centered)</p>
      </div>
      <FxFields
        values={c}
        onChange={onChange}
        gridLabel="Show grid lines"
        gridHint="Faint background grid for sci-fi texture"
        durationHint="Speed variance per bar"
        delayHint="Additional delay variance per bar"
      />
    </>
  );
}
