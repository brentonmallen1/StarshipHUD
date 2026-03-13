import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { User, UserCreate, UserUpdate, Role } from '../../types';
import './AdminUsers.css';

interface ShipAccessModalProps {
  user: User;
  onClose: () => void;
  onImpersonate?: (user: User) => void;
}

function ShipAccessModal({ user, onClose, onImpersonate }: ShipAccessModalProps) {
  const { data: shipAccesses, isLoading: accessLoading } = useQuery({
    queryKey: ['userShipAccess', user.id],
    queryFn: () => usersApi.getShipAccess(user.id),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ship-access-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ship Access: {user.display_name}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Impersonate button */}
          {onImpersonate && user.role !== 'admin' && (
            <div className="ship-access-impersonate">
              <button
                className="btn btn-secondary"
                onClick={() => onImpersonate(user)}
              >
                Assume Role as {user.display_name}
              </button>
              <span className="impersonate-hint">View the app as this user would see it</span>
            </div>
          )}

          {/* Current ship accesses (read-only) */}
          <div className="ship-access-list">
            <h3>Ships with Access</h3>
            {accessLoading ? (
              <p>Loading...</p>
            ) : shipAccesses?.length === 0 ? (
              <p className="no-access">
                {user.role === 'admin'
                  ? 'Admins have access to all ships by default.'
                  : 'No ship-specific access. User relies on their global role.'}
              </p>
            ) : (
              <table className="ship-access-table">
                <thead>
                  <tr>
                    <th>Ship</th>
                    <th>Role Override</th>
                  </tr>
                </thead>
                <tbody>
                  {shipAccesses?.map((access) => (
                    <tr key={access.id}>
                      <td>
                        <span className="ship-name">{access.ship_name}</span>
                        {access.ship_class && (
                          <span className="ship-class">{access.ship_class}</span>
                        )}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="ship-access-note">
              To manage ship access, go to Ships and click the Access button.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { user: currentUser, authEnabled } = useAuth();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shipAccessUser, setShipAccessUser] = useState<User | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ userId: string; password: string } | null>(null);

  // Form state for creating/editing
  const [formData, setFormData] = useState<Partial<UserCreate>>({
    username: '',
    display_name: '',
    password: '',
    role: 'player',
  });

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: authEnabled,
  });

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreating(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdate }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: usersApi.resetPassword,
    onSuccess: (result, userId) => {
      setResetPasswordResult({ userId, password: result.temporary_password });
    },
  });

  const resetForm = () => {
    setFormData({
      username: '',
      display_name: '',
      password: '',
      role: 'player',
    });
  };

  const handleCreate = () => {
    if (!formData.username || !formData.display_name || !formData.password) return;
    createMutation.mutate(formData as UserCreate);
  };

  const handleUpdate = (id: string) => {
    const { password, ...updateData } = formData;
    updateMutation.mutate({ id, data: updateData as UserUpdate });
  };

  const handleDelete = (user: User) => {
    if (user.id === currentUser?.id) {
      alert('Cannot delete your own account');
      return;
    }
    if (confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleResetPassword = (user: User) => {
    if (confirm(`Reset password for "${user.username}"? They will need to change it on next login.`)) {
      resetPasswordMutation.mutate(user.id);
    }
  };

  const handleImpersonate = (user: User) => {
    // Store impersonation in sessionStorage
    sessionStorage.setItem('impersonating', JSON.stringify({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    }));
    // Reload to apply impersonation
    window.location.reload();
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    });
  };

  if (!authEnabled) {
    return (
      <div className="admin-users">
        <div className="admin-users__header">
          <h1>User Management</h1>
        </div>
        <div className="admin-users__notice">
          <p>Authentication is not enabled. Set <code>AUTH_ENABLED=true</code> in your environment to enable user management.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="admin-users">
        <div className="admin-users__header">
          <h1>User Management</h1>
        </div>
        <div className="admin-users__loading">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-users">
        <div className="admin-users__header">
          <h1>User Management</h1>
        </div>
        <div className="admin-users__error">
          Error loading users: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-users">
      <div className="admin-users__header">
        <h1>User Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setIsCreating(true);
            resetForm();
          }}
          disabled={isCreating}
        >
          + Add User
        </button>
      </div>

      {/* Password Reset Result */}
      {resetPasswordResult && (
        <div className="admin-users__password-result">
          <p>Temporary password for user:</p>
          <code>{resetPasswordResult.password}</code>
          <button onClick={() => setResetPasswordResult(null)}>Dismiss</button>
        </div>
      )}

      {/* Create Form */}
      {isCreating && (
        <div className="admin-users__form">
          <h3>Create User</h3>
          <div className="form-row">
            <label>
              Username
              <input
                type="text"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
              />
            </label>
            <label>
              Display Name
              <input
                type="text"
                value={formData.display_name || ''}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Display Name"
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Password
              <input
                type="password"
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Password (min 8 chars)"
              />
            </label>
            <label>
              Role
              <select
                value={formData.role || 'player'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
              >
                <option value="player">Player</option>
                <option value="gm">GM</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setIsCreating(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
          {createMutation.isError && (
            <div className="form-error">
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create user'}
            </div>
          )}
        </div>
      )}

      {/* Users Table */}
      <div className="admin-users__table-wrapper">
        <table className="admin-users__table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Display Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className={user.id === currentUser?.id ? 'current-user' : ''}>
                {editingId === user.id ? (
                  <>
                    <td>
                      <input
                        type="text"
                        value={formData.username || ''}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={formData.display_name || ''}
                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={formData.role || user.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                        disabled={user.id === currentUser?.id}
                      >
                        <option value="player">Player</option>
                        <option value="gm">GM</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`status-badge status-${user.is_active ? 'active' : 'inactive'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleUpdate(user.id)}
                        disabled={updateMutation.isPending}
                      >
                        Save
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{user.username}</td>
                    <td>{user.display_name}</td>
                    <td>
                      <span className={`role-badge role-${user.role}`}>{user.role}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${user.is_active ? 'active' : 'inactive'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {user.must_change_password && (
                        <span className="status-badge status-warning">Must Change Password</span>
                      )}
                    </td>
                    <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}</td>
                    <td className="actions-cell">
                      <button className="btn btn-sm" onClick={() => startEdit(user)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => setShipAccessUser(user)}
                      >
                        Ships
                      </button>
                      {currentUser?.role === 'admin' && user.role !== 'admin' && (
                        <button
                          className="btn btn-sm"
                          onClick={() => handleImpersonate(user)}
                        >
                          Impersonate
                        </button>
                      )}
                      <button
                        className="btn btn-sm"
                        onClick={() => handleResetPassword(user)}
                        disabled={resetPasswordMutation.isPending}
                      >
                        Reset PW
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(user)}
                        disabled={user.id === currentUser?.id || deleteMutation.isPending}
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ship Access Modal */}
      {shipAccessUser && (
        <ShipAccessModal
          user={shipAccessUser}
          onClose={() => setShipAccessUser(null)}
          onImpersonate={handleImpersonate}
        />
      )}
    </div>
  );
}
