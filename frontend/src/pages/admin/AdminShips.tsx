import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShips } from '../../hooks/useShipData';
import { useShipContext } from '../../contexts/ShipContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shipsApi } from '../../services/api';
import { ShipCreateModal } from '../../components/admin/ShipCreateModal';
import type { Ship } from '../../types';
import './Admin.css';

export function AdminShips() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: ships, isLoading, error } = useShips();
  const { shipId: currentShipId, setShipId, clearShip } = useShipContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [shipToDelete, setShipToDelete] = useState<Ship | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => shipsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      // If we deleted the current ship, clear selection and redirect
      if (deletedId === currentShipId) {
        clearShip();
        navigate('/ships');
      }
      setShipToDelete(null);
    },
  });

  const handleBoardShip = async (ship: Ship) => {
    await setShipId(ship.id);
    navigate('/admin');
  };

  if (isLoading) {
    return (
      <div className="admin-page">
        <h2 className="admin-page-title">Ships</h2>
        <div className="loading">Loading ships...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <h2 className="admin-page-title">Ships</h2>
        <div className="error">Failed to load ships: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Ships</h2>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Commission New Ship
        </button>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Class</th>
              <th>Registry</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ships?.map((ship) => (
              <tr key={ship.id} className={ship.id === currentShipId ? 'current-ship' : ''}>
                <td className="ship-name-cell">
                  {ship.name}
                  {ship.id === currentShipId && (
                    <span className="current-badge">Current</span>
                  )}
                </td>
                <td>{ship.ship_class || '-'}</td>
                <td className="monospace">{ship.registry || '-'}</td>
                <td>
                  <span className="status-badge operational">Active</span>
                </td>
                <td className="actions-cell">
                  {ship.id !== currentShipId && (
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => handleBoardShip(ship)}
                    >
                      Board
                    </button>
                  )}
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => setShipToDelete(ship)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ships?.length === 0 && (
        <div className="empty-state">
          <p>No ships found. Commission your first vessel to get started.</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ShipCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(ship) => {
            setShowCreateModal(false);
            handleBoardShip(ship);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {shipToDelete && (
        <div className="modal-overlay" onClick={() => setShipToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="modal-close" onClick={() => setShipToDelete(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                Are you sure you want to delete <strong>{shipToDelete.name}</strong>?
              </p>
              <p className="warning-detail">
                This will permanently delete all data associated with this ship, including:
              </p>
              <ul className="warning-list">
                <li>All panels and widgets</li>
                <li>System states and configurations</li>
                <li>Events and logs</li>
                <li>Scenarios</li>
                <li>Crew, contacts, cargo, and assets</li>
              </ul>
              <p className="warning-detail">
                <strong>This action cannot be undone.</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShipToDelete(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => deleteMutation.mutate(shipToDelete.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Ship'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
