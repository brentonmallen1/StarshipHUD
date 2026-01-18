import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useShip } from '../../hooks/useShipData';
import { useUpdateShip } from '../../hooks/useMutations';
import { ShipEditModal } from '../admin/ShipEditModal';
import type { WidgetRendererProps, ShipUpdate } from '../../types';
import './ShipOverviewWidget.css';

export function ShipOverviewWidget({ isEditing, canEditData }: WidgetRendererProps) {
  const { data: ship, isLoading, error } = useShip();
  const updateShipMutation = useUpdateShip();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (isEditing) {
    return (
      <div className="ship-overview-widget editing">
        <div className="ship-overview-header">
          <h3 className="ship-overview-title">Ship Overview</h3>
        </div>
        <div className="ship-overview-preview">
          <div className="ship-name-preview">ISV Constellation</div>
          <div className="ship-meta-preview">
            <span className="ship-class-preview">Heavy Cruiser</span>
            <span className="ship-registry-preview">ISV-2847</span>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="ship-overview-widget loading">
        <div className="ship-overview-header">
          <h3 className="ship-overview-title">Ship Overview</h3>
        </div>
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  if (error || !ship) {
    return (
      <div className="ship-overview-widget error">
        <div className="ship-overview-header">
          <h3 className="ship-overview-title">Ship Overview</h3>
        </div>
        <div className="error-state">Unable to load ship data</div>
      </div>
    );
  }

  const handleSave = (data: ShipUpdate) => {
    updateShipMutation.mutate(
      { id: ship.id, data },
      {
        onSuccess: () => setIsEditModalOpen(false),
      }
    );
  };

  return (
    <div className="ship-overview-widget">
      <div className="ship-overview-header">
        <h3 className="ship-overview-title">Ship Overview</h3>
        {canEditData && (
          <button
            className="ship-edit-btn"
            onClick={() => setIsEditModalOpen(true)}
            title="Edit ship details"
          >
            Edit
          </button>
        )}
      </div>

      <div className="ship-overview-content">
        <div className="ship-identity">
          <div className="ship-name">{ship.name}</div>
          <div className="ship-meta">
            {ship.ship_class && (
              <span className="ship-class">{ship.ship_class}</span>
            )}
            {ship.registry && (
              <span className="ship-registry">{ship.registry}</span>
            )}
          </div>
        </div>

        {ship.description && (
          <div className="ship-description">{ship.description}</div>
        )}

        {ship.attributes && Object.keys(ship.attributes).length > 0 && (
          <div className="ship-attributes">
            {Object.entries(ship.attributes).map(([key, value]) => (
              <div key={key} className="attribute-row">
                <span className="attribute-key">{key}</span>
                <span className="attribute-value">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ship Edit Modal - rendered via portal to escape widget overflow */}
      {ship &&
        createPortal(
          <ShipEditModal
            ship={ship}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleSave}
            isSaving={updateShipMutation.isPending}
          />,
          document.body
        )}
    </div>
  );
}
