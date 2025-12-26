import { useState } from 'react';
import { useUpdateSystemState } from '../../hooks/useMutations';
import { useDataPermissions } from '../../hooks/usePermissions';
import { EditButton } from '../controls/EditButton';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import type { WidgetRendererProps, SystemState } from '../../types';

export function StatusDisplayWidget({ instance, systemStates, isEditing, canEditData }: WidgetRendererProps) {
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
  const unit = system?.unit ?? '%';
  const status = system?.status ?? 'offline';

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
      <div className="status-display-widget editing">
        <span className="status-display-title">{title}</span>
        {systemId ? (
          <div className="editing-hint">Bound to: {systemId}</div>
        ) : (
          <div className="editing-hint">Static config (no binding)</div>
        )}
      </div>
    );
  }

  return (
    <div className="status-display-widget">
      {/* Edit button appears when data editing is enabled */}
      {canEdit && <EditButton onClick={handleOpenModal} title="Edit system state" />}

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

      <span className="status-display-title">{title}</span>
      <div className="status-display-content">
        {/* Value: static display (edit via modal) */}
        <span className={`status-display-value status-${status}`}>
          {value}{unit}
        </span>

        {/* Status: static display (edit via modal) */}
        <span className={`status-display-label status-${status}`}>
          {status}
        </span>
      </div>
    </div>
  );
}
