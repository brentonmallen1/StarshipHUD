import type { CargoBayConfig, WidgetConfigEditorProps } from '../../../types';
import { CARGO_BAY_DEFAULTS } from '../../../types';
import { CheckboxField, CheckboxListField } from './fields';
import { useModalCargoBays } from './useModalCargoBays';

export function CargoBayConfigEditor({ config, onChange }: WidgetConfigEditorProps<CargoBayConfig>) {
  const c = { ...CARGO_BAY_DEFAULTS, ...config };
  const { data: cargoBays } = useModalCargoBays();
  return (
    <>
      <CheckboxListField
        label="Visible Cargo Bays"
        options={(cargoBays ?? []).map((bay) => ({ value: bay.id, label: bay.name }))}
        selected={c.bay_ids}
        onChange={(bay_ids) => onChange({ bay_ids })}
        hint="Select which cargo bays to show. Leave all unchecked to show all bays."
      />
      <CheckboxField
        label="Show unplaced inventory drawer"
        checked={c.show_inventory}
        onChange={(show_inventory) => onChange({ show_inventory })}
        hint="Display the drawer with cargo items not yet placed in a bay"
      />
    </>
  );
}
