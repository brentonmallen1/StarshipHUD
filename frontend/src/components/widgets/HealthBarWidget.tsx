import { useState } from 'react';
import { useUpdateSystemState } from '../../hooks/useMutations';
import { useDataPermissions } from '../../hooks/usePermissions';
import { EditButton } from '../controls/EditButton';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import type { WidgetRendererProps, SystemState } from '../../types';

export function HealthBarWidget({ instance, systemStates, isEditing, canEditData }: WidgetRendererProps) {
  const systemId = instance.bindings.system_state_id;
  const system = systemId ? systemStates.get(systemId) : null;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mutation and permission hooks
  const updateSystemState = useUpdateSystemState();
  const systemPermissions = useDataPermissions('systemStates');

  // Check if we can edit this system (must be bound to a real system, not static config)
  const canEdit = canEditData && !!systemId && !!system;

  const title = (instance.config.title as string) ?? system?.name ?? 'Unknown';
  const value = system?.value ?? 0;
  const maxValue = system?.max_value ?? 100;
  const unit = system?.unit ?? '%';
  const status = system?.status ?? 'offline';

  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

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
      <div className={`health-bar-widget editing status-${status}`}>
        <span className="health-bar-title">{title}</span>
        {systemId ? (
          <div className="editing-hint">Bound to: {systemId}</div>
        ) : (
          <div className="editing-hint">Static config (no binding)</div>
        )}
      </div>
    );
  }

  return (
    <div className={`health-bar-widget status-${status}`}>
      <span className="health-bar-title">{title}</span>
      {/* Edit button appears when data editing is enabled */}
      {canEdit && <EditButton onClick={handleOpenModal} title="Edit system health" />}

      {/* Player Edit Modal */}
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
        />
      )}

      <div className="health-bar-header">
        <span className={`health-bar-value status-${status}`}>
          {value}{unit}
        </span>
      </div>

      <div className="health-bar-container">
        <div
          className={`health-bar-fill ${status}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="health-bar-status">
        {/* Status: static display (edit via modal) */}
        <div className={`health-bar-status-display status-${status}`}>
          <span className={`status-dot status-${status}`} style={{ backgroundColor: 'currentColor' }} />
          <span>{status.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
