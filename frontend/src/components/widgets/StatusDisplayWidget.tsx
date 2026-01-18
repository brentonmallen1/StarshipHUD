import { useState } from 'react';
import { useUpdateSystemState } from '../../hooks/useMutations';
import { useDataPermissions } from '../../hooks/usePermissions';
import { EditButton } from '../controls/EditButton';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import type { WidgetRendererProps, SystemState } from '../../types';

/**
 * Get the icon shape class for a given status
 */
function getStatusIconShape(status: string): string {
  switch (status) {
    case 'operational':
    case 'optimal':
      return 'circle';
    case 'degraded':
      return 'triangle';
    case 'compromised':
    case 'critical':
      return 'diamond';
    case 'destroyed':
      return 'x';
    case 'offline':
    default:
      return 'hollow';
  }
}

/**
 * Get abbreviated status label for compact display
 */
function getAbbreviatedStatus(status: string): string {
  switch (status) {
    case 'optimal':
      return 'OPT';
    case 'operational':
      return 'OPR';
    case 'degraded':
      return 'DGR';
    case 'compromised':
      return 'CMP';
    case 'critical':
      return 'CRT';
    case 'destroyed':
      return 'DST';
    case 'offline':
    default:
      return 'OFF';
  }
}

/**
 * LimitingParentLabel - Shows the name of the parent system limiting this one
 */
function LimitingParentLabel({ limitingParent }: { limitingParent: { id: string; name: string; effective_status: string } }) {
  return (
    <span className={`limiting-parent-label status-${limitingParent.effective_status}`}>
      ← {limitingParent.name}
    </span>
  );
}

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

  // Config options
  const orientation = (instance.config?.orientation as string) ?? 'horizontal';
  const isVertical = orientation === 'vertical';
  const showLabel = (instance.config?.showLabel as boolean) ?? false;

  const title = (instance.config.title as string) ?? system?.name ?? 'Unknown';
  const status = system?.effective_status ?? system?.status ?? 'offline';
  const limitingParent = system?.limiting_parent;

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
      <div className={`status-display-widget${isVertical ? ' vertical' : ''} editing status-${status}`}>
        <span className="status-display-title">{title}</span>
        {systemId ? (
          <div className="editing-hint">Bound to: {systemId}</div>
        ) : (
          <div className="editing-hint">Static config (no binding)</div>
        )}
      </div>
    );
  }

  // Vertical variant - icon-based display with optional abbreviated label
  if (isVertical) {
    return (
      <div className={`status-display-widget vertical status-${status}`}>
        {canEdit && <EditButton onClick={handleOpenModal} title="Edit system state" />}

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
            visibleFields={['status']}
          />
        )}

        <div
          className={`status-icon status-icon--lg status-icon-${getStatusIconShape(status)} status-${status}`}
        />
        {limitingParent && <LimitingParentLabel limitingParent={limitingParent} />}
        {showLabel && (
          <span className={`status-display-abbrev status-${status}`}>
            {getAbbreviatedStatus(status)}
          </span>
        )}
        <span className="status-display-title-vertical">{title}</span>
      </div>
    );
  }

  // Horizontal variant - text-based display (default)
  return (
    <div className={`status-display-widget status-${status}`}>
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
          visibleFields={['status']}
        />
      )}

      <span className="status-display-title">{title}</span>
      <div className="status-display-content">
        <span className={`status-display-label status-${status}`}>
          {status}
        </span>
        {limitingParent && <LimitingParentLabel limitingParent={limitingParent} />}
      </div>
    </div>
  );
}
