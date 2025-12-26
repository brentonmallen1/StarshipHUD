import { useCargo, useAssets, useContacts } from '../../hooks/useShipData';
import type { WidgetRendererProps } from '../../types';
import './DataTableWidget.css';

interface DataTableConfig {
  dataSource?: 'cargo' | 'assets' | 'contacts';
  columns?: string[];
  rowsPerPage?: number;
}

// Column configurations for different data sources
const COLUMN_CONFIGS = {
  cargo: {
    all: ['name', 'category', 'quantity', 'unit', 'value', 'location', 'description'],
    labels: {
      name: 'Name',
      category: 'Category',
      quantity: 'Quantity',
      unit: 'Unit',
      value: 'Value',
      location: 'Location',
      description: 'Description',
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

export function DataTableWidget({ instance }: WidgetRendererProps) {
  const config = instance.config as DataTableConfig;
  const dataSource = config.dataSource || 'cargo';
  const selectedColumns = config.columns || COLUMN_CONFIGS[dataSource].all.slice(0, 5);

  // Fetch data based on source
  const { data: cargoData } = useCargo();
  const { data: assetsData } = useAssets();
  const { data: contactsData } = useContacts();

  // Get the appropriate data based on source
  let data: any[] = [];
  if (dataSource === 'cargo') {
    data = cargoData || [];
  } else if (dataSource === 'assets') {
    data = assetsData || [];
  } else if (dataSource === 'contacts') {
    data = contactsData || [];
  }

  const columnConfig = COLUMN_CONFIGS[dataSource];
  const visibleColumns = selectedColumns.filter((col) => columnConfig.all.includes(col));

  // Helper to get column label
  const getColumnLabel = (col: string): string => {
    return (columnConfig.labels as Record<string, string>)[col] || col;
  };

  // Format cell value
  const formatValue = (row: any, column: string) => {
    const value = row[column];
    if (value === null || value === undefined) return '—';

    // Special formatting
    if (column === 'quantity' && typeof value === 'number') {
      return value.toLocaleString();
    }
    if (column === 'value' && typeof value === 'number') {
      return `$${value.toFixed(2)}`;
    }
    if (column === 'status') {
      return <span className={`status-badge status-${value}`}>{value.replace('_', ' ')}</span>;
    }
    if (column === 'threat_level') {
      return <span className={`status-badge threat-${value}`}>{value}</span>;
    }

    return String(value);
  };

  if (!data || data.length === 0) {
    return (
      <div className="data-table-empty">
        <p>No {dataSource} data available</p>
      </div>
    );
  }

  return (
    <div className="data-table-widget">
      <div className="data-table-header">
        <span className="data-table-source">{dataSource.toUpperCase()}</span>
        <span className="data-table-count">{data.length} items</span>
      </div>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {visibleColumns.map((col) => (
                <th key={col}>{getColumnLabel(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row.id || idx} className={idx % 2 === 0 ? 'even' : 'odd'}>
                {visibleColumns.map((col) => (
                  <td key={col}>{formatValue(row, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
