import { useState } from 'react';
import { useCrew } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useUpdateCrew, useCreateCrew, useDeleteCrew } from '../../hooks/useMutations';
import type { Crew, CrewStatus } from '../../types';
import './Admin.css';

const CREW_STATUS_LABELS: Record<CrewStatus, string> = {
  fit_for_duty: 'Fit for Duty',
  light_duty: 'Light Duty',
  incapacitated: 'Incapacitated',
  critical: 'Critical',
  deceased: 'Deceased',
  on_leave: 'On Leave',
  missing: 'Missing',
};

const CREW_STATUS_ORDER: CrewStatus[] = [
  'critical',
  'incapacitated',
  'light_duty',
  'fit_for_duty',
  'on_leave',
  'missing',
  'deceased',
];

export function AdminCrew() {
  const shipId = useCurrentShipId();
  const { data: crew, isLoading } = useCrew();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Edit state
  const [editData, setEditData] = useState<Partial<Crew>>({});
  const [editTagInput, setEditTagInput] = useState('');

  // Create state
  const [newCrew, setNewCrew] = useState<Partial<Crew>>({
    name: '',
    role: '',
    status: 'fit_for_duty' as CrewStatus,
    player_name: '',
    is_npc: true,
    notes: '',
    condition_tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  // Mutation hooks
  const updateCrew = useUpdateCrew();
  const createCrew = useCreateCrew();
  const deleteCrew = useDeleteCrew();

  const startEditing = (member: Crew) => {
    setEditingId(member.id);
    setEditData({
      name: member.name,
      role: member.role,
      status: member.status,
      player_name: member.player_name,
      is_npc: member.is_npc,
      notes: member.notes,
      condition_tags: [...member.condition_tags],
    });
    setEditTagInput('');
  };

  const saveChanges = (crewId: string) => {
    updateCrew.mutate(
      { id: crewId, data: editData },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const handleCreate = () => {
    if (!newCrew.name) {
      alert('Please enter a crew member name');
      return;
    }
    createCrew.mutate(
      { ...newCrew, ship_id: shipId ?? '' },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setNewCrew({
            name: '',
            role: '',
            status: 'fit_for_duty' as CrewStatus,
            player_name: '',
            is_npc: true,
            notes: '',
            condition_tags: [],
          });
          setTagInput('');
        },
      }
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This cannot be undone.`)) {
      deleteCrew.mutate(id);
    }
  };

  // Condition tag management for create form
  const addConditionTag = () => {
    if (tagInput.trim()) {
      setNewCrew({
        ...newCrew,
        condition_tags: [...(newCrew.condition_tags || []), tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const removeConditionTag = (index: number) => {
    const tags = [...(newCrew.condition_tags || [])];
    tags.splice(index, 1);
    setNewCrew({ ...newCrew, condition_tags: tags });
  };

  // Condition tag management for edit form
  const addEditConditionTag = () => {
    if (editTagInput.trim()) {
      setEditData({
        ...editData,
        condition_tags: [...(editData.condition_tags || []), editTagInput.trim()],
      });
      setEditTagInput('');
    }
  };

  const removeEditConditionTag = (index: number) => {
    const tags = [...(editData.condition_tags || [])];
    tags.splice(index, 1);
    setEditData({ ...editData, condition_tags: tags });
  };

  // Group crew by status
  const groupedCrew = crew?.reduce((acc, member) => {
    const status = member.status || 'fit_for_duty';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(member);
    return acc;
  }, {} as Record<string, Crew[]>);

  if (isLoading) {
    return <div className="loading">Loading crew...</div>;
  }

  return (
    <div className="admin-systems">
      <div className="admin-header">
        <h2 className="admin-page-title">Crew Management</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ New Crew Member'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h3>Add Crew Member</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Name *</label>
              <input
                type="text"
                value={newCrew.name || ''}
                onChange={(e) => setNewCrew({ ...newCrew, name: e.target.value })}
                placeholder="e.g., Lt. Sarah Mitchell"
              />
            </div>

            <div className="form-field">
              <label>Role/Station</label>
              <input
                type="text"
                value={newCrew.role || ''}
                onChange={(e) => setNewCrew({ ...newCrew, role: e.target.value })}
                placeholder="e.g., Engineer, Pilot, Captain"
              />
            </div>

            <div className="form-field">
              <label>Status</label>
              <select
                value={newCrew.status || 'fit_for_duty'}
                onChange={(e) => setNewCrew({ ...newCrew, status: e.target.value as CrewStatus })}
              >
                {CREW_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {CREW_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'column' }}>
                NPC
                <input
                  type="checkbox"
                  checked={newCrew.is_npc}
                  onChange={(e) => setNewCrew({ ...newCrew, is_npc: e.target.checked, player_name: e.target.checked ? '' : newCrew.player_name })}
                />
              </label>
            </div>

            {!newCrew.is_npc && (
              <div className="form-field">
                <label>Player Name</label>
                <input
                  type="text"
                  value={newCrew.player_name || ''}
                  onChange={(e) => setNewCrew({ ...newCrew, player_name: e.target.value })}
                  placeholder="Player's real name"
                />
              </div>
            )}

            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                value={newCrew.notes || ''}
                onChange={(e) => setNewCrew({ ...newCrew, notes: e.target.value })}
                placeholder="Background, skills, current assignment..."
                rows={3}
              />
            </div>

            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Condition Tags</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="e.g., poisoned, bleeding"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addConditionTag();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-small" onClick={addConditionTag}>
                  Add Tag
                </button>
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {newCrew.condition_tags?.map((tag, idx) => (
                  <span
                    key={idx}
                    className="badge badge-warning"
                    style={{ cursor: 'pointer' }}
                    onClick={() => removeConditionTag(idx)}
                    title="Click to remove"
                  >
                    {tag} x
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreate}>
              Add Crew Member
            </button>
            <button className="btn" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Crew grouped by status */}
      {groupedCrew && CREW_STATUS_ORDER.map((status) => {
        const members = groupedCrew[status];
        if (!members || members.length === 0) return null;

        return (
          <div key={status} style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
              {CREW_STATUS_LABELS[status]} ({members.length})
            </h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Conditions</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      {editingId === member.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <input
                            type="text"
                            value={editData.name ?? member.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            style={{ width: '160px', fontWeight: 'bold' }}
                          />
                          {!editData.is_npc && (
                            <input
                              type="text"
                              value={editData.player_name ?? member.player_name ?? ''}
                              onChange={(e) => setEditData({ ...editData, player_name: e.target.value })}
                              placeholder="Player name"
                              style={{ width: '160px', fontSize: '0.85em' }}
                            />
                          )}
                        </div>
                      ) : (
                        <>
                          <strong>{member.name}</strong>
                          {member.player_name && (
                            <span style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                              ({member.player_name})
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      {editingId === member.id ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={editData.is_npc ?? member.is_npc}
                            onChange={(e) => setEditData({
                              ...editData,
                              is_npc: e.target.checked,
                              player_name: e.target.checked ? '' : editData.player_name,
                            })}
                          />
                          NPC
                        </label>
                      ) : (
                        <span className={`badge ${member.is_npc ? '' : 'badge-accent'}`}>
                          {member.is_npc ? 'NPC' : 'PC'}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingId === member.id ? (
                        <input
                          type="text"
                          value={editData.role ?? member.role ?? ''}
                          onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                          style={{ width: '120px' }}
                        />
                      ) : (
                        member.role || '—'
                      )}
                    </td>
                    <td>
                      {editingId === member.id ? (
                        <select
                          value={editData.status ?? member.status}
                          onChange={(e) => setEditData({ ...editData, status: e.target.value as CrewStatus })}
                        >
                          {CREW_STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>{CREW_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`status-badge crew-status-${member.status}`}>
                          {CREW_STATUS_LABELS[member.status]}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingId === member.id ? (
                        <div style={{ minWidth: '150px' }}>
                          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                            <input
                              type="text"
                              value={editTagInput}
                              onChange={(e) => setEditTagInput(e.target.value)}
                              placeholder="Add tag"
                              style={{ width: '80px' }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addEditConditionTag();
                                }
                              }}
                            />
                            <button className="btn btn-small" onClick={addEditConditionTag}>+</button>
                          </div>
                          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                            {editData.condition_tags?.map((tag, idx) => (
                              <span
                                key={idx}
                                className="badge badge-warning"
                                style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                                onClick={() => removeEditConditionTag(idx)}
                                title="Click to remove"
                              >
                                {tag} x
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        member.condition_tags.length > 0 ? (
                          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                            {member.condition_tags.map((tag, idx) => (
                              <span key={idx} className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )
                      )}
                    </td>
                    <td style={{ maxWidth: '200px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      {editingId === member.id ? (
                        <input
                          type="text"
                          value={editData.notes ?? member.notes ?? ''}
                          onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                          style={{ width: '180px' }}
                        />
                      ) : (
                        member.notes || '—'
                      )}
                    </td>
                    <td>
                      {editingId === member.id ? (
                        <>
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => saveChanges(member.id)}
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
                            onClick={() => startEditing(member)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => handleDelete(member.id, member.name)}
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
        );
      })}

      {(!crew || crew.length === 0) && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)' }}>
          No crew members found. Add one to get started.
        </div>
      )}
    </div>
  );
}
