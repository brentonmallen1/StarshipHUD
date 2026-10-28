/**
 * Shared controls for the decorative "effects" widgets
 * (scan_line, radar_ping, pulse, phase_bars).
 */
import type { ReactNode } from 'react';
import type { FxEffect, FxGlow, FxThickness } from '../../../types';
import { CheckboxField, PercentRangeField, SelectField } from './fields';

/** Token-based colour choices; stored verbatim so they follow theme changes. */
export const FX_COLOR_OPTIONS = [
  { value: 'var(--color-accent-cyan, #00d4ff)', label: 'Cyan' },
  { value: 'var(--color-operational, #3fb950)', label: 'Green' },
  { value: 'var(--color-degraded, #d4a72c)', label: 'Amber' },
  { value: 'var(--color-compromised, #db6d28)', label: 'Orange' },
  { value: 'var(--color-critical, #f85149)', label: 'Red' },
  { value: 'var(--color-accent-purple, #8957e5)', label: 'Purple' },
  { value: 'var(--color-text-primary, #e6edf3)', label: 'White' },
] as const;

const GLOW_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

const EFFECT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'flicker', label: 'Flicker' },
  { value: 'jitter', label: 'Jitter' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'strobe', label: 'Strobe' },
] as const;

export function FxColorSelect({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  // Keep a custom (non-preset) stored colour selectable instead of silently showing "Cyan"
  const options = FX_COLOR_OPTIONS.some((o) => o.value === value)
    ? FX_COLOR_OPTIONS
    : [...FX_COLOR_OPTIONS, { value, label: `Custom (${value})` }];
  return <SelectField label="Color" value={value} options={options} onChange={onChange} />;
}

export function FxThicknessSelect({
  label = 'Beam Thickness',
  value,
  onChange,
  thickPx,
}: {
  label?: string;
  value: FxThickness;
  onChange: (thickness: FxThickness) => void;
  /** Pixel width the widget uses for 'thick' (shown in the option label). */
  thickPx: number;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      options={[
        { value: 'thin', label: 'Thin (1px)' },
        { value: 'normal', label: 'Normal (2px)' },
        { value: 'thick', label: `Thick (${thickPx}px)` },
      ]}
      onChange={onChange}
    />
  );
}

export interface FxValues {
  glow: FxGlow;
  effect?: FxEffect;
  show_grid: boolean;
  hide_border: boolean;
  duration_variance?: number;
  delay_variance?: number;
  frequency_variance?: number;
}

/**
 * Glow, optional secondary effect, grid, timing variance and border controls.
 * Which variance sliders appear is driven by which keys `values` carries.
 */
export function FxFields({
  values,
  onChange,
  effectHint,
  gridLabel = 'Show grid',
  gridHint,
  durationHint = 'Speed variance per widget instance',
  delayHint = 'Random initial delay to desync animations',
}: {
  values: FxValues;
  onChange: (patch: Partial<FxValues>) => void;
  /** Shown when `values.effect` is present. */
  effectHint?: ReactNode;
  gridLabel?: string;
  gridHint?: ReactNode;
  durationHint?: ReactNode;
  delayHint?: ReactNode;
}) {
  return (
    <>
      <SelectField
        label="Glow Intensity"
        value={values.glow}
        options={GLOW_OPTIONS}
        onChange={(glow) => onChange({ glow })}
      />
      {values.effect !== undefined && (
        <SelectField
          label="Effect"
          value={values.effect}
          options={EFFECT_OPTIONS}
          onChange={(effect) => onChange({ effect })}
          hint={effectHint}
        />
      )}
      <CheckboxField
        label={gridLabel}
        checked={values.show_grid}
        onChange={(show_grid) => onChange({ show_grid })}
        hint={gridHint}
      />
      {values.duration_variance !== undefined && (
        <PercentRangeField
          label="Duration Variance"
          value={values.duration_variance}
          max={0.5}
          step={0.05}
          onChange={(duration_variance) => onChange({ duration_variance })}
          hint={durationHint}
        />
      )}
      {values.delay_variance !== undefined && (
        <PercentRangeField
          label="Delay Variance"
          value={values.delay_variance}
          max={1}
          step={0.1}
          onChange={(delay_variance) => onChange({ delay_variance })}
          hint={delayHint}
        />
      )}
      {values.frequency_variance !== undefined && (
        <PercentRangeField
          label="Frequency Variance"
          value={values.frequency_variance}
          max={0.5}
          step={0.05}
          onChange={(frequency_variance) => onChange({ frequency_variance })}
          hint="Randomize pulse interval to avoid rigid periodicity"
        />
      )}
      <HideBorderField checked={values.hide_border} onChange={(hide_border) => onChange({ hide_border })} />
    </>
  );
}

export function HideBorderField({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <CheckboxField
      label="Hide widget border"
      checked={checked}
      onChange={onChange}
      hint="Remove the chamfered border for a seamless look"
    />
  );
}
