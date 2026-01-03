import { useState, useRef, useEffect } from 'react';
import { useSystemStates } from '../../hooks/useShipData';
import { useUpdateSystemState } from '../../hooks/useMutations';
import type { SystemStatus } from '../../types';
import './Admin.css';

export function AdminSystems() {
  const { data: systems, isLoading } = useSystemStates();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<SystemStatus>('operational');
  const [editDependsOn, setEditDependsOn] = useState<string[]>([]);
  const [originalValue, setOriginalValue] = useState<number>(0);
  const [originalStatus, setOriginalStatus] = useState<SystemStatus>('operational');
  const [originalDependsOn, setOriginalDependsOn] = useState<string[]>([]);
  const [showDepsDropdown, setShowDepsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mutation hook
  const updateSystem = useUpdateSystemState();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDepsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const startEditing = (id: string, value: number, status: SystemStatus, dependsOn: string[]) => {
    setEditingId(id);
    setEditValue(value);
    setEditStatus(status);
    setEditDependsOn(dependsOn || []);
    setOriginalValue(value);
    setOriginalStatus(status);
    setOriginalDependsOn(dependsOn || []);
    setShowDepsDropdown(false);
  };

  const saveChanges = (systemId: string) => {
    // Only send the fields that actually changed
    const data: { value?: number; status?: SystemStatus; depends_on?: string[] } = {};

    if (editValue !== originalValue) {
      data.value = editValue;
    }

    if (editStatus !== originalStatus) {
      data.status = editStatus;
    }

    // Compare depends_on arrays
    const depsChanged = JSON.stringify(editDependsOn.sort()) !== JSON.stringify(originalDependsOn.sort());
    if (depsChanged) {
      data.depends_on = editDependsOn;
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

  const toggleDependency = (depId: string) => {
    setEditDependsOn(prev =>
      prev.includes(depId)
        ? prev.filter(id => id !== depId)
        : [...prev, depId]
    );
  };

  const getSystemName = (id: string) => {
    return systems?.find(s => s.id === id)?.name || id;
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
            <th>Depends On</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {systems?.map((system) => {
            const isCapped = system.effective_status && system.effective_status !== system.status;

            return (
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
                    <span className={`status-${system.effective_status || system.status}`}>
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
                    <div className="status-cell">
                      <span className={`status-badge status-${system.effective_status || system.status}`}>
                        {(system.effective_status || system.status).replace('_', ' ')}
                      </span>
                      {isCapped && (
                        <span className="capped-indicator" title={`Own status: ${system.status.replace('_', ' ')} (capped by dependency)`}>
                          ⚠
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {editingId === system.id ? (
                    <div className="deps-editor" ref={dropdownRef}>
                      <button
                        className="deps-dropdown-btn"
                        onClick={() => setShowDepsDropdown(!showDepsDropdown)}
                      >
                        {editDependsOn.length === 0
                          ? 'None'
                          : `${editDependsOn.length} selected`}
                        <span className="dropdown-arrow">▼</span>
                      </button>
                      {showDepsDropdown && (
                        <div className="deps-dropdown">
                          {systems
                            ?.filter(s => s.id !== system.id)
                            .map(s => (
                              <label key={s.id} className="deps-option">
                                <input
                                  type="checkbox"
                                  checked={editDependsOn.includes(s.id)}
                                  onChange={() => toggleDependency(s.id)}
                                />
                                {s.name}
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="deps-list">
                      {system.depends_on?.length > 0
                        ? system.depends_on.map(getSystemName).join(', ')
                        : '—'}
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
                        startEditing(system.id, system.value, system.status, system.depends_on)
                      }
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
