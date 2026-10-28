import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useShipContext } from '../../contexts/ShipContext';
import { useToast } from '../../contexts/ToastContext';
import type { WidgetBindings, WidgetInstance } from '../../types';
import { systemStatesApi, widgetsApi } from '../../services/api';
import { getWidgetType } from './widgetRegistry';
import { SystemSelect } from './config/fields';
import './WidgetCreationModal.css'; // Reuse creation modal styles

interface Props {
  widget: WidgetInstance;
  onClose: () => void;
  onSave: (updates: Partial<WidgetInstance>) => Promise<void>;
  onDelete: () => Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

/**
 * Widget configuration shell: label, system binding (driven by the registry's
 * `binding`), the type's own `ConfigEditor`, duplicate/delete and save.
 * Everything type-specific lives in components/widgets/config/.
 */
export function WidgetConfigModal({ widget, onClose, onSave, onDelete }: Props) {
  const modalRef = useModalA11y(onClose);
  const widgetType = getWidgetType(widget.widget_type);
  const typeName = widgetType?.name || widget.widget_type;
  const ConfigEditor = widgetType?.ConfigEditor;
  const binding = widgetType?.binding ?? 'none';
  const { shipId } = useShipContext();
  const { addToast } = useToast();

  // Modal-scoped query key so live widget polling (same data, different key)
  // never re-renders this form and snaps focus away from dropdowns/inputs.
  const { data: systemStates } = useQuery({
    queryKey: ['modal-system-states', shipId],
    queryFn: () => systemStatesApi.list(shipId!),
    enabled: !!shipId,
    refetchInterval: false,
    staleTime: Infinity,
  });

  const [label, setLabel] = useState(widget.label || '');
  // Draft starts from the type defaults so editors and saved config agree
  const [config, setConfig] = useState<Record<string, unknown>>(() => ({
    ...structuredClone(widgetType?.defaultConfig ?? {}),
    ...widget.config,
  }));
  const [bindings, setBindings] = useState<WidgetBindings>(() => ({ ...widget.bindings }));

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateConfig = (patch: Record<string, unknown>) => setConfig((prev) => ({ ...prev, ...patch }));
  const updateBindings = (patch: Partial<WidgetBindings>) => setBindings((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        label: label.trim() || null,
        bindings: {
          ...bindings,
          system_state_id: bindings.system_state_id || undefined,
          asset_id: bindings.asset_id || undefined,
        },
        config,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save widget config:', err);
      addToast({ type: 'error', message: `Failed to save widget configuration: ${errorMessage(err)}` });
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
      addToast({ type: 'error', message: `Failed to delete widget: ${errorMessage(err)}` });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      await widgetsApi.duplicate(widget.id);
      onClose();
      // The panel will refetch widgets automatically
    } catch (err) {
      console.error('Failed to duplicate widget:', err);
      addToast({ type: 'error', message: `Failed to duplicate widget: ${errorMessage(err)}` });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content widget-creation-modal" role="dialog" aria-modal="true" aria-label={`Configure ${typeName}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Configure {typeName}</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <form onSubmit={handleFormSubmit}>
        <div className="modal-body">
          {/* Widget Info */}
          <div className="config-section">
            <div className="config-info">
              <div className="info-row">
                <span className="info-label">Type:</span>
                <span className="info-value">{typeName}</span>
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

          {/* System State Binding */}
          {binding !== 'none' && (
            <div className="configure-section">
              <label className="configure-label">
                System State Binding{binding === 'optional-system' ? ' (Optional)' : ''}
              </label>
              <SystemSelect
                value={bindings.system_state_id}
                systemStates={systemStates ?? []}
                onChange={(system_state_id) => updateBindings({ system_state_id })}
              />
              <p className="field-hint">
                Link this widget to a specific system state
              </p>
            </div>
          )}

          {/* Type-specific settings */}
          {ConfigEditor && (
            <Suspense fallback={<p className="field-hint">Loading settings…</p>}>
              <ConfigEditor
                widget={widget}
                config={config}
                onChange={updateConfig}
                bindings={bindings}
                onBindingsChange={updateBindings}
                systemStates={systemStates ?? []}
              />
            </Suspense>
          )}

          {/* Delete Section */}
          {!showDeleteConfirm && (
            <div className="configure-section danger-zone">
              <label className="configure-label">Danger Zone</label>
              <button
                type="button"
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
                  type="button"
                  className="btn"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
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
          <button
            type="button"
            className="btn"
            onClick={handleDuplicate}
            disabled={isDuplicating}
            title="Create a copy of this widget"
          >
            {isDuplicating ? 'Duplicating...' : 'Duplicate'}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
