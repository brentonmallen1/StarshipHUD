import { useShip } from '../../hooks/useShipData';
import { useUpdateShip } from '../../hooks/useMutations';
import { useToast } from '../../contexts/ToastContext';
import type { ThemePreset } from '../../types';
import './ShipThemePicker.css';

interface PresetOption {
  value: ThemePreset;
  label: string;
  description: string;
}

// Preview swatches read the preset's own tokens (see styles/themes.css)
const SWATCHES = ['bg', 'panel', 'accent', 'text'] as const;

const PRESETS: PresetOption[] = [
  { value: 'baseline', label: 'Baseline', description: 'The default dark console' },
  { value: 'amber', label: 'Amber Command', description: 'Warm amber on black, rounded pills' },
  { value: 'tactical', label: 'Tactical', description: 'Green phosphor, hard edges, scanlines' },
  { value: 'phosphor', label: 'Amber Phosphor', description: 'Orange CRT with a pixel display face' },
  { value: 'holo', label: 'Holo Glass', description: 'Luminous panels over a light grid' },
];

/** GM control for the ship-wide theme; every console on the ship follows it. */
export function ShipThemePicker() {
  const { data: ship } = useShip();
  const updateShip = useUpdateShip();
  const { addToast } = useToast();
  const current = ship?.theme_preset ?? 'baseline';

  const choose = (value: ThemePreset) => {
    if (!ship || value === current) return;
    updateShip.mutate(
      { id: ship.id, data: { theme_preset: value } },
      {
        onError: (err) =>
          addToast({ message: `Failed to change ship theme: ${err instanceof Error ? err.message : 'unknown error'}`, type: 'error' }),
      }
    );
  };

  return (
    <section className="settings-section">
      <h3 className="settings-section-title">Ship Theme</h3>
      <p className="settings-hint ship-theme-picker__hint">
        Applies to every console on this ship, including players&apos; screens. Status colors stay the same in every theme.
      </p>
      <div className="ship-theme-picker" role="radiogroup" aria-label="Ship theme">
        {PRESETS.map((preset) => {
          const selected = preset.value === current;
          return (
            <button
              key={preset.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`ship-theme-picker__option${selected ? ' ship-theme-picker__option--selected' : ''}`}
              onClick={() => choose(preset.value)}
              disabled={!ship || updateShip.isPending}
            >
              <span className="ship-theme-picker__swatches" data-theme={preset.value} aria-hidden="true">
                {SWATCHES.map((swatch) => (
                  <span key={swatch} className={`ship-theme-picker__swatch ship-theme-picker__swatch--${swatch}`} />
                ))}
              </span>
              <span className="ship-theme-picker__label">
                {selected && <span aria-hidden="true">◆ </span>}
                {preset.label}
              </span>
              <span className="ship-theme-picker__description">{preset.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
