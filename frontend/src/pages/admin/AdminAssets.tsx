import { useState } from 'react';
import { useAssets } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useUpdateAsset, useCreateAsset, useDeleteAsset } from '../../hooks/useMutations';
import { D20Loader } from '../../components/ui/D20Loader';
import type { Asset, AssetType, SystemStatus, FireMode, MountLocation } from '../../types';
import './Admin.css';

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  energy_weapon: 'Energy Weapon',
  torpedo: 'Torpedo',
  missile: 'Missile',
  railgun: 'Railgun',
  laser: 'Laser',
  particle_beam: 'Particle Beam',
  drone: 'Drone',
  probe: 'Probe',
};

export function AdminAssets() {
  const shipId = useCurrentShipId();
  const { data: assets, isLoading } = useAssets();
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Edit modal state
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editData, setEditData] = useState<Partial<Asset>>({});

  // Create state
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    name: '',
    asset_type: 'energy_weapon',
    status: 'operational',
    ammo_current: 0,
    ammo_max: 0,
    range: 0,
    range_unit: 'km',
    is_armed: false,
    is_ready: true,
  });

  // Mutation hooks
  const updateAsset = useUpdateAsset();
  const createAsset = useCreateAsset();
  const deleteAsset = useDeleteAsset();

  const startEditing = (asset: Asset) => {
    setEditingAsset(asset);
    setEditData({
      name: asset.name,
      asset_type: asset.asset_type,
      status: asset.status,
      mount_location: asset.mount_location,
      ammo_current: asset.ammo_current,
      ammo_max: asset.ammo_max,
      ammo_type: asset.ammo_type,
      range: asset.range,
      range_unit: asset.range_unit,
      damage: asset.damage,
      accuracy: asset.accuracy,
      charge_time: asset.charge_time,
      cooldown: asset.cooldown,
      fire_mode: asset.fire_mode,
      is_armed: asset.is_armed,
      is_ready: asset.is_ready,
    });
  };

  const saveChanges = () => {
    if (!editingAsset) return;
    updateAsset.mutate(
      { id: editingAsset.id, data: editData },
      { onSuccess: () => setEditingAsset(null) }
    );
  };

  const closeEditModal = () => {
    setEditingAsset(null);
    setEditData({});
  };

  const handleCreate = () => {
    if (!newAsset.name) {
      alert('Please enter an asset name');
      return;
    }
    createAsset.mutate(
      { ...newAsset, ship_id: shipId ?? '' },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setNewAsset({
            name: '',
            asset_type: 'energy_weapon',
            status: 'operational',
            ammo_current: 0,
            ammo_max: 0,
            range: 0,
            range_unit: 'km',
            is_armed: false,
            is_ready: true,
          });
        },
      }
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This cannot be undone.`)) {
      deleteAsset.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-loading">
        <D20Loader size={48} speed={3.4} />
        <span>Loading assets...</span>
      </div>
    );
  }

  return (
    <div className="admin-systems">
      <div className="admin-header">
        <h2 className="admin-page-title">Weapons & Assets</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ New Asset'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h3>Create New Asset</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Name</label>
              <input
                type="text"
                value={newAsset.name || ''}
                onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                placeholder="e.g., Port PDC Array"
              />
            </div>

            <div className="form-field">
              <label>Type</label>
              <select
                value={newAsset.asset_type}
                onChange={(e) => setNewAsset({ ...newAsset, asset_type: e.target.value as AssetType })}
              >
                {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Mount Location</label>
              <select
                value={newAsset.mount_location || ''}
                onChange={(e) => setNewAsset({ ...newAsset, mount_location: (e.target.value as MountLocation) || undefined })}
              >
                <option value="">None</option>
                <option value="port">Port</option>
                <option value="starboard">Starboard</option>
                <option value="dorsal">Dorsal</option>
                <option value="ventral">Ventral</option>
                <option value="fore">Fore</option>
                <option value="aft">Aft</option>
              </select>
            </div>

            <div className="form-field">
              <label>Ammo (Current / Max)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  value={newAsset.ammo_current || 0}
                  onChange={(e) => setNewAsset({ ...newAsset, ammo_current: Number(e.target.value) })}
                  placeholder="Current"
                  style={{ flex: 1 }}
                />
                <span>/</span>
                <input
                  type="number"
                  value={newAsset.ammo_max || 0}
                  onChange={(e) => setNewAsset({ ...newAsset, ammo_max: Number(e.target.value) })}
                  placeholder="Max"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Ammo Type</label>
              <input
                type="text"
                value={newAsset.ammo_type || ''}
                onChange={(e) => setNewAsset({ ...newAsset, ammo_type: e.target.value })}
                placeholder="e.g., 20mm, Plasma"
              />
            </div>

            <div className="form-field">
              <label>Range</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  value={newAsset.range || 0}
                  onChange={(e) => setNewAsset({ ...newAsset, range: Number(e.target.value) })}
                  placeholder="Range"
                  style={{ flex: 2 }}
                />
                <input
                  type="text"
                  value={newAsset.range_unit || 'km'}
                  onChange={(e) => setNewAsset({ ...newAsset, range_unit: e.target.value })}
                  placeholder="Unit"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Damage</label>
              <input
                type="number"
                value={newAsset.damage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, damage: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Optional"
              />
            </div>

            <div className="form-field">
              <label>Accuracy (%)</label>
              <input
                type="number"
                value={newAsset.accuracy || ''}
                onChange={(e) => setNewAsset({ ...newAsset, accuracy: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0-100"
                min="0"
                max="100"
              />
            </div>

            <div className="form-field">
              <label>Charge Time (s)</label>
              <input
                type="number"
                step="0.1"
                value={newAsset.charge_time || ''}
                onChange={(e) => setNewAsset({ ...newAsset, charge_time: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Optional"
              />
            </div>

            <div className="form-field">
              <label>Cooldown (s)</label>
              <input
                type="number"
                step="0.1"
                value={newAsset.cooldown || ''}
                onChange={(e) => setNewAsset({ ...newAsset, cooldown: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Optional"
              />
            </div>

            <div className="form-field">
              <label>Fire Mode</label>
              <select
                value={newAsset.fire_mode || ''}
                onChange={(e) => setNewAsset({ ...newAsset, fire_mode: (e.target.value as FireMode) || undefined })}
              >
                <option value="">None</option>
                <option value="single">Single</option>
                <option value="burst">Burst</option>
                <option value="sustained">Sustained</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreate}>
              Create Asset
            </button>
            <button className="btn" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Mount</th>
            <th>Ammo</th>
            <th>Range</th>
            <th>Status</th>
            <th>Armed</th>
            <th>Ready</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets?.map((asset) => (
            <tr key={asset.id}>
              <td><strong>{asset.name}</strong></td>
              <td>
                <span className="badge">{ASSET_TYPE_LABELS[asset.asset_type]}</span>
              </td>
              <td>{asset.mount_location || '—'}</td>
              <td>
                {asset.ammo_max > 0 ? `${asset.ammo_current}/${asset.ammo_max}` : '—'}
              </td>
              <td>{asset.range} {asset.range_unit}</td>
              <td>
                <span className={`status-badge status-${asset.status}`}>
                  {asset.status.replace('_', ' ')}
                </span>
              </td>
              <td><span>{asset.is_armed ? '✓' : '—'}</span></td>
              <td><span>{asset.is_ready ? '✓' : '—'}</span></td>
              <td>
                <button
                  className="btn btn-small"
                  onClick={() => startEditing(asset)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => handleDelete(asset.id, asset.name)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Modal */}
      {editingAsset && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Asset: {editingAsset.name}</h3>
              <button className="modal-close" onClick={closeEditModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Type</label>
                  <select
                    value={editData.asset_type}
                    onChange={(e) => setEditData({ ...editData, asset_type: e.target.value as AssetType })}
                  >
                    {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Status</label>
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value as SystemStatus })}
                  >
                    <option value="optimal">Optimal</option>
                    <option value="operational">Operational</option>
                    <option value="degraded">Degraded</option>
                    <option value="compromised">Compromised</option>
                    <option value="critical">Critical</option>
                    <option value="destroyed">Destroyed</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Mount Location</label>
                  <select
                    value={editData.mount_location || ''}
                    onChange={(e) => setEditData({ ...editData, mount_location: (e.target.value as MountLocation) || undefined })}
                  >
                    <option value="">None</option>
                    <option value="port">Port</option>
                    <option value="starboard">Starboard</option>
                    <option value="dorsal">Dorsal</option>
                    <option value="ventral">Ventral</option>
                    <option value="fore">Fore</option>
                    <option value="aft">Aft</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Ammo (Current / Max)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      value={editData.ammo_current ?? 0}
                      onChange={(e) => setEditData({ ...editData, ammo_current: Number(e.target.value) })}
                      placeholder="Current"
                      style={{ flex: 1 }}
                    />
                    <span>/</span>
                    <input
                      type="number"
                      value={editData.ammo_max ?? 0}
                      onChange={(e) => setEditData({ ...editData, ammo_max: Number(e.target.value) })}
                      placeholder="Max"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Ammo Type</label>
                  <input
                    type="text"
                    value={editData.ammo_type || ''}
                    onChange={(e) => setEditData({ ...editData, ammo_type: e.target.value })}
                    placeholder="e.g., 20mm, Plasma"
                  />
                </div>

                <div className="form-field">
                  <label>Range</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      value={editData.range ?? 0}
                      onChange={(e) => setEditData({ ...editData, range: Number(e.target.value) })}
                      placeholder="Range"
                      style={{ flex: 2 }}
                    />
                    <input
                      type="text"
                      value={editData.range_unit || 'km'}
                      onChange={(e) => setEditData({ ...editData, range_unit: e.target.value })}
                      placeholder="Unit"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Damage</label>
                  <input
                    type="number"
                    value={editData.damage ?? ''}
                    onChange={(e) => setEditData({ ...editData, damage: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-field">
                  <label>Accuracy (%)</label>
                  <input
                    type="number"
                    value={editData.accuracy ?? ''}
                    onChange={(e) => setEditData({ ...editData, accuracy: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="0-100"
                    min="0"
                    max="100"
                  />
                </div>

                <div className="form-field">
                  <label>Charge Time (s)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editData.charge_time ?? ''}
                    onChange={(e) => setEditData({ ...editData, charge_time: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-field">
                  <label>Cooldown (s)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editData.cooldown ?? ''}
                    onChange={(e) => setEditData({ ...editData, cooldown: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-field">
                  <label>Fire Mode</label>
                  <select
                    value={editData.fire_mode || ''}
                    onChange={(e) => setEditData({ ...editData, fire_mode: (e.target.value as FireMode) || undefined })}
                  >
                    <option value="">None</option>
                    <option value="single">Single</option>
                    <option value="burst">Burst</option>
                    <option value="sustained">Sustained</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div className="form-field checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={editData.is_armed ?? false}
                      onChange={(e) => setEditData({ ...editData, is_armed: e.target.checked })}
                    />
                    Armed
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={editData.is_ready ?? true}
                      onChange={(e) => setEditData({ ...editData, is_ready: e.target.checked })}
                    />
                    Ready
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeEditModal}>Cancel</button>
              <button className="btn btn-primary" onClick={saveChanges}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
