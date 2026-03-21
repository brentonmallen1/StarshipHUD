import { useState } from 'react';
import { useUpdateSystemState } from '../../hooks/useMutations';
import { useDataPermissions } from '../../hooks/usePermissions';
import { EditButton } from '../controls/EditButton';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import type { WidgetRendererProps, SystemState } from '../../types';
import { getConfig } from '../../types';
import type { HealthBarConfig } from '../../types';

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
 * Format value display based on whether system uses discrete thresholds
 * Discrete systems show "4/6", percentage-based show "67%"
 */
function formatValueDisplay(value: number, maxValue: number, unit: string, hasCustomThresholds: boolean): string {
  if (hasCustomThresholds) {
    // Discrete mode: show value/max
    return `${Math.round(value)}/${Math.round(maxValue)}`;
  }
  // Percentage mode: show value + unit
  return `${value}${unit}`;
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

/**
 * SegmentedBar - Renders discrete segments for the health bar
 */
function SegmentedBar({
  percentage,
  segmentCount,
  status,
  isVertical,
}: {
  percentage: number;
  segmentCount: number;
  status: string;
  isVertical: boolean;
}) {
  const filledSegments = Math.round((percentage / 100) * segmentCount);
  const segments = [];

  for (let i = 0; i < segmentCount; i++) {
    const isFilled = isVertical ? i < filledSegments : i < filledSegments;
    segments.push(
      <div
        key={i}
        className={`health-bar-segment${isFilled ? ` filled ${status}` : ' empty'}`}
      />
    );
  }

  // For vertical, reverse order so filled segments appear at bottom
  if (isVertical) {
    segments.reverse();
  }

  return (
    <div className={`health-bar-segments${isVertical ? ' vertical' : ''}`}>
      {segments}
    </div>
  );
}

export function HealthBarWidget({ instance, systemStates, isEditing, canEditData }: WidgetRendererProps) {
  const config = getConfig<HealthBarConfig>(instance.config);
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
  const orientation = config.orientation ?? 'horizontal';
  const isVertical = orientation === 'vertical';
  const segmented = config.segmented ?? false;
  const segmentCount = Math.min(20, Math.max(4, config.segment_count ?? 10));

  const title = config.title ?? system?.name ?? 'Unknown';
  const value = system?.value ?? 0;
  const maxValue = system?.max_value ?? 100;
  const unit = system?.unit ?? '%';
  const status = system?.effective_status ?? system?.status ?? 'offline';
  const limitingParent = system?.limiting_parent;
  const hasCustomThresholds = !!system?.status_thresholds;

  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const valueDisplay = formatValueDisplay(value, maxValue, unit, hasCustomThresholds);

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
      <div className={`health-bar-widget${isVertical ? ' vertical' : ''} editing status-${status}`}>
        <span className="health-bar-title">{title}</span>
        {systemId ? (
          <div className="editing-hint">Bound to: {systemId}</div>
        ) : (
          <div className="editing-hint">Static config (no binding)</div>
        )}
      </div>
    );
  }

  // Vertical variant - compact bar with icon indicator and title
  if (isVertical) {
    return (
      <div className={`health-bar-widget vertical status-${status}`}>
        {canEdit && <EditButton onClick={handleOpenModal} title="Edit system health" />}

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

        <span className={`health-bar-value-vertical status-${status}`}>
          {valueDisplay}
        </span>

        {segmented ? (
          <SegmentedBar
            percentage={percentage}
            segmentCount={segmentCount}
            status={status}
            isVertical={true}
          />
        ) : (
          <div className="health-bar-container-vertical">
            <div
              className={`health-bar-fill-vertical ${status}`}
              style={{ height: `${percentage}%` }}
            />
          </div>
        )}

        <div
          className={`status-icon status-icon--md status-icon-${getStatusIconShape(status)} status-${status}`}
        />
        {limitingParent && <LimitingParentLabel limitingParent={limitingParent} />}

        <span className="health-bar-title-vertical">{title}</span>
      </div>
    );
  }

  // Horizontal variant - full display (default)
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
          visibleFields={['value']}
        />
      )}

      <div className="health-bar-header">
        <span className={`health-bar-value status-${status}`}>
          {valueDisplay}
        </span>
      </div>

      {segmented ? (
        <SegmentedBar
          percentage={percentage}
          segmentCount={segmentCount}
          status={status}
          isVertical={false}
        />
      ) : (
        <div className="health-bar-container">
          <div
            className={`health-bar-fill ${status}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      <div className="health-bar-status">
        {/* Status: static display (edit via modal) */}
        <div className={`health-bar-status-display status-${status}`}>
          <span className={`status-dot status-${status}`} style={{ backgroundColor: 'currentColor' }} />
          <span>{status.toUpperCase()}</span>
        </div>
        {limitingParent && <LimitingParentLabel limitingParent={limitingParent} />}
      </div>
    </div>
  );
}
