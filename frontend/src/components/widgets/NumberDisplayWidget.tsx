import { useUpdateSystemState } from '../../hooks/useMutations';
import type { WidgetRendererProps } from '../../types';
import { getConfig } from '../../types';
import type { NumberDisplayConfig } from '../../types';
import { useBoundSystem } from '../../hooks/useBoundSystem';
import { resolveStatusColor } from '../../utils/status';
import { NUMBER_DISPLAY_DEFAULTS } from '../../types';
import './NumberDisplayWidget.css';

export function NumberDisplayWidget({
  instance,
  systemStates,
  isEditing,
  canEditData,
}: WidgetRendererProps) {
  const config = getConfig<NumberDisplayConfig>(instance.config);
  const { systemId, system, status } = useBoundSystem(instance, systemStates);

  // Mutation hook
  const updateSystemState = useUpdateSystemState();

  const canEdit = canEditData && !!systemId && !!system;

  // Config options with defaults
  const showMax = config.show_max ?? NUMBER_DISPLAY_DEFAULTS.show_max;
  const showUnit = config.show_unit ?? NUMBER_DISPLAY_DEFAULTS.show_unit;
  const showStatus = config.show_status ?? NUMBER_DISPLAY_DEFAULTS.show_status;
  const showTitle = config.show_title ?? NUMBER_DISPLAY_DEFAULTS.show_title;
  const size = config.size ?? NUMBER_DISPLAY_DEFAULTS.size;

  // System data
  const value = system?.value ?? 0;
  const maxValue = system?.max_value ?? 100;
  const unit = system?.unit ?? '%';
  const title = config.title ?? system?.name ?? 'UNBOUND';
  const hasCustomThresholds = !!system?.status_thresholds;
  const color = resolveStatusColor(status);

  // Display value - discrete systems show raw value, percentage systems show percentage
  const displayValue = hasCustomThresholds
    ? Math.round(value)
    : Math.round((value / maxValue) * 100);

  // Display max - for discrete systems show maxValue, for percentage show 100
  const displayMax = hasCustomThresholds ? Math.round(maxValue) : 100;

  // Unit display - hide for discrete systems (they show x/y format)
  const displayUnit = hasCustomThresholds ? '' : unit;

  // Inline edit handlers
  const step = hasCustomThresholds ? 1 : 5;

  const handleIncrement = () => {
    if (canEdit && systemId) {
      const newValue = Math.min(value + step, maxValue);
      updateSystemState.mutate({ id: systemId, data: { value: newValue } });
    }
  };

  const handleDecrement = () => {
    if (canEdit && systemId) {
      const newValue = Math.max(value - step, 0);
      updateSystemState.mutate({ id: systemId, data: { value: newValue } });
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
      {/* Subtle +/- controls in top-right corner */}
      {canEdit && (
        <div className="inline-edit-controls">
          <button
            className="hud-action inline-edit-btn"
            onClick={handleDecrement}
            disabled={value <= 0}
            title="Decrease"
            type="button"
          >
            −
          </button>
          <button
            className="hud-action inline-edit-btn"
            onClick={handleIncrement}
            disabled={value >= maxValue}
            title="Increase"
            type="button"
          >
            +
          </button>
        </div>
      )}

      {showTitle && (
        <span className="hud-title number-display-widget__title">{title.toUpperCase()}</span>
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
