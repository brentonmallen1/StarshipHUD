import { useState } from 'react';
import type { Cargo, CargoCategory } from '../../../types';
import { CARGO_SIZE_LABELS } from '../../../utils/cargoShapes';
import { getCargoColor } from './cargoDisplay';

interface InventoryPanelProps {
  cargo: Cargo[] | undefined;
  categoryMap: Map<string, CargoCategory>;
  selectedCargoId: string | null;
  onPick: (cargo: Cargo) => void;
}

/** Collapsible drawer listing cargo that isn't placed in any bay. */
export function InventoryPanel({ cargo, categoryMap, selectedCargoId, onPick }: InventoryPanelProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`cargo-inventory-drawer ${open ? 'open' : ''}`}>
      <button className="cargo-inventory-toggle" onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'} Unplaced ({cargo?.length ?? 0})
      </button>
      {open && (
        <div className="cargo-inventory-list">
          {cargo?.map((item) => (
            <div
              key={item.id}
              className={`cargo-inventory-item ${selectedCargoId === item.id ? 'selected' : ''}`}
              style={{ borderColor: getCargoColor(item, categoryMap) }}
              title={item.name}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPick(item);
              }}
            >
              <span className="cargo-inventory-name">{item.name}</span>
              <span className="cargo-inventory-size">{CARGO_SIZE_LABELS[item.size_class]}</span>
            </div>
          ))}
          {(!cargo || cargo.length === 0) && <div className="cargo-inventory-empty">All cargo placed</div>}
        </div>
      )}
    </div>
  );
}
