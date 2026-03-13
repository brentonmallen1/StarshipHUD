import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShips } from '../../hooks/useShipData';
import { useShipContext } from '../../contexts/ShipContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUpdateShip } from '../../hooks/useMutations';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipsApi, shipAccessApi, usersApi } from '../../services/api';
import { ShipCreateModal } from '../../components/admin/ShipCreateModal';
import { ShipEditModal } from '../../components/admin/ShipEditModal';
import { D20Loader } from '../../components/ui/D20Loader';
import type { Ship, ShipUpdate, ShipAccessCreate, ShipAccessWithUser, Role } from '../../types';
import './Admin.css';

interface ShipAccessModalProps {
  ship: Ship;
  isAdmin: boolean;
  onClose: () => void;
}

function ShipAccessModal({ ship, isAdmin, onClose }: ShipAccessModalProps) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [roleOverride, setRoleOverride] = useState<Role | ''>('');

  // Fetch users with access to this ship
  const { data: accessList, isLoading } = useQuery({
    queryKey: ['shipAccess', ship.id],
    queryFn: () => shipAccessApi.list(ship.id),
  });

  // Fetch all users (to show in grant dropdown)
  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  });

  const grantMutation = useMutation({
    mutationFn: (data: ShipAccessCreate) => shipAccessApi.grant(ship.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipAccess', ship.id] });
      setSelectedUserId('');
      setRoleOverride('');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => shipAccessApi.revoke(ship.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipAccess', ship.id] });
    },
  });

  // Users not already in the access list (excluding admins who have implicit access)
  const availableUsers = allUsers?.filter(
    (u) => u.role !== 'admin' && !accessList?.some((a) => a.user_id === u.id)
  );

  const handleGrant = () => {
    if (!selectedUserId) return;
    grantMutation.mutate({
      user_id: selectedUserId,
      role_override: roleOverride || undefined,
      can_edit: false,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ship-access-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ship Access: {ship.name}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Users with access */}
          <div className="ship-access-list">
            <h3>Users with Access</h3>
            {isLoading ? (
              <p>Loading...</p>
            ) : accessList?.length === 0 ? (
              <p className="no-access">No users have explicit access to this ship.</p>
            ) : (
              <table className="admin-table admin-table-compact">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Global Role</th>
                    <th>Ship Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessList?.map((access: ShipAccessWithUser) => {
                    // GMs can only revoke non-GM access
                    const canRevoke = isAdmin || access.role_override !== 'gm';
                    return (
                      <tr key={access.id}>
                        <td>
                          <span className="user-name">{access.display_name}</span>
                          <span className="user-username"> (@{access.username})</span>
                        </td>
                        <td>
                          <span className={`role-badge role-${access.user_role}`}>
                            {access.user_role}
                          </span>
                        </td>
                        <td>
                          {access.role_override ? (
                            <span className={`role-badge role-${access.role_override}`}>
                              {access.role_override}
                            </span>
                          ) : (
                            <span className="no-override">—</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => revokeMutation.mutate(access.user_id)}
                            disabled={!canRevoke || revokeMutation.isPending}
                            title={!canRevoke ? 'Only admins can revoke GM access' : 'Revoke access'}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Grant new access */}
          {availableUsers && availableUsers.length > 0 && (
            <div className="ship-access-grant">
              <h3>Grant Access</h3>
              <div className="grant-form">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Select a user...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.display_name} (@{user.username}) - {user.role}
                    </option>
                  ))}
                </select>
                <select
                  value={roleOverride}
                  onChange={(e) => setRoleOverride(e.target.value as Role | '')}
                >
                  <option value="">No role override</option>
                  {isAdmin && <option value="gm">GM on this ship</option>}
                  <option value="player">Player on this ship</option>
                </select>
                <button
                  className="btn btn-primary"
                  onClick={handleGrant}
                  disabled={!selectedUserId || grantMutation.isPending}
                >
                  {grantMutation.isPending ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
              {grantMutation.isError && (
                <div className="form-error">
                  {grantMutation.error instanceof Error
                    ? grantMutation.error.message
                    : 'Failed to grant access'}
                </div>
              )}
            </div>
          )}

          <p className="ship-access-note">
            Note: Admins automatically have access to all ships.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminShips() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, authEnabled } = useAuth();
  const { data: ships, isLoading, error } = useShips();
  const { shipId: currentShipId } = useShipContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [shipToEdit, setShipToEdit] = useState<Ship | null>(null);
  const [shipToDelete, setShipToDelete] = useState<Ship | null>(null);
  const [shipToManageAccess, setShipToManageAccess] = useState<Ship | null>(null);
  const updateShipMutation = useUpdateShip();

  const isAdmin = !authEnabled || user?.role === 'admin';

  // For non-admin GMs, fetch which ships they have GM access to
  const { data: myShipAccesses } = useQuery({
    queryKey: ['userShipAccess', user?.id],
    queryFn: () => (user?.id ? usersApi.getShipAccess(user.id) : Promise.resolve([])),
    enabled: authEnabled && !!user?.id && user.role !== 'admin',
  });

  // Set of ship IDs that the current user can manage access for
  const manageableShipIds = new Set(
    isAdmin
      ? ships?.map((s) => s.id) || []
      : myShipAccesses?.filter((a) => a.role_override === 'gm').map((a) => a.ship_id) || []
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => shipsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      // If we deleted the current ship, redirect to ship selector
      if (deletedId === currentShipId) {
        navigate('/ships');
      }
      setShipToDelete(null);
    },
  });

  const handleBoardShip = (ship: Ship) => {
    navigate(`/${ship.id}/admin`);
  };

  const handleSaveEdit = (data: ShipUpdate) => {
    if (!shipToEdit) return;
    updateShipMutation.mutate(
      { id: shipToEdit.id, data },
      { onSuccess: () => setShipToEdit(null) }
    );
  };

  if (isLoading) {
    return (
      <div className="admin-page">
        <h2 className="admin-page-title">Ships</h2>
        <div className="admin-loading">
          <D20Loader size={48} speed={3.4} />
          <span>Loading ships...</span>
        </div>
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
                    className="btn btn-small"
                    onClick={() => setShipToEdit(ship)}
                  >
                    Edit
                  </button>
                  {manageableShipIds.has(ship.id) && (
                    <button
                      className="btn btn-small"
                      onClick={() => setShipToManageAccess(ship)}
                    >
                      Access
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

      {/* Edit Modal */}
      {shipToEdit && (
        <ShipEditModal
          ship={shipToEdit}
          isOpen={true}
          onClose={() => setShipToEdit(null)}
          onSave={handleSaveEdit}
          isSaving={updateShipMutation.isPending}
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

      {/* Ship Access Modal */}
      {shipToManageAccess && (
        <ShipAccessModal
          ship={shipToManageAccess}
          isAdmin={isAdmin}
          onClose={() => setShipToManageAccess(null)}
        />
      )}
    </div>
  );
}
