import { useState } from 'react';
import { useSystemStates } from '../../hooks/useShipData';
import { useUpdateSystemState } from '../../hooks/useMutations';
import type { SystemStatus } from '../../types';
import './Admin.css';

export function AdminSystems() {
  const { data: systems, isLoading } = useSystemStates();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<SystemStatus>('operational');
  const [originalValue, setOriginalValue] = useState<number>(0);
  const [originalStatus, setOriginalStatus] = useState<SystemStatus>('operational');

  // Mutation hook
  const updateSystem = useUpdateSystemState();

  const startEditing = (id: string, value: number, status: SystemStatus) => {
    setEditingId(id);
    setEditValue(value);
    setEditStatus(status);
    setOriginalValue(value);
    setOriginalStatus(status);
  };

  const saveChanges = (systemId: string) => {
    // Only send the fields that actually changed to enable bidirectional calculation
    const data: { value?: number; status?: SystemStatus } = {};

    if (editValue !== originalValue) {
      data.value = editValue;
    }

    if (editStatus !== originalStatus) {
      data.status = editStatus;
    }

    // Only update if something actually changed
    if (Object.keys(data).length > 0) {
      updateSystem.mutate(
        { id: systemId, data },
        { onSuccess: () => setEditingId(null) }
      );
    } else {
      setEditingId(null);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading systems...</div>;
  }

  return (
    <div className="admin-systems">
      <h2 className="admin-page-title">System States</h2>

      <table className="admin-table">
        <thead>
          <tr>
            <th>System</th>
            <th>Category</th>
            <th>Value</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {systems?.map((system) => (
            <tr key={system.id}>
              <td>{system.name}</td>
              <td>
                <span className="badge">{system.category}</span>
              </td>
              <td>
                {editingId === system.id ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(Number(e.target.value))}
                    min={0}
                    max={system.max_value}
                    style={{ width: '80px' }}
                  />
                ) : (
                  <span className={`status-${system.status}`}>
                    {system.value}{system.unit}
                  </span>
                )}
              </td>
              <td>
                {editingId === system.id ? (
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as SystemStatus)}
                  >
                    <option value="fully_operational">Fully Operational</option>
                    <option value="operational">Operational</option>
                    <option value="degraded">Degraded</option>
                    <option value="compromised">Compromised</option>
                    <option value="critical">Critical</option>
                    <option value="destroyed">Destroyed</option>
                    <option value="offline">Offline</option>
                  </select>
                ) : (
                  <span className={`status-badge status-${system.status}`}>
                    {system.status.replace('_', ' ')}
                  </span>
                )}
              </td>
              <td>
                {editingId === system.id ? (
                  <>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => saveChanges(system.id)}
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
                  <button
                    className="btn btn-small"
                    onClick={() =>
                      startEditing(system.id, system.value, system.status)
                    }
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
