import { useState, useMemo, useEffect, useRef } from 'react';
import { useContacts } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useUpdateContact, useCreateContact } from '../../hooks/useMutations';
import { useDataPermissions, useCanCreate } from '../../hooks/usePermissions';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import { EditButton } from '../controls/EditButton';
import type { WidgetRendererProps, Contact, ThreatLevel } from '../../types';
import { getConfig } from '../../types';
import type { ContactTrackerConfig } from '../../types';
import './ContactTrackerWidget.css';

type SortField = 'threat' | 'name' | 'lastContact';
type SortDirection = 'asc' | 'desc';
type FilterType = ThreatLevel | 'all' | 'pinned';

const THREAT_ORDER: Record<ThreatLevel, number> = {
  hostile: 0,
  suspicious: 1,
  unknown: 2,
  neutral: 3,
  friendly: 4,
};

const THREAT_LABELS: Record<ThreatLevel, string> = {
  hostile: 'HOSTILE',
  suspicious: 'SUSPECT',
  unknown: 'UNKNOWN',
  neutral: 'NEUTRAL',
  friendly: 'FRIENDLY',
};

export function ContactTrackerWidget({ instance, isEditing, canEditData, onConfigChange }: WidgetRendererProps) {
  const shipId = useCurrentShipId();
  const config = getConfig<ContactTrackerConfig>(instance.config);
  const { data: contacts, isLoading, error } = useContacts();

  // Sorting and filtering state
  const [sortField, setSortField] = useState<SortField>('threat');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filter, setFilter] = useState<FilterType>('all');

  // Expand/collapse state
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Mutations and permissions
  const updateContact = useUpdateContact();
  const createContact = useCreateContact();
  const contactPermissions = useDataPermissions('contacts');
  const canCreate = useCanCreate('contacts');

  // Pinned contact IDs - use local state for instant updates
  const [pinnedContactIds, setPinnedContactIds] = useState<string[]>(config.pinnedContactIds || []);
  const lastConfigPinnedRef = useRef(config.pinnedContactIds);

  // Only sync from config when it actually changes (external update), not on every render
  useEffect(() => {
    if (config.pinnedContactIds !== lastConfigPinnedRef.current) {
      lastConfigPinnedRef.current = config.pinnedContactIds;
      setPinnedContactIds(config.pinnedContactIds || []);
    }
  }, [config.pinnedContactIds]);

  // Check if a contact is pinned
  const isPinned = (contactId: string) => pinnedContactIds.includes(contactId);

  // Toggle pin status - update local state immediately, persist in background
  const handleTogglePin = (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation(); // Don't trigger row expansion
    const newPinned = isPinned(contactId)
      ? pinnedContactIds.filter(id => id !== contactId)
      : [...pinnedContactIds, contactId];
    setPinnedContactIds(newPinned); // Instant local update
    onConfigChange?.({ ...config, pinnedContactIds: newPinned }); // Persist in background
  };

  // Sort and filter contacts
  const sortedContacts = useMemo(() => {
    if (!contacts) return [];

    // Apply filter
    let filtered = contacts;
    if (filter === 'pinned') {
      filtered = contacts.filter(c => pinnedContactIds.includes(c.id));
    } else if (filter !== 'all') {
      filtered = contacts.filter(c => c.threat_level === filter);
    }

    // Sort with pinned contacts first (unless filtering by pinned or specific threat)
    return filtered.slice().sort((a, b) => {
      // Pinned contacts sort to top when showing all
      if (filter === 'all') {
        const aPinned = isPinned(a.id);
        const bPinned = isPinned(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
      }

      let comparison = 0;
      switch (sortField) {
        case 'threat':
          comparison = THREAT_ORDER[a.threat_level] - THREAT_ORDER[b.threat_level];
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'lastContact':
          const aTime = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          const bTime = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          comparison = bTime - aTime;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [contacts, sortField, sortDirection, filter, pinnedContactIds]);

  // Count contacts by threat level
  const threatCounts = useMemo(() => {
    if (!contacts) return { hostile: 0, suspicious: 0, unknown: 0, neutral: 0, friendly: 0 };
    return contacts.reduce((acc, c) => {
      acc[c.threat_level] = (acc[c.threat_level] || 0) + 1;
      return acc;
    }, {} as Record<ThreatLevel, number>);
  }, [contacts]);

  const pinnedCount = pinnedContactIds.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (contactId: string) => {
    setExpandedContactId(prev => prev === contactId ? null : contactId);
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
        { ...data, ship_id: shipId ?? '' },
        { onSuccess: () => handleCloseModal() }
      );
    } else if (editingContact) {
      updateContact.mutate(
        { id: editingContact.id, data },
        { onSuccess: () => handleCloseModal() }
      );
    }
  };

  const getTimeAgo = (timestamp?: string): string => {
    if (!timestamp) return '-';
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 30) return `${Math.floor(days / 30)}mo`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  };

  const formatDate = (timestamp?: string): string => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="contact-tracker-widget">
        <div className="tracker-header">
          <h3 className="tracker-title">Contact Tracker</h3>
        </div>
        <div className="tracker-content">
          <div className="tracker-empty">
            <div className="empty-icon">...</div>
            <p className="empty-message">Loading contacts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="contact-tracker-widget">
        <div className="tracker-header">
          <h3 className="tracker-title">Contact Tracker</h3>
        </div>
        <div className="tracker-content">
          <div className="tracker-empty">
            <div className="empty-icon">!</div>
            <p className="empty-message">Failed to load contacts</p>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="contact-tracker-widget editing">
        <div className="tracker-header">
          <h3 className="tracker-title">Contact Tracker</h3>
        </div>
        <p className="editing-hint">
          Displays all known contacts with threat indicators, pinning, and expandable details.
        </p>
      </div>
    );
  }

  return (
    <div className="contact-tracker-widget">
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

      <div className="tracker-header">
        <h3 className="tracker-title">Contact Tracker</h3>
        <div className="tracker-header-right">
          <span className="tracker-count">{contacts?.length || 0}</span>
          {canEditData && canCreate && (
            <button className="create-btn" onClick={handleOpenCreate} title="Create new contact">
              + New
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="threat-summary">
        <button
          className={`threat-chip all ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          ALL
        </button>
        {pinnedCount > 0 && (
          <button
            className={`threat-chip pinned ${filter === 'pinned' ? 'active' : ''}`}
            onClick={() => setFilter('pinned')}
          >
            <span className="pin-icon">★</span>
            PINNED ({pinnedCount})
          </button>
        )}
        {threatCounts.hostile > 0 && (
          <button
            className={`threat-chip hostile ${filter === 'hostile' ? 'active' : ''}`}
            onClick={() => setFilter('hostile')}
          >
            <span className="threat-indicator" />
            HOSTILE ({threatCounts.hostile})
          </button>
        )}
        {threatCounts.suspicious > 0 && (
          <button
            className={`threat-chip suspicious ${filter === 'suspicious' ? 'active' : ''}`}
            onClick={() => setFilter('suspicious')}
          >
            <span className="threat-indicator" />
            SUSPECT ({threatCounts.suspicious})
          </button>
        )}
        {threatCounts.unknown > 0 && (
          <button
            className={`threat-chip unknown ${filter === 'unknown' ? 'active' : ''}`}
            onClick={() => setFilter('unknown')}
          >
            <span className="threat-indicator" />
            UNKNOWN ({threatCounts.unknown})
          </button>
        )}
        {threatCounts.neutral > 0 && (
          <button
            className={`threat-chip neutral ${filter === 'neutral' ? 'active' : ''}`}
            onClick={() => setFilter('neutral')}
          >
            <span className="threat-indicator" />
            NEUTRAL ({threatCounts.neutral})
          </button>
        )}
        {threatCounts.friendly > 0 && (
          <button
            className={`threat-chip friendly ${filter === 'friendly' ? 'active' : ''}`}
            onClick={() => setFilter('friendly')}
          >
            <span className="threat-indicator" />
            FRIENDLY ({threatCounts.friendly})
          </button>
        )}
      </div>

      {/* Sort Controls */}
      <div className="tracker-sort">
        <button
          className={`sort-btn ${sortField === 'threat' ? 'active' : ''}`}
          onClick={() => handleSort('threat')}
        >
          Threat {sortField === 'threat' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          className={`sort-btn ${sortField === 'name' ? 'active' : ''}`}
          onClick={() => handleSort('name')}
        >
          Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          className={`sort-btn ${sortField === 'lastContact' ? 'active' : ''}`}
          onClick={() => handleSort('lastContact')}
        >
          Last {sortField === 'lastContact' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      {/* Contact List */}
      <div className="tracker-list">
        {sortedContacts.length === 0 && (
          <div className="tracker-empty">
            <div className="empty-icon">-</div>
            <p className="empty-message">No contacts found</p>
          </div>
        )}

        {sortedContacts.map((contact: Contact) => {
          const isExpanded = expandedContactId === contact.id;
          const contactIsPinned = isPinned(contact.id);

          return (
            <div
              key={contact.id}
              className={`tracker-row threat-${contact.threat_level} ${isExpanded ? 'expanded' : ''} ${contactIsPinned ? 'is-pinned' : ''}`}
            >
              {/* Collapsed Row (always visible) */}
              <div className="row-collapsed" onClick={() => handleRowClick(contact.id)}>
                <div className="row-indicator">
                  <span className="threat-dot" />
                </div>
                <div className="row-main">
                  <span className="contact-name">{contact.name}</span>
                  {contact.affiliation && (
                    <span className="contact-affiliation">{contact.affiliation}</span>
                  )}
                </div>
                <div className="row-meta">
                  <span className={`threat-label threat-${contact.threat_level}`}>
                    {THREAT_LABELS[contact.threat_level]}
                  </span>
                  <span className="last-contact">{getTimeAgo(contact.last_contacted_at)}</span>
                </div>
                <button
                  className={`pin-button ${contactIsPinned ? 'pinned' : ''}`}
                  onClick={(e) => handleTogglePin(e, contact.id)}
                  title={contactIsPinned ? 'Unpin contact' : 'Pin contact'}
                >
                  {contactIsPinned ? '★' : '☆'}
                </button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="row-expanded">
                  <div className="contact-details">
                    {contact.affiliation && (
                      <div className="detail-row">
                        <span className="detail-label">Affiliation</span>
                        <span className="detail-value">{contact.affiliation}</span>
                      </div>
                    )}
                    {contact.role && (
                      <div className="detail-row">
                        <span className="detail-label">Role</span>
                        <span className="detail-value">{contact.role}</span>
                      </div>
                    )}
                    {contact.last_contacted_at && (
                      <div className="detail-row">
                        <span className="detail-label">Last Contact</span>
                        <span className="detail-value">{formatDate(contact.last_contacted_at)}</span>
                      </div>
                    )}
                    {contact.notes && (
                      <div className="detail-notes">
                        <span className="detail-label">Notes</span>
                        <p className="notes-text">{contact.notes}</p>
                      </div>
                    )}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="detail-tags">
                        {contact.tags.map((tag, idx) => (
                          <span key={idx} className="contact-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEditData && (
                    <div className="detail-actions">
                      <EditButton
                        onClick={() => handleOpenEdit(contact)}
                        title={`Edit ${contact.name}`}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
