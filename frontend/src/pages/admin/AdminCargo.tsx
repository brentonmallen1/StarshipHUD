import { useState } from 'react';
import { useCargo } from '../../hooks/useShipData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cargoApi } from '../../services/api';
import type { Cargo } from '../../types';
import './Admin.css';

export function AdminCargo() {
  const queryClient = useQueryClient();
  const { data: cargo, isLoading } = useCargo();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Edit state
  const [editData, setEditData] = useState<Partial<Cargo>>({});

  // Create state
  const [newCargo, setNewCargo] = useState<Partial<Cargo>>({
    name: '',
    category: '',
    quantity: 0,
    unit: 'units',
    description: '',
    value: 0,
    location: '',
  });

  const updateCargo = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Cargo> }) =>
      cargoApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
      setEditingId(null);
    },
  });

  const createCargo = useMutation({
    mutationFn: (data: Partial<Cargo> & { ship_id: string }) =>
      cargoApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
      setShowCreateForm(false);
      setNewCargo({
        name: '',
        category: '',
        quantity: 0,
        unit: 'units',
        description: '',
        value: 0,
        location: '',
      });
    },
  });

  const deleteCargo = useMutation({
    mutationFn: (id: string) => cargoApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
  });

  const startEditing = (item: Cargo) => {
    setEditingId(item.id);
    setEditData({
      quantity: item.quantity,
      value: item.value,
      location: item.location,
      description: item.description,
    });
  };

  const saveChanges = (cargoId: string) => {
    updateCargo.mutate({ id: cargoId, data: editData });
  };

  const handleCreate = () => {
    if (!newCargo.name) {
      alert('Please enter a cargo name');
      return;
    }
    createCargo.mutate({ ...newCargo, ship_id: 'constellation' });
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This cannot be undone.`)) {
      deleteCargo.mutate(id);
    }
  };

  // Group cargo by category
  const groupedCargo = cargo?.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, Cargo[]>);

  if (isLoading) {
    return <div className="loading">Loading cargo inventory...</div>;
  }

  return (
    <div className="admin-systems">
      <div className="admin-header">
        <h2 className="admin-page-title">Cargo Inventory</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ New Cargo Item'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h3>Add Cargo Item</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Name</label>
              <input
                type="text"
                value={newCargo.name || ''}
                onChange={(e) => setNewCargo({ ...newCargo, name: e.target.value })}
                placeholder="e.g., Emergency Rations"
              />
            </div>

            <div className="form-field">
              <label>Category</label>
              <input
                type="text"
                value={newCargo.category || ''}
                onChange={(e) => setNewCargo({ ...newCargo, category: e.target.value })}
                placeholder="e.g., Life Support, Fuel & Energy"
                list="cargo-categories"
              />
              <datalist id="cargo-categories">
                <option value="Life Support" />
                <option value="Fuel & Energy" />
                <option value="Maintenance" />
                <option value="Medical" />
                <option value="Ordnance" />
                <option value="Trade" />
              </datalist>
            </div>

            <div className="form-field">
              <label>Quantity</label>
              <input
                type="number"
                step="0.01"
                value={newCargo.quantity || 0}
                onChange={(e) => setNewCargo({ ...newCargo, quantity: Number(e.target.value) })}
                placeholder="0"
              />
            </div>

            <div className="form-field">
              <label>Unit</label>
              <input
                type="text"
                value={newCargo.unit || 'units'}
                onChange={(e) => setNewCargo({ ...newCargo, unit: e.target.value })}
                placeholder="units, kg, liters, etc."
              />
            </div>

            <div className="form-field">
              <label>Value (per unit)</label>
              <input
                type="number"
                step="0.01"
                value={newCargo.value || 0}
                onChange={(e) => setNewCargo({ ...newCargo, value: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>

            <div className="form-field">
              <label>Location</label>
              <input
                type="text"
                value={newCargo.location || ''}
                onChange={(e) => setNewCargo({ ...newCargo, location: e.target.value })}
                placeholder="e.g., Cargo Bay 1"
              />
            </div>

            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea
                value={newCargo.description || ''}
                onChange={(e) => setNewCargo({ ...newCargo, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreate}>
              Add Cargo
            </button>
            <button className="btn" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {groupedCargo && Object.entries(groupedCargo).map(([category, items]) => (
        <div key={category} style={{ marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
            {category} ({items.length})
          </h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Value/Unit</th>
                <th>Total Value</th>
                <th>Location</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>
                    {editingId === item.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editData.quantity ?? item.quantity}
                        onChange={(e) => setEditData({ ...editData, quantity: Number(e.target.value) })}
                        style={{ width: '100px' }}
                      />
                    ) : (
                      item.quantity.toLocaleString()
                    )}
                  </td>
                  <td>{item.unit}</td>
                  <td>
                    {editingId === item.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editData.value ?? item.value ?? 0}
                        onChange={(e) => setEditData({ ...editData, value: Number(e.target.value) })}
                        style={{ width: '80px' }}
                      />
                    ) : (
                      item.value ? `$${item.value.toFixed(2)}` : '—'
                    )}
                  </td>
                  <td>
                    {item.value ? `$${(item.quantity * item.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td>
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editData.location ?? item.location ?? ''}
                        onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                        style={{ width: '120px' }}
                      />
                    ) : (
                      item.location || '—'
                    )}
                  </td>
                  <td style={{ maxWidth: '200px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editData.description ?? item.description ?? ''}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        style={{ width: '180px' }}
                      />
                    ) : (
                      item.description || '—'
                    )}
                  </td>
                  <td>
                    {editingId === item.id ? (
                      <>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => saveChanges(item.id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-small"
                          onClick={() => startEditing(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => handleDelete(item.id, item.name)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {(!cargo || cargo.length === 0) && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)' }}>
          No cargo items found. Add one to get started.
        </div>
      )}
    </div>
  );
}
