/**
 * Small form-field building blocks for widget config editors.
 * They render the same `.configure-section` markup the config modal has
 * always used (styles in WidgetCreationModal.css).
 */
import type { ReactNode } from 'react';

/** Parse a number input, allowing the field to be cleared without snapping to 0. */
export function parseNumberInput(value: string, fallback: number, min?: number): number {
  if (value === '' || value === '-') return fallback;
  const num = parseFloat(value);
  if (isNaN(num)) return fallback;
  if (min !== undefined && num < min) return min;
  return num;
}

export const ORIENTATION_OPTIONS = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
] as const;

export const ORIENTATION_HINT = 'Vertical orientation uses icon indicators instead of text labels';

function Hint({ children }: { children?: ReactNode }) {
  return children ? <p className="field-hint">{children}</p> : null;
}

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
}

export function SelectField<V extends string | number>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: ReactNode;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  hint?: ReactNode;
}) {
  return (
    <div className="configure-section">
      <label className="configure-label">{label}</label>
      <select
        className="config-input"
        value={value}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint>{hint}</Hint>
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
}) {
  return (
    <div className="configure-section">
      <label className="checkbox-label">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      <Hint>{hint}</Hint>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  fallback,
  min,
  max,
  step,
  hint,
}: {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  /** Value used when the field is cleared. */
  fallback: number;
  min?: number;
  max?: number;
  step?: number;
  hint?: ReactNode;
}) {
  return (
    <div className="configure-section">
      <label className="configure-label">{label}</label>
      <input
        type="number"
        className="config-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseNumberInput(e.target.value, fallback, min))}
      />
      <Hint>{hint}</Hint>
    </div>
  );
}

/** Slider showing its value as a percentage next to the track. */
export function PercentRangeField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step,
  hint,
}: {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  step: number;
  hint?: ReactNode;
}) {
  return (
    <div className="configure-section">
      <label className="configure-label">{label}</label>
      <input
        type="range"
        className="config-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="range-value">{Math.round(value * 100)}%</span>
      <Hint>{hint}</Hint>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="configure-section">
      <label className="configure-label">{label}</label>
      <input
        type="text"
        className="config-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <Hint>{hint}</Hint>
    </div>
  );
}

/**
 * Multi-select checkbox list. Reports `undefined` when nothing is checked,
 * which widgets treat as "no filter / show all".
 */
export function CheckboxListField({
  label,
  options,
  selected,
  onChange,
  hint,
}: {
  label: ReactNode;
  options: readonly { value: string; label: string }[];
  selected: readonly string[] | undefined;
  onChange: (selected: string[] | undefined) => void;
  hint?: ReactNode;
}) {
  const current = selected ?? [];
  return (
    <div className="configure-section">
      <label className="configure-label">{label}</label>
      <div className="column-checkboxes">
        {options.map((o) => (
          <label key={o.value} className="checkbox-label">
            <input
              type="checkbox"
              checked={current.includes(o.value)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...current, o.value]
                  : current.filter((v) => v !== o.value);
                onChange(next.length > 0 ? next : undefined);
              }}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <Hint>{hint}</Hint>
    </div>
  );
}

/** `<select>` of ship systems with a "-- None --" option; '' maps to undefined. */
export function SystemSelect({
  value,
  systemStates,
  onChange,
}: {
  value: string | undefined;
  systemStates: readonly { id: string; name: string; category?: string }[];
  onChange: (id: string | undefined) => void;
}) {
  return (
    <select
      className="config-input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">-- None --</option>
      {systemStates.map((state) => (
        <option key={state.id} value={state.id}>
          {state.name} ({state.category})
        </option>
      ))}
    </select>
  );
}
