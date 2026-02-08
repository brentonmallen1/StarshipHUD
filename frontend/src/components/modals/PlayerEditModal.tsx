import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Asset, Cargo, Contact, SystemState } from '../../types';
import type { DataTypePermissions } from '../../permissions/dataPermissions';
import { FieldEditor, STATUS_OPTIONS, THREAT_LEVEL_OPTIONS } from './FieldEditor';
import { useValidateData } from '../../hooks/useValidation';
import './PlayerEditModal.css';

// Union type for all editable records
type EditableRecord = Asset | Cargo | Contact | SystemState;

interface PlayerEditModalProps {
  isOpen: boolean;
  dataType: 'assets' | 'cargo' | 'contacts' | 'systemStates';
  record: EditableRecord | null;
  permissions: DataTypePermissions;
  onSave: (data: Partial<EditableRecord>) => void;
  onCancel: () => void;
  title?: string;
  isLoading?: boolean;
  error?: string | null;
  /** For systemStates: limit which fields are shown. If omitted, shows all fields. */
  visibleFields?: ('status' | 'value')[];
}

/**
 * PlayerEditModal - Diegetic modal for editing game data
 *
 * Used for complex editing scenarios like contact notes, cargo details, etc.
 * Styled as a ship's computer interface, not a generic modal.
 */
