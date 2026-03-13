import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyShips } from '../hooks/useShipData';
import { useIsGM } from '../contexts/RoleContext';
import { ShipCreateModal } from '../components/admin/ShipCreateModal';
import { ShipImportModal } from '../components/admin/ShipImportModal';
import { D20Loader } from '../components/ui/D20Loader';
import type { Ship, MyShipAccess } from '../types';
import '../components/RequireShip.css';
import './ShipSelector.css';

export function ShipSelector() {
  const navigate = useNavigate();
  const { data: myShips, isLoading, error } = useMyShips();
  const isGM = useIsGM();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Auto-redirect when user has access to exactly one ship
  useEffect(() => {
    if (myShips && myShips.length === 1) {
      const ship = myShips[0];
      // If default panel exists, go there; otherwise go to panels index
      const target = ship.default_panel_slug
        ? `/${ship.ship_id}/panel/${ship.default_panel_slug}`
        : `/${ship.ship_id}/panels`;
      navigate(target, { replace: true });
    }
  }, [myShips, navigate]);

  const handleSelectShip = (ship: MyShipAccess) => {
    // Navigate to default panel if set, otherwise to panels index
    const target = ship.default_panel_slug
      ? `/${ship.ship_id}/panel/${ship.default_panel_slug}`
      : `/${ship.ship_id}/panels`;
    navigate(target);
  };

  const handleCreatedShip = (ship: Ship) => {
    navigate(`/${ship.id}/panels`);
  };

  if (isLoading) {
    return (
      <div className="ship-selector">
        <div className="loading-screen">
          <D20Loader size={120} speed={3.4} />
          <span className="loading-screen__text">Scanning docking registry...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ship-selector">
        <div className="error">Failed to access dock control: {error.message}</div>
      </div>
    );
  }

  // Calculate positions for hexagonal/radial layout
  const shipCount = myShips?.length || 0;
  const totalSlots = isGM ? shipCount + 1 : shipCount; // +1 for "Add Ship" slot if GM
  const radius = 280; // Distance from center

  return (
    <div className="ship-selector">
      {/* Mobile list view */}
      <div className="ship-list-mobile">
        <div className="mobile-header">
          <h1 className="mobile-title">DOCK CONTROL</h1>
          <div className="mobile-header-row">
            <div className="mobile-status">
              <span className="status-indicator operational" />
              <span>{shipCount} vessel{shipCount !== 1 ? 's' : ''} docked</span>
            </div>
            {isGM && (
              <button
                className="btn btn-ghost btn-small import-btn"
                onClick={() => setShowImportModal(true)}
              >
                Import
              </button>
            )}
          </div>
        </div>

        <div className="ship-grid">
          {myShips?.map((ship, index) => (
            <button
              key={ship.ship_id}
              className="ship-card"
              onClick={() => handleSelectShip(ship)}
            >
              <div className="ship-card-indicator occupied" />
              <div className="ship-card-content">
                <span className="ship-card-name">{ship.ship_name}</span>
                {ship.ship_class && (
                  <span className="ship-card-class">{ship.ship_class}</span>
                )}
                {ship.ship_registry && (
                  <span className="ship-card-registry">{ship.ship_registry}</span>
                )}
              </div>
              <div className="ship-card-berth">BERTH {String(index + 1).padStart(2, '0')}</div>
            </button>
          ))}

          {isGM && (
            <button
              className="ship-card vacant"
              onClick={() => setShowCreateModal(true)}
            >
              <div className="ship-card-indicator vacant" />
              <div className="ship-card-content">
                <span className="ship-card-add">+</span>
                <span className="ship-card-name">Add Ship</span>
                <span className="ship-card-class">Commission New Vessel</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Desktop radial view */}
      <div className="dock-container">
        {/* Center dock control */}
        <div className="dock-core">
          <div className="dock-core-inner">
            <h1 className="dock-title">DOCK CONTROL</h1>
            <p className="dock-subtitle">Select Berth</p>
            <div className="dock-status">
              <span className="status-indicator operational" />
              <span>{shipCount} vessel{shipCount !== 1 ? 's' : ''} docked</span>
            </div>
            {isGM && (
              <button
                className="dock-import-btn"
                onClick={() => setShowImportModal(true)}
              >
                Import Ship
              </button>
            )}
          </div>
          <div className="core-ring" />
          <div className="core-ring outer" />
        </div>

        {/* Ship berths arranged radially */}
        <div className="berth-ring">
          {myShips?.map((ship, index) => {
            const angle = (index * 360) / Math.max(totalSlots, 1) - 90;
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;

            return (
              <button
                key={ship.ship_id}
                className="berth-node"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  '--delay': `${index * 0.1}s`,
                } as React.CSSProperties}
                onClick={() => handleSelectShip(ship)}
              >
                <div className="berth-node-inner">
                  <div className="berth-indicator occupied" />
                  <div className="berth-content">
                    <span className="ship-name">{ship.ship_name}</span>
                    {ship.ship_class && (
                      <span className="ship-class">{ship.ship_class}</span>
                    )}
                    {ship.ship_registry && (
                      <span className="ship-registry">{ship.ship_registry}</span>
                    )}
                  </div>
                  <div className="berth-label">BERTH {String(index + 1).padStart(2, '0')}</div>
                </div>
              </button>
            );
          })}

          {/* Add Ship slot (GM only) */}
          {isGM && (
            <button
              className="berth-node vacant"
              style={{
                transform: `translate(${
                  Math.cos(((shipCount * 360) / Math.max(totalSlots, 1) - 90) * Math.PI / 180) * radius
                }px, ${
                  Math.sin(((shipCount * 360) / Math.max(totalSlots, 1) - 90) * Math.PI / 180) * radius
                }px)`,
                '--delay': `${shipCount * 0.1}s`,
              } as React.CSSProperties}
              onClick={() => setShowCreateModal(true)}
            >
              <div className="berth-node-inner">
                <div className="berth-indicator vacant" />
                <div className="berth-content">
                  <span className="add-icon">+</span>
                  <span className="ship-name">Add Ship</span>
                  <span className="ship-class">Commission New Vessel</span>
                </div>
                <div className="berth-label">VACANT</div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Create Ship Modal */}
      {showCreateModal && (
        <ShipCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(ship) => {
            setShowCreateModal(false);
            handleCreatedShip(ship);
          }}
        />
      )}

      {/* Import Ship Modal */}
      {showImportModal && (
        <ShipImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(ship) => {
            setShowImportModal(false);
            handleCreatedShip(ship);
          }}
        />
      )}
    </div>
  );
}
