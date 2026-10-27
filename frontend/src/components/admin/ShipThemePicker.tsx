import { useShip } from '../../hooks/useShipData';
import { useUpdateShip } from '../../hooks/useMutations';
import { useToast } from '../../contexts/ToastContext';
import type { ThemePreset } from '../../types';
import './ShipThemePicker.css';

interface PresetOption {
  value: ThemePreset;
  label: string;
  description: string;
  // Preview swatches: ground, panel, accent, text (mirrors styles/themes.css)
  swatches: [string, string, string, string];
}

const PRESETS: PresetOption[] = [
  { value: 'baseline', label: 'Baseline', description: 'The default dark console', swatches: ['#0a0e14', '#11161d', '#58a6ff', '#f5f8fb'] },
  { value: 'amber', label: 'Amber Command', description: 'Warm amber on black, rounded pills', swatches: ['#000000', '#0d0a06', '#ff9f45', '#ffe4c4'] },
  { value: 'tactical', label: 'Tactical', description: 'Green phosphor, hard edges, scanlines', swatches: ['#020403', '#030806', '#39e58c', '#b8ffd6'] },
  { value: 'phosphor', label: 'Amber Phosphor', description: 'Orange CRT with a pixel display face', swatches: ['#050300', '#0a0600', '#ffb000', '#ffd27a'] },
  { value: 'holo', label: 'Holo Glass', description: 'Luminous panels over a light grid', swatches: ['#0b1430', '#17244a', '#8fd3ff', '#ffffff'] },
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
              <span className="ship-theme-picker__swatches" aria-hidden="true">
                {preset.swatches.map((color, i) => (
                  <span key={i} className="ship-theme-picker__swatch" style={{ background: color }} />
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