export function PlayerEditModal({
  isOpen,
  dataType,
  record,
  permissions,
  onSave,
  onCancel,
  title,
  isLoading = false,
  error = null,
  visibleFields,
}: PlayerEditModalProps) {
  const [editData, setEditData] = useState<Partial<EditableRecord>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Validation hook
  const validate = useValidateData(dataType);

  // Reset edit data when record changes
  useEffect(() => {
    if (record) {
      setEditData({ ...record });
    } else {
      setEditData({});
    }
    setValidationErrors({});
  }, [record]);

  if (!isOpen) return null;

  // Helper to convert permissions to FieldEditor's expected type
  const getPermission = (field: string): 'read' | 'edit' => {
    const perm = permissions.fields[field];
    return perm === 'edit' ? 'edit' : 'read';
  };

  // Field change handler
  const handleFieldChange = (fieldName: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [fieldName]: value }));
    // Clear validation error for this field
    if (validationErrors[fieldName]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleSave = () => {
    // Validate data
    const errors = validate(editData);

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // For system states, only send the fields that should be updated
    // (not computed fields like effective_status, limiting_parent, etc.)
    if (dataType === 'systemStates') {
      const systemData = editData as Partial<SystemState>;
      const cleanedData: Partial<SystemState> = {};

      // Only include writable fields that have changed or were explicitly set
      if (systemData.status !== undefined) cleanedData.status = systemData.status;
      if (systemData.value !== undefined) cleanedData.value = systemData.value;
      if (systemData.name !== undefined) cleanedData.name = systemData.name;
      if (systemData.max_value !== undefined) cleanedData.max_value = systemData.max_value;
      if (systemData.unit !== undefined) cleanedData.unit = systemData.unit;
      if (systemData.category !== undefined) cleanedData.category = systemData.category;
      if (systemData.depends_on !== undefined) cleanedData.depends_on = systemData.depends_on;

      onSave(cleanedData);
    } else {
      onSave(editData);
    }
  };

  const handleCancel = () => {
    setEditData({});
    setValidationErrors({});
    onCancel();
  };

  // Backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const modalTitle = title || `Edit ${dataType.slice(0, -1)}`;

  const modalContent = (
    <div className="player-edit-modal-backdrop" onClick={handleBackdropClick}>
      <div className="player-edit-modal">
        {/* Header */}
        <div className="player-edit-modal-header">
          <div className="modal-header-bar" />
          <h2 className="modal-title">{modalTitle}</h2>
          <button
            className="modal-close-btn"
            onClick={handleCancel}
            disabled={isLoading}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="modal-error">
            <span className="error-icon">⚠</span>
            {error}
          </div>
        )}

        {/* Content */}
        <div className="player-edit-modal-content">
          <div className="modal-fields">
              {/* Render fields based on dataType */}
              {dataType === 'assets' && (() => {
                const assetData = editData as Partial<Asset>;
                return (
                  <>
                    <FieldEditor
                      label="Status"
                      fieldName="status"
                      value={assetData.status}
                      fieldType="enum"
                      permission={getPermission('status')}
                      onChange={(value) => handleFieldChange('status', value)}
                      options={STATUS_OPTIONS}
                      error={validationErrors.status}
                    />
                    <FieldEditor
                      label="Ammo Current"
                      fieldName="ammo_current"
                      value={assetData.ammo_current}
                      fieldType="number"
                      permission={getPermission('ammo_current')}
                      onChange={(value) => handleFieldChange('ammo_current', value)}
                      min={0}
                      max={assetData.ammo_max}
                      error={validationErrors.ammo_current}
                    />
                    <FieldEditor
                      label="Armed"
                      fieldName="is_armed"
                      value={assetData.is_armed}
                      fieldType="boolean"
                      permission={getPermission('is_armed')}
                      onChange={(value) => handleFieldChange('is_armed', value)}
                      error={validationErrors.is_armed}
                    />
                    <FieldEditor
                      label="Ready"
                      fieldName="is_ready"
                      value={assetData.is_ready}
                      fieldType="boolean"
                      permission={getPermission('is_ready')}
                      onChange={(value) => handleFieldChange('is_ready', value)}
                      error={validationErrors.is_ready}
                    />
                  </>
                );
              })()}

              {dataType === 'contacts' && (() => {
                const contactData = editData as Partial<Contact>;
                return (
                  <>
                    <FieldEditor
                      label="Name"
                      fieldName="name"
                      value={contactData.name}
                      fieldType="text"
                      permission={getPermission('name')}
                      onChange={(value) => handleFieldChange('name', value)}
                      required
                      error={validationErrors.name}
                    />
                    <FieldEditor
                      label="Affiliation"
                      fieldName="affiliation"
                      value={contactData.affiliation}
                      fieldType="text"
                      permission={getPermission('affiliation')}
                      onChange={(value) => handleFieldChange('affiliation', value)}
                      error={validationErrors.affiliation}
                    />
                    <FieldEditor
                      label="Threat Level"
                      fieldName="threat_level"
                      value={contactData.threat_level}
                      fieldType="enum"
                      permission={getPermission('threat_level')}
                      onChange={(value) => handleFieldChange('threat_level', value)}
                      options={THREAT_LEVEL_OPTIONS}
                      error={validationErrors.threat_level}
                    />
                    <FieldEditor
                      label="Role"
                      fieldName="role"
                      value={contactData.role}
                      fieldType="text"
                      permission={getPermission('role')}
                      onChange={(value) => handleFieldChange('role', value)}
                      error={validationErrors.role}
                    />
                    <FieldEditor
                      label="Notes"
                      fieldName="notes"
                      value={contactData.notes}
                      fieldType="textarea"
                      permission={getPermission('notes')}
                      onChange={(value) => handleFieldChange('notes', value)}
                      placeholder="Enter notes..."
                      error={validationErrors.notes}
                    />
                    <FieldEditor
                      label="Tags"
                      fieldName="tags"
                      value={contactData.tags}
                      fieldType="tags"
                      permission={getPermission('tags')}
                      onChange={(value) => handleFieldChange('tags', value)}
                      error={validationErrors.tags}
                    />
                  </>
                );
              })()}

              {dataType === 'cargo' && (() => {
                const cargoData = editData as Partial<Cargo>;
                return (
                  <>
                    <FieldEditor
                      label="Name"
                      fieldName="name"
                      value={cargoData.name}
                      fieldType="text"
                      permission={getPermission('name')}
                      onChange={(value) => handleFieldChange('name', value)}
                      required
                      error={validationErrors.name}
                    />
                    <FieldEditor
                      label="Notes"
                      fieldName="notes"
                      value={cargoData.notes}
                      fieldType="textarea"
                      permission={getPermission('notes')}
                      onChange={(value) => handleFieldChange('notes', value)}
                      placeholder="Quantity, value, or other details..."
                      error={validationErrors.notes}
                    />
                  </>
                );
              })()}

              {dataType === 'systemStates' && (() => {
                const systemData = editData as Partial<SystemState>;
                // Determine which fields to show (default: all)
                const showStatus = !visibleFields || visibleFields.includes('status');
                const showValue = !visibleFields || visibleFields.includes('value');
                const isOffline = systemData.status === 'offline';

                // When status changes, remove value so backend calculates it
                const handleStatusChange = (newStatus: unknown) => {
                  setEditData((prev) => {
                    const next = { ...prev, status: newStatus as SystemState['status'] } as Partial<SystemState>;
                    // Remove value so backend will calculate the appropriate value for the new status
                    delete next.value;
                    return next;
                  });
                };

                // When value changes, remove status so backend calculates it
                const handleValueChange = (newValue: unknown) => {
                  setEditData((prev) => {
                    const next = { ...prev, value: newValue as number } as Partial<SystemState>;
                    // Remove status so backend will calculate the appropriate status for the new value
                    delete next.status;
                    return next;
                  });
                };

                // Toggle offline status (for health bar widget)
                const handleOfflineToggle = (value: unknown) => {
                  const checked = Boolean(value);
                  if (checked) {
                    // Set to offline
                    setEditData((prev) => ({
                      ...prev,
                      status: 'offline' as SystemState['status'],
                    }));
                  } else {
                    // Remove status so backend calculates from value
                    setEditData((prev) => {
                      const next = { ...prev } as Partial<SystemState>;
                      delete next.status;
                      return next;
                    });
                  }
                };

                return (
                  <>
                    {showStatus && (
                      <FieldEditor
                        label="Status"
                        fieldName="status"
                        value={systemData.status}
                        fieldType="enum"
                        permission={getPermission('status')}
                        onChange={handleStatusChange}
                        options={STATUS_OPTIONS}
                        error={validationErrors.status}
                      />
                    )}
                    {showValue && (
                      <>
                        <FieldEditor
                          label="Current Value"
                          fieldName="value"
                          value={systemData.value}
                          fieldType="number"
                          permission={getPermission('value')}
                          onChange={handleValueChange}
                          min={0}
                          max={systemData.max_value}
                          error={validationErrors.value}
                          disabled={isOffline}
                        />
                        <FieldEditor
                          label="System Offline"
                          fieldName="offline"
                          value={isOffline}
                          fieldType="boolean"
                          permission={getPermission('status')}
                          onChange={handleOfflineToggle}
                        />
                      </>
                    )}
                  </>
                );
              })()}
          </div>

          {/* Validation Errors */}
          {Object.keys(validationErrors).length > 0 && (
            <div className="modal-validation-errors">
              {Object.entries(validationErrors).map(([field, message]) => (
                <div key={field} className="validation-error">
                  <span className="error-icon">⚠</span>
                  <span className="error-field">{field}:</span> {message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="player-edit-modal-footer">
          <button
            className="modal-btn modal-btn-cancel"
            onClick={handleCancel}
            disabled={isLoading}
            type="button"
          >
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-save"
            onClick={handleSave}
            disabled={isLoading}
            type="button"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="modal-loading-overlay">
            <div className="modal-spinner" />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
