import { useState } from 'react';
import { useSystemStates, useAssets, useContacts } from '../../hooks/useShipData';
import type { WidgetInstance } from '../../types';
import { getWidgetType } from './widgetRegistry';
import './WidgetCreationModal.css'; // Reuse creation modal styles

interface Props {
  widget: WidgetInstance;
  onClose: () => void;
  onSave: (updates: Partial<WidgetInstance>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function WidgetConfigModal({ widget, onClose, onSave, onDelete }: Props) {
  const widgetType = getWidgetType(widget.widget_type);
  const { data: systemStates } = useSystemStates();
  const { data: assets } = useAssets();
  const { data: contacts } = useContacts();

  const [label, setLabel] = useState(widget.label || '');
  const [systemStateId, setSystemStateId] = useState<string>(
    (widget.bindings.system_state_id as string) || ''
  );
  const [assetId, setAssetId] = useState<string>(
    (widget.bindings.asset_id as string) || ''
  );
  const [contactId, setContactId] = useState<string>(
    (widget.config.contact_id as string) || ''
  );
  const [dataSource, setDataSource] = useState<string>(
    (widget.config.dataSource as string) || 'cargo'
  );
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    (widget.config.columns as string[]) || []
  );
  const [titleText, setTitleText] = useState<string>(
    (widget.config.text as string) || ''
  );
  const [orientation, setOrientation] = useState<string>(
    (widget.config.orientation as string) || 'horizontal'
  );
  const [showLabel, setShowLabel] = useState<boolean>(
    (widget.config.showLabel as boolean) ?? false
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<WidgetInstance> = {
        label: label || undefined,
        bindings: {
          ...widget.bindings,
          system_state_id: systemStateId || undefined,
          asset_id: assetId || undefined,
        },
        config: {
          ...widget.config,
          ...(widget.widget_type === 'title' && {
            text: titleText,  // Send empty string to clear, TitleWidget shows 'Untitled' fallback
          }),
          ...((widget.widget_type === 'health_bar' || widget.widget_type === 'status_display') && {
            orientation,
          }),
          ...(widget.widget_type === 'status_display' && {
            showLabel,
          }),
          ...(widget.widget_type === 'data_table' && {
            dataSource,
            columns: selectedColumns.length > 0 ? selectedColumns : undefined,
          }),
          ...(widget.widget_type === 'contact_display' && {
            contact_id: contactId || undefined,
          }),
        },
      };

      await onSave(updates);
      onClose();
    } catch (err) {
      console.error('Failed to save widget config:', err);
      alert('Failed to save widget configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      console.error('Failed to delete widget:', err);
      alert('Failed to delete widget');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content widget-creation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            Configure {widgetType?.name || widget.widget_type}
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Widget Info */}
          <div className="config-section">
            <div className="config-info">
              <div className="info-row">
                <span className="info-label">Type:</span>
                <span className="info-value">{widgetType?.name || widget.widget_type}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Position:</span>
                <span className="info-value">
                  ({widget.x}, {widget.y})
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Size:</span>
                <span className="info-value">
                  {widget.width}×{widget.height}
                </span>
              </div>
            </div>
          </div>

          {/* Label */}
          <div className="configure-section">
            <label className="configure-label">Widget Label (Optional)</label>
            <input
              type="text"
              className="config-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a custom label"
            />
            <p className="field-hint">
              Custom label for this widget instance
            </p>
          </div>

          {/* Title Widget Text */}
          {widget.widget_type === 'title' && (
            <div className="configure-section">
              <label className="configure-label">Title Text</label>
              <input
                type="text"
                className="config-input"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                placeholder="Enter title text"
              />
              <p className="field-hint">
                The text displayed in this title widget
              </p>
            </div>
          )}

          {/* System State Binding */}
          {(widget.widget_type === 'health_bar' ||
            widget.widget_type === 'status_display') && (
            <div className="configure-section">
              <label className="configure-label">System State Binding</label>
              <select
                className="config-input"
                value={systemStateId}
                onChange={(e) => setSystemStateId(e.target.value)}
              >
                <option value="">-- None --</option>
                {systemStates?.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name} ({state.category})
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Link this widget to a specific system state
              </p>
            </div>
          )}

          {/* Orientation for Status/Health Widgets */}
          {(widget.widget_type === 'health_bar' ||
            widget.widget_type === 'status_display') && (
            <div className="configure-section">
              <label className="configure-label">Orientation</label>
              <select
                className="config-input"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
              <p className="field-hint">
                Vertical orientation uses icon indicators instead of text labels
              </p>
            </div>
          )}

          {/* Show Abbreviated Label (Vertical Status Display only) */}
          {widget.widget_type === 'status_display' && orientation === 'vertical' && (
            <div className="configure-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showLabel}
                  onChange={(e) => setShowLabel(e.target.checked)}
                />
                <span>Show abbreviated status label</span>
              </label>
              <p className="field-hint">
                Display a short status code (OPR, DGR, CRT, etc.) below the icon
              </p>
            </div>
          )}

          {/* Asset Binding */}
          {widget.widget_type === 'asset_display' && (
            <div className="configure-section">
              <label className="configure-label">Asset/Weapon Binding</label>
              <select
                className="config-input"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="">-- None (Static Config) --</option>
                {assets?.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.asset_type})
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Link this widget to a specific weapon/asset from the database.
                Updates to the asset will be reflected in real-time.
              </p>
            </div>
          )}

          {/* Contact Display Configuration */}
          {widget.widget_type === 'contact_display' && (
            <div className="configure-section">
              <label className="configure-label">Default Contact (Optional)</label>
              <select
                className="config-input"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                <option value="">-- No Default (Player Selects) --</option>
                {contacts?.slice().sort((a, b) => a.name.localeCompare(b.name)).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} - {contact.threat_level}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Optionally pre-select a contact. Players can change the selection using the dropdown in the widget.
              </p>
            </div>
          )}

          {/* Data Table Configuration */}
          {widget.widget_type === 'data_table' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Data Source</label>
                <select
                  className="config-input"
                  value={dataSource}
                  onChange={(e) => {
                    setDataSource(e.target.value);
                    setSelectedColumns([]); // Reset columns when changing source
                  }}
                >
                  <option value="cargo">Cargo Inventory</option>
                  <option value="assets">Weapons & Assets</option>
                  <option value="contacts">Contacts & Dossiers</option>
                </select>
                <p className="field-hint">
                  Select which data to display in the table
                </p>
              </div>

              <div className="configure-section">
                <label className="configure-label">Columns to Display</label>
                <div className="column-checkboxes">
                  {(dataSource === 'cargo'
                    ? ['name', 'category', 'quantity', 'unit', 'value', 'location', 'description']
                    : dataSource === 'assets'
                    ? ['name', 'asset_type', 'status', 'ammo_current', 'ammo_max', 'range', 'damage']
                    : ['name', 'affiliation', 'threat_level', 'role', 'last_contacted_at']
                  ).map((col) => (
                    <label key={col} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedColumns([...selectedColumns, col]);
                          } else {
                            setSelectedColumns(selectedColumns.filter((c) => c !== col));
                          }
                        }}
                      />
                      <span>{col.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
                <p className="field-hint">
                  Leave empty to show default columns
                </p>
              </div>
            </>
          )}

          {/* Delete Section */}
          {!showDeleteConfirm && (
            <div className="configure-section danger-zone">
              <label className="configure-label">Danger Zone</label>
              <button
                className="btn btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Widget
              </button>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="configure-section danger-zone">
              <label className="configure-label">Confirm Deletion</label>
              <p className="delete-warning">
                Are you sure you want to delete this widget? This action cannot be undone.
              </p>
              <div className="delete-actions">
                <button
                  className="btn"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
