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

    onSave(editData);
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
                      label="Category"
                      fieldName="category"
                      value={cargoData.category}
                      fieldType="text"
                      permission={getPermission('category')}
                      onChange={(value) => handleFieldChange('category', value)}
                      error={validationErrors.category}
                    />
                    <FieldEditor
                      label="Quantity"
                      fieldName="quantity"
                      value={cargoData.quantity}
                      fieldType="number"
                      permission={getPermission('quantity')}
                      onChange={(value) => handleFieldChange('quantity', value)}
                      min={0}
                      error={validationErrors.quantity}
                    />
                    <FieldEditor
                      label="Unit"
                      fieldName="unit"
                      value={cargoData.unit}
                      fieldType="text"
                      permission={getPermission('unit')}
                      onChange={(value) => handleFieldChange('unit', value)}
                      placeholder="e.g., kg, units, crates"
                      error={validationErrors.unit}
                    />
                    <FieldEditor
                      label="Description"
                      fieldName="description"
                      value={cargoData.description}
                      fieldType="textarea"
                      permission={getPermission('description')}
                      onChange={(value) => handleFieldChange('description', value)}
                      placeholder="Enter description..."
                      error={validationErrors.description}
                    />
                    <FieldEditor
                      label="Value"
                      fieldName="value"
                      value={cargoData.value}
                      fieldType="number"
                      permission={getPermission('value')}
                      onChange={(value) => handleFieldChange('value', value)}
                      min={0}
                      error={validationErrors.value}
                    />
                    <FieldEditor
                      label="Location"
                      fieldName="location"
                      value={cargoData.location}
                      fieldType="text"
                      permission={getPermission('location')}
                      onChange={(value) => handleFieldChange('location', value)}
                      placeholder="e.g., Cargo Bay 1"
                      error={validationErrors.location}
                    />
                  </>
                );
              })()}

              {dataType === 'systemStates' && (() => {
                const systemData = editData as Partial<SystemState>;
                return (
                  <>
                    <FieldEditor
                      label="Status"
                      fieldName="status"
                      value={systemData.status}
                      fieldType="enum"
                      permission={getPermission('status')}
                      onChange={(value) => handleFieldChange('status', value)}
                      options={STATUS_OPTIONS}
                      error={validationErrors.status}
                    />
                    <FieldEditor
                      label="Current Value"
                      fieldName="value"
                      value={systemData.value}
                      fieldType="number"
                      permission={getPermission('value')}
                      onChange={(value) => handleFieldChange('value', value)}
                      min={0}
                      max={systemData.max_value}
                      error={validationErrors.value}
                    />
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
