import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShips } from '../hooks/useShipData';
import { useShipContext } from '../contexts/ShipContext';
import { useIsGM } from '../contexts/RoleContext';
import { ShipCreateModal } from '../components/admin/ShipCreateModal';
import type { Ship } from '../types';
import './ShipSelector.css';

export function ShipSelector() {
  const navigate = useNavigate();
  const { data: ships, isLoading, error } = useShips();
  const { setShipId } = useShipContext();
  const isGM = useIsGM();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleSelectShip = async (ship: Ship) => {
    await setShipId(ship.id);
    navigate('/panels');
  };

  if (isLoading) {
    return (
      <div className="ship-selector">
        <div className="loading">Scanning docking registry...</div>
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
  const shipCount = ships?.length || 0;
  const totalSlots = isGM ? shipCount + 1 : shipCount; // +1 for "Add Ship" slot if GM
  const radius = 280; // Distance from center

  return (
    <div className="ship-selector">
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
          </div>
          <div className="core-ring" />
          <div className="core-ring outer" />
        </div>

        {/* Ship berths arranged radially */}
        <div className="berth-ring">
          {ships?.map((ship, index) => {
            const angle = (index * 360) / Math.max(totalSlots, 1) - 90;
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;

            return (
              <button
                key={ship.id}
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
                    <span className="ship-name">{ship.name}</span>
                    {ship.ship_class && (
                      <span className="ship-class">{ship.ship_class}</span>
                    )}
                    {ship.registry && (
                      <span className="ship-registry">{ship.registry}</span>
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
            handleSelectShip(ship);
          }}
        />
      )}
    </div>
  );
}
