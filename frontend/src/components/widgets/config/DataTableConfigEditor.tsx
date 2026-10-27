import type { DataTableConfig, WidgetConfigEditorProps } from '../../../types';
import { DATA_TABLE_DEFAULTS } from '../../../types';
import { COLUMN_CONFIGS } from '../dataTableColumns';
import { CheckboxListField, SelectField } from './fields';
import { useModalCargoBays } from './useModalCargoBays';

const ASSET_TYPE_OPTIONS = [
  { value: 'energy_weapon', label: 'Energy Weapon' },
  { value: 'torpedo', label: 'Torpedo' },
  { value: 'missile', label: 'Missile' },
  { value: 'railgun', label: 'Railgun' },
  { value: 'laser', label: 'Laser' },
  { value: 'particle_beam', label: 'Particle Beam' },
  { value: 'drone', label: 'Drone' },
  { value: 'probe', label: 'Probe' },
] as const;

export function DataTableConfigEditor({ config, onChange }: WidgetConfigEditorProps<DataTableConfig>) {
  const c = { ...DATA_TABLE_DEFAULTS, ...config };
  const dataSource = COLUMN_CONFIGS[c.dataSource] ? c.dataSource : DATA_TABLE_DEFAULTS.dataSource;
  const columns = COLUMN_CONFIGS[dataSource];
  const { data: cargoBays } = useModalCargoBays();

  return (
    <>
      <SelectField
        label="Data Source"
        value={dataSource}
        options={[
          { value: 'cargo', label: 'Cargo Inventory' },
          { value: 'assets', label: 'Weapons & Assets' },
          { value: 'contacts', label: 'Contacts & Dossiers' },
        ]}
        // Columns are source-specific, so reset them when the source changes
        onChange={(next) => onChange({ dataSource: next, columns: undefined })}
        hint="Select which data to display in the table"
      />

      <CheckboxListField
        label="Columns to Display"
        options={columns.all.map((col) => ({ value: col, label: columns.labels[col] ?? col }))}
        selected={c.columns}
        onChange={(cols) => onChange({ columns: cols })}
        hint="Leave empty to show default columns"
      />

      {dataSource === 'assets' && (
        <CheckboxListField
          label="Filter by Asset Type"
          options={ASSET_TYPE_OPTIONS}
          selected={c.assetTypes}
          onChange={(types) => onChange({ assetTypes: types as DataTableConfig['assetTypes'] })}
          hint="Leave all unchecked to show all asset types"
        />
      )}

      {dataSource === 'cargo' && cargoBays && cargoBays.length > 0 && (
        <CheckboxListField
          label="Filter by Cargo Bay"
          options={cargoBays.map((bay) => ({ value: bay.id, label: bay.name }))}
          selected={c.bayIds}
          onChange={(bayIds) => onChange({ bayIds })}
          hint="Leave all unchecked to show all cargo"
        />
      )}
    </>
  );
}
