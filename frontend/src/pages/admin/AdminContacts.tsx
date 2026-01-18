import { useState } from 'react';
import { useContacts } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useUpdateContact, useCreateContact, useDeleteContact } from '../../hooks/useMutations';
import type { Contact, ThreatLevel } from '../../types';
import './Admin.css';

export function AdminContacts() {
  const shipId = useCurrentShipId();
  const { data: contacts, isLoading } = useContacts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Edit state
  const [editData, setEditData] = useState<Partial<Contact>>({});

  // Create state
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: '',
    affiliation: '',
    threat_level: 'unknown' as ThreatLevel,
    role: '',
    notes: '',
    tags: [],
  });

  // Mutation hooks
  const updateContact = useUpdateContact();
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();

  const startEditing = (contact: Contact) => {
    setEditingId(contact.id);
    setEditData({
      affiliation: contact.affiliation,
      threat_level: contact.threat_level,
      role: contact.role,
      notes: contact.notes,
    });
  };

  const saveChanges = (contactId: string) => {
    updateContact.mutate(
      { id: contactId, data: editData },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const handleCreate = () => {
    if (!newContact.name) {
      alert('Please enter a contact name');
      return;
    }
    createContact.mutate(
      { ...newContact, ship_id: shipId ?? '' },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setNewContact({
            name: '',
            affiliation: '',
            threat_level: 'unknown' as ThreatLevel,
            role: '',
            notes: '',
            tags: [],
          });
        },
      }
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This cannot be undone.`)) {
      deleteContact.mutate(id);
    }
  };

  const handleMarkContacted = (contactId: string) => {
    const now = new Date().toISOString();
    updateContact.mutate({ id: contactId, data: { last_contacted_at: now } });
  };

  // Group contacts by threat level
  const groupedContacts = contacts?.reduce((acc, contact) => {
    const level = contact.threat_level || 'unknown';
    if (!acc[level]) {
      acc[level] = [];
    }
    acc[level].push(contact);
    return acc;
  }, {} as Record<string, Contact[]>);

  const threatLevelOrder: ThreatLevel[] = ['hostile', 'suspicious', 'neutral', 'friendly', 'unknown'];

  if (isLoading) {
    return <div className="loading">Loading contacts...</div>;
  }

  return (
    <div className="admin-systems">
      <div className="admin-header">
        <h2 className="admin-page-title">Contacts & Dossiers</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ New Contact'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h3>Add Contact</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Name</label>
              <input
                type="text"
                value={newContact.name || ''}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="e.g., Captain Elena Vasquez"
              />
            </div>

            <div className="form-field">
              <label>Affiliation</label>
              <input
                type="text"
                value={newContact.affiliation || ''}
                onChange={(e) => setNewContact({ ...newContact, affiliation: e.target.value })}
                placeholder="e.g., Mars Colonial Navy, Independent Trader"
              />
            </div>

            <div className="form-field">
              <label>Threat Level</label>
              <select
                value={newContact.threat_level || 'unknown'}
                onChange={(e) => setNewContact({ ...newContact, threat_level: e.target.value as ThreatLevel })}
              >
                <option value="friendly">Friendly</option>
                <option value="neutral">Neutral</option>
                <option value="suspicious">Suspicious</option>
                <option value="hostile">Hostile</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="form-field">
              <label>Role</label>
              <input
                type="text"
                value={newContact.role || ''}
                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                placeholder="e.g., Ship Captain, Merchant, Official"
              />
            </div>

            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                value={newContact.notes || ''}
                onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                placeholder="Background, known associates, etc."
                rows={3}
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreate}>
              Add Contact
            </button>
            <button className="btn" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {groupedContacts && threatLevelOrder.map((threatLevel) => {
        const items = groupedContacts[threatLevel];
        if (!items || items.length === 0) return null;

        return (
          <div key={threatLevel} style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
              {threatLevel} ({items.length})
            </h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Affiliation</th>
                  <th>Threat Level</th>
                  <th>Role</th>
                  <th>Last Contacted</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((contact) => (
                  <tr key={contact.id}>
                    <td><strong>{contact.name}</strong></td>
                    <td>
                      {editingId === contact.id ? (
                        <input
                          type="text"
                          value={editData.affiliation ?? contact.affiliation ?? ''}
                          onChange={(e) => setEditData({ ...editData, affiliation: e.target.value })}
                          style={{ width: '180px' }}
                        />
                      ) : (
                        contact.affiliation || '—'
                      )}
                    </td>
                    <td>
                      {editingId === contact.id ? (
                        <select
                          value={editData.threat_level ?? contact.threat_level}
                          onChange={(e) => setEditData({ ...editData, threat_level: e.target.value as ThreatLevel })}
                        >
                          <option value="friendly">Friendly</option>
                          <option value="neutral">Neutral</option>
                          <option value="suspicious">Suspicious</option>
                          <option value="hostile">Hostile</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      ) : (
                        <span className={`status-badge threat-${contact.threat_level}`}>
                          {contact.threat_level}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingId === contact.id ? (
                        <input
                          type="text"
                          value={editData.role ?? contact.role ?? ''}
                          onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                          style={{ width: '140px' }}
                        />
                      ) : (
                        contact.role || '—'
                      )}
                    </td>
                    <td>
                      {contact.last_contacted_at ? (
                        <span style={{ fontSize: '0.875rem' }}>
                          {new Date(contact.last_contacted_at).toLocaleDateString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ maxWidth: '200px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      {editingId === contact.id ? (
                        <input
                          type="text"
                          value={editData.notes ?? contact.notes ?? ''}
                          onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                          style={{ width: '180px' }}
                        />
                      ) : (
                        contact.notes || '—'
                      )}
                    </td>
                    <td>
                      {editingId === contact.id ? (
                        <>
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => saveChanges(contact.id)}
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
                            onClick={() => startEditing(contact)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-small"
                            onClick={() => handleMarkContacted(contact.id)}
                            title="Mark as contacted now"
                          >
                            Contact
                          </button>
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => handleDelete(contact.id, contact.name)}
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

      {(!contacts || contacts.length === 0) && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)' }}>
          No contacts found. Add one to get started.
        </div>
      )}
    </div>
  );
}
