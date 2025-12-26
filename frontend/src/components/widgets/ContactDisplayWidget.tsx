import { useState, useEffect } from 'react';
import { useContacts } from '../../hooks/useShipData';
import { useUpdateContact, useCreateContact } from '../../hooks/useMutations';
import { useDataPermissions, useCanCreate } from '../../hooks/usePermissions';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import { EditButton } from '../controls/EditButton';
import type { WidgetRendererProps, ThreatLevel, Contact } from '../../types';
import './ContactDisplayWidget.css';

interface ContactConfig {
  contact_id?: string;
  selected_contacts?: string[];
}

const THREAT_LEVEL_LABELS: Record<ThreatLevel, string> = {
  friendly: 'Friendly',
  neutral: 'Neutral',
  suspicious: 'Suspicious',
  hostile: 'Hostile',
  unknown: 'Unknown',
};

export function ContactDisplayWidget({ instance, isEditing, canEditData, onConfigChange }: WidgetRendererProps) {
  const config = instance.config as ContactConfig;
  const { data: allContacts } = useContacts();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Mutation and permission hooks
  const updateContact = useUpdateContact();
  const createContact = useCreateContact();
  const contactPermissions = useDataPermissions('contacts');
  const canCreate = useCanCreate('contacts');

  // Track multiple selected contacts
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    config.selected_contacts || (config.contact_id ? [config.contact_id] : [])
  );

  // Dropdown selection state
  const [dropdownValue, setDropdownValue] = useState<string>('');

  // Update selected contacts when config changes
  useEffect(() => {
    if (config.selected_contacts) {
      setSelectedContactIds(config.selected_contacts);
    } else if (config.contact_id) {
      setSelectedContactIds([config.contact_id]);
    }
  }, [config.selected_contacts, config.contact_id]);

  // Get selected contact objects
  const selectedContacts = selectedContactIds
    .map((id) => allContacts?.find((c) => c.id === id))
    .filter((c): c is Contact => c !== undefined);

  // Handle adding a contact from dropdown
  const handleAddContact = (contactId: string) => {
    if (contactId && !selectedContactIds.includes(contactId)) {
      const newSelection = [...selectedContactIds, contactId];
      setSelectedContactIds(newSelection);
      // Persist the selection to widget config
      onConfigChange?.({ ...config, selected_contacts: newSelection });
    }
    setDropdownValue(''); // Reset dropdown
  };

  // Handle removing a contact
  const handleRemoveContact = (contactId: string) => {
    const newSelection = selectedContactIds.filter((id) => id !== contactId);
    setSelectedContactIds(newSelection);
    // Persist the selection to widget config
    onConfigChange?.({ ...config, selected_contacts: newSelection });
  };

  // Modal handlers
  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsCreatingNew(false);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingContact(null);
    setIsCreatingNew(true);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
    setIsCreatingNew(false);
  };

  const handleModalSave = (data: Partial<Contact>) => {
    if (isCreatingNew) {
      createContact.mutate(
        { ...data, ship_id: 'constellation' },
        {
          onSuccess: (newContact) => {
            // Add newly created contact to selected list
            if (newContact?.id) {
              const newSelection = [...selectedContactIds, newContact.id];
              setSelectedContactIds(newSelection);
              // Persist the selection to widget config
              onConfigChange?.({ ...config, selected_contacts: newSelection });
            }
            handleCloseModal();
          },
        }
      );
    } else if (editingContact) {
      updateContact.mutate(
        { id: editingContact.id, data },
        { onSuccess: () => handleCloseModal() }
      );
    }
  };

  // Sort contacts by name
  const sortedContacts = allContacts?.slice().sort((a, b) => a.name.localeCompare(b.name)) || [];

  // Available contacts (not already selected)
  const availableContacts = sortedContacts.filter((c) => !selectedContactIds.includes(c.id));

  if (isEditing) {
    return (
      <div className="contact-display-widget editing">
        <div className="contact-header">
          <h3 className="contact-selector-label">Contact Display Widget</h3>
        </div>
        <p className="editing-hint">
          Players can select multiple contacts to view at once.
          {selectedContactIds.length > 0 && ` Currently ${selectedContactIds.length} contact(s) selected.`}
        </p>
      </div>
    );
  }

  return (
    <div className="contact-display-widget">
      {/* Player Edit Modal */}
      {canEditData && (
        <PlayerEditModal
          isOpen={isModalOpen}
          dataType="contacts"
          record={isCreatingNew ? null : editingContact}
          permissions={contactPermissions}
          onSave={handleModalSave}
          onCancel={handleCloseModal}
          title={isCreatingNew ? 'Create New Contact' : `Edit ${editingContact?.name || 'Contact'}`}
          isLoading={isCreatingNew ? createContact.isPending : updateContact.isPending}
          error={isCreatingNew ? createContact.error?.message : updateContact.error?.message}
        />
      )}

      {/* Contact Selector */}
      <div className="contact-selector-container">
        <select
          className="contact-selector"
          value={dropdownValue}
          onChange={(e) => handleAddContact(e.target.value)}
        >
          <option value="">+ Add Contact</option>
          {availableContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Create New Contact Button */}
        {canEditData && canCreate && (
          <button className="contact-create-btn" onClick={handleOpenCreate} title="Create new contact">
            + New Contact
          </button>
        )}
      </div>

      {/* Selected Contacts List */}
      <div className="contacts-list">
        {selectedContacts.length > 0 ? (
          selectedContacts.map((contact) => (
            <div
              key={contact.id}
              className={`contact-card threat-${contact.threat_level}`}
              style={{ position: 'relative' }}
            >
              {/* Edit Button */}
              {canEditData && (
                <EditButton
                  onClick={() => handleOpenEdit(contact)}
                  title={`Edit ${contact.name}`}
                />
              )}

              {/* Remove Button */}
              <button
                className="contact-remove-btn"
                onClick={() => handleRemoveContact(contact.id)}
                title="Remove contact"
              >
                ×
              </button>

              {/* Contact Header */}
              <div className="contact-header">
                <h3 className="contact-name">{contact.name}</h3>
                <span className={`threat-badge threat-${contact.threat_level}`}>
                  <span className="threat-dot" />
                  {THREAT_LEVEL_LABELS[contact.threat_level]}
                </span>
              </div>

              {/* Contact Details */}
              <div className="contact-details">
                {contact.affiliation && (
                  <div className="contact-detail">
                    <span className="contact-detail-label">Affiliation</span>
                    <span className="contact-detail-value">{contact.affiliation}</span>
                  </div>
                )}

                {contact.role && (
                  <div className="contact-detail">
                    <span className="contact-detail-label">Role</span>
                    <span className="contact-detail-value">{contact.role}</span>
                  </div>
                )}

                {contact.last_contacted_at && (
                  <div className="contact-detail">
                    <span className="contact-detail-label">Last Contact</span>
                    <span className="contact-detail-value">
                      {new Date(contact.last_contacted_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}

                {contact.notes && (
                  <div className="contact-notes">
                    <span className="contact-detail-label">Notes</span>
                    <p className="contact-notes-text">{contact.notes}</p>
                  </div>
                )}

                {contact.tags && contact.tags.length > 0 && (
                  <div className="contact-tags">
                    {contact.tags.map((tag, idx) => (
                      <span key={idx} className="contact-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="contact-empty">
            <p>Select contacts to view their details</p>
          </div>
        )}
      </div>
    </div>
  );
}
