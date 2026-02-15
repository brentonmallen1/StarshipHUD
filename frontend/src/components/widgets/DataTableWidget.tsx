import { useState, useMemo } from 'react';
import { useCargo, useAssets, useContacts, useCargoCategories } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import {
  useUpdateAsset,
  useUpdateCargo,
  useUpdateContact,
  useCreateCargo,
  useCreateContact,
} from '../../hooks/useMutations';
import { useDataPermissions, useCanCreate } from '../../hooks/usePermissions';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import { EditButton } from '../controls/EditButton';
import { CARGO_SIZE_LABELS } from '../../utils/cargoShapes';
import type { WidgetRendererProps, Asset, Cargo, CargoSizeClass, Contact } from '../../types';
import { getConfig } from '../../types';
import type { DataTableConfig } from '../../types';
import './DataTableWidget.css';

// Column configurations for different data sources
const COLUMN_CONFIGS = {
  cargo: {
    all: ['name', 'category', 'size_class', 'notes'],
    labels: {
      name: 'Name',
      category: 'Category',
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

export function DataTableWidget({ instance, isEditing, canEditData }: WidgetRendererProps) {
  const shipId = useCurrentShipId();
  const config = getConfig<DataTableConfig>(instance.config);
  const dataSource = config.dataSource || 'cargo';
  const selectedColumns = config.columns || COLUMN_CONFIGS[dataSource].all.slice(0, 5);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Asset | Cargo | Contact | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Fetch data based on source
  const { data: cargoData } = useCargo();
  const { data: assetsData } = useAssets();
  const { data: contactsData } = useContacts();
  const { data: cargoCategories } = useCargoCategories();

  // Build category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    if (cargoCategories) {
      for (const cat of cargoCategories) {
        map.set(cat.id, cat.name);
      }
    }
    return map;
  }, [cargoCategories]);

  // Mutation hooks
  const updateAsset = useUpdateAsset();
  const updateCargo = useUpdateCargo();
  const updateContact = useUpdateContact();
  const createCargo = useCreateCargo();
  const createContact = useCreateContact();

  // Permission hooks
  const assetPermissions = useDataPermissions('assets');
  const cargoPermissions = useDataPermissions('cargo');
  const contactPermissions = useDataPermissions('contacts');
  const canCreateCargo = useCanCreate('cargo');
  const canCreateContact = useCanCreate('contacts');

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

  // Get permissions based on dataSource
  const getPermissions = () => {
    if (dataSource === 'assets') return assetPermissions;
    if (dataSource === 'cargo') return cargoPermissions;
    return contactPermissions;
  };

  // Get canCreate based on dataSource
  const canCreate = dataSource === 'cargo' ? canCreateCargo : dataSource === 'contacts' ? canCreateContact : false;

  // Get dataType for modal
  const getDataType = (): 'assets' | 'cargo' | 'contacts' | 'systemStates' => {
    if (dataSource === 'assets') return 'assets';
    if (dataSource === 'cargo') return 'cargo';
    return 'contacts';
  };

  // Modal handlers
  const handleOpenEdit = (record: Asset | Cargo | Contact) => {
    setEditingRecord(record);
    setIsCreatingNew(false);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setIsCreatingNew(true);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setIsCreatingNew(false);
  };

  const handleModalSave = (saveData: Partial<Asset> | Partial<Cargo> | Partial<Contact>) => {
    if (isCreatingNew) {
      // Handle creation based on dataSource
      if (dataSource === 'cargo') {
        createCargo.mutate(
          { ...saveData, ship_id: shipId ?? '' } as Partial<Cargo> & { ship_id: string },
          { onSuccess: () => handleCloseModal() }
        );
      } else if (dataSource === 'contacts') {
        createContact.mutate(
          { ...saveData, ship_id: shipId ?? '' } as Partial<Contact> & { ship_id: string },
          { onSuccess: () => handleCloseModal() }
        );
      }
    } else if (editingRecord) {
      // Handle update based on dataSource
      if (dataSource === 'assets') {
        updateAsset.mutate(
          { id: editingRecord.id, data: saveData },
          { onSuccess: () => handleCloseModal() }
        );
      } else if (dataSource === 'cargo') {
        updateCargo.mutate(
          { id: editingRecord.id, data: saveData },
          { onSuccess: () => handleCloseModal() }
        );
      } else if (dataSource === 'contacts') {
        updateContact.mutate(
          { id: editingRecord.id, data: saveData },
          { onSuccess: () => handleCloseModal() }
        );
      }
    }
  };

  // Get mutation loading/error state
  const getMutationState = () => {
    if (isCreatingNew) {
      if (dataSource === 'cargo') return { isLoading: createCargo.isPending, error: createCargo.error?.message };
      if (dataSource === 'contacts') return { isLoading: createContact.isPending, error: createContact.error?.message };
    } else {
      if (dataSource === 'assets') return { isLoading: updateAsset.isPending, error: updateAsset.error?.message };
      if (dataSource === 'cargo') return { isLoading: updateCargo.isPending, error: updateCargo.error?.message };
      if (dataSource === 'contacts') return { isLoading: updateContact.isPending, error: updateContact.error?.message };
    }
    return { isLoading: false, error: undefined };
  };

  // Helper to get column label
  const getColumnLabel = (col: string): string => {
    return (columnConfig.labels as Record<string, string>)[col] || col;
  };

  // Format cell value
  const formatValue = (row: any, column: string) => {
    const value = row[column];

    // Cargo: resolve category_id to category name
    if (column === 'category' && dataSource === 'cargo') {
      const catId = row.category_id;
      if (!catId) return '—';
      return categoryMap.get(catId) || '—';
    }

    // Cargo: display size class label
    if (column === 'size_class') {
      return CARGO_SIZE_LABELS[value as CargoSizeClass] || value || '—';
    }

    if (value === null || value === undefined) return '—';

    if (column === 'status') {
      return <span className={`status-badge status-${value}`}>{value.replace('_', ' ')}</span>;
    }
    if (column === 'threat_level') {
      return <span className={`status-badge threat-${value}`}>{value}</span>;
    }

    return String(value);
  };

  if (isEditing) {
    return (
      <div className="data-table-widget editing">
        <div className="data-table-header">
          <span className="data-table-source">{dataSource.toUpperCase()}</span>
          <span className="data-table-count">{data.length} items</span>
        </div>
        <p className="editing-hint">
          Data table displaying {dataSource} records. Players can view and edit records when data editing is enabled.
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="data-table-empty">
        <p>No {dataSource} data available</p>
      </div>
    );
  }

  const mutationState = getMutationState();

  return (
    <div className="data-table-widget">
      {/* Player Edit Modal */}
      {canEditData && (
        <PlayerEditModal
          isOpen={isModalOpen}
          dataType={getDataType()}
          record={editingRecord}
          permissions={getPermissions()}
          onSave={handleModalSave}
          onCancel={handleCloseModal}
          title={isCreatingNew ? `Create New ${dataSource.slice(0, -1)}` : `Edit ${dataSource.slice(0, -1)}`}
          isLoading={mutationState.isLoading}
          error={mutationState.error}
        />
      )}

      <div className="data-table-header">
        <div>
          <span className="data-table-source">{dataSource.toUpperCase()}</span>
          <span className="data-table-count">{data.length} items</span>
        </div>
        {canEditData && canCreate && (
          <button className="data-table-create-btn" onClick={handleOpenCreate} title={`Create new ${dataSource.slice(0, -1)}`}>
            + New {dataSource.slice(0, -1)}
          </button>
        )}
      </div>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {visibleColumns.map((col) => (
                <th key={col}>{getColumnLabel(col)}</th>
              ))}
              {canEditData && <th className="actions-column">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row.id || idx} className={idx % 2 === 0 ? 'even' : 'odd'}>
                {visibleColumns.map((col) => (
                  <td key={col}>{formatValue(row, col)}</td>
                ))}
                {canEditData && (
                  <td className="actions-cell">
                    <EditButton
                      onClick={() => handleOpenEdit(row)}
                      title={`Edit ${row.name || 'record'}`}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
