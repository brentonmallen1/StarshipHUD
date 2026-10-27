/** Columns each Data Table source can show (shared by the widget and its config editor). */
export type DataTableSource = 'cargo' | 'assets' | 'contacts';

export const COLUMN_CONFIGS: Record<DataTableSource, { all: string[]; labels: Record<string, string> }> = {
  cargo: {
    all: ['name', 'category', 'location', 'size_class', 'notes'],
    labels: {
      name: 'Name',
      category: 'Category',
      location: 'Location',
      size_class: 'Size',
      notes: 'Notes',
    },
  },
  assets: {
    all: ['name', 'asset_type', 'status', 'ammo_current', 'ammo_max', 'range', 'damage'],
    labels: {
      name: 'Name',
      asset_type: 'Type',
      status: 'Status',
      ammo_current: 'Ammo',
      ammo_max: 'Max Ammo',
      range: 'Range',
      damage: 'Damage',
    },
  },
  contacts: {
    all: ['name', 'affiliation', 'threat_level', 'role', 'last_contacted_at'],
    labels: {
      name: 'Name',
      affiliation: 'Affiliation',
      threat_level: 'Threat Level',
      role: 'Role',
      last_contacted_at: 'Last Contact',
    },
  },
};
