import { useState } from 'react';
import { useUpdateSystemState } from '../../hooks/useMutations';
import { useDataPermissions } from '../../hooks/usePermissions';
import { EditButton } from '../controls/EditButton';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import type { WidgetRendererProps, SystemState } from '../../types';
import { getConfig } from '../../types';
import type { NumberDisplayConfig } from '../../types';
import { STATUS_COLORS } from './arcUtils';
import './NumberDisplayWidget.css';

export function NumberDisplayWidget({
  instance,
  systemStates,
  isEditing,
  canEditData,
}: WidgetRendererProps) {
  const config = getConfig<NumberDisplayConfig>(instance.config);
  const systemId = instance.bindings?.system_state_id as string | undefined;
  const system = systemId ? systemStates.get(systemId) : null;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mutation and permission hooks
  const updateSystemState = useUpdateSystemState();
  const systemPermissions = useDataPermissions('systemStates');

  const canEdit = canEditData && !!systemId && !!system;

  // Config options with defaults
  const showMax = config.show_max ?? true;
  const showUnit = config.show_unit ?? true;
  const showStatus = config.show_status ?? true;
  const showTitle = config.show_title ?? true;
  const size = config.size ?? 'normal';

  // System data
  const status = system?.effective_status ?? system?.status ?? 'offline';
  const value = system?.value ?? 0;
  const maxValue = system?.max_value ?? 100;
  const unit = system?.unit ?? '%';
  const title = config.title ?? system?.name ?? 'UNBOUND';
  const hasCustomThresholds = !!system?.status_thresholds;
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;

  // Display value - discrete systems show raw value, percentage systems show percentage
  const displayValue = hasCustomThresholds
    ? Math.round(value)
    : Math.round((value / maxValue) * 100);

  // Display max - for discrete systems show maxValue, for percentage show 100
  const displayMax = hasCustomThresholds ? Math.round(maxValue) : 100;

  // Unit display - hide for discrete systems (they show x/y format)
  const displayUnit = hasCustomThresholds ? '' : unit;

  // Modal handlers
  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleModalSave = (data: Partial<SystemState>) => {
    if (canEdit && systemId) {
      updateSystemState.mutate(
        { id: systemId, data },
        { onSuccess: () => setIsModalOpen(false) }
      );
    }
  };

  if (isEditing) {
    return (
      <div className={`number-display-widget number-display-widget--editing number-display-widget--${size}`}>
        <span className="number-display-widget__edit-label">NUMBER</span>
        <span className="number-display-widget__edit-hint">
          {systemId ? 'System bound' : 'No system bound'}
        </span>
      </div>
    );
  }

  return (
    <div className={`number-display-widget number-display-widget--${size} status-${status}`}>
      {canEdit && <EditButton onClick={handleOpenModal} title="Edit system value" />}

      {canEdit && (
        <PlayerEditModal
          isOpen={isModalOpen}
          dataType="systemStates"
          record={system}
          permissions={systemPermissions}
          onSave={handleModalSave}
          onCancel={handleCloseModal}
          title={`Edit ${title}`}
          isLoading={updateSystemState.isPending}
          error={updateSystemState.error?.message}
          visibleFields={['value']}
        />
      )}

      {showTitle && (
        <span className="number-display-widget__title">{title.toUpperCase()}</span>
      )}

      <div className="number-display-widget__content">
        <div className="number-display-widget__value-group">
          <span
            className="number-display-widget__value"
            style={{ color }}
          >
            {displayValue}
          </span>
          {showMax && (
            <span className="number-display-widget__max">/{displayMax}</span>
          )}
        </div>

        {showUnit && displayUnit && (
          <span className="number-display-widget__unit">{displayUnit}</span>
        )}

        {showStatus && (
          <span
            className="number-display-widget__status"
            style={{ color }}
          >
            {status.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
