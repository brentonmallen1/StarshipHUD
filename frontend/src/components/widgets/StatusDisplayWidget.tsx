import { useState, useRef, useEffect } from 'react';
import { useUpdateSystemState } from '../../hooks/useMutations';
import type { WidgetRendererProps, SystemStatus } from '../../types';
import { getConfig } from '../../types';
import type { StatusDisplayConfig } from '../../types';

const STATUS_OPTIONS: SystemStatus[] = [
  'optimal',
  'operational',
  'degraded',
  'compromised',
  'critical',
  'destroyed',
  'offline',
];

const STATUS_LABELS: Record<SystemStatus, string> = {
  optimal: 'Optimal',
  operational: 'Operational',
  degraded: 'Degraded',
  compromised: 'Compromised',
  critical: 'Critical',
  destroyed: 'Destroyed',
  offline: 'Offline',
};

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
  const config = getConfig<StatusDisplayConfig>(instance.config);
  const systemId = instance.bindings.system_state_id;
  const system = systemId ? systemStates.get(systemId) : null;

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  // Mutation hook
  const updateSystemState = useUpdateSystemState();

  // Check if we can edit this system
  const canEdit = canEditData && !!systemId && !!system;

  // Config options
  const orientation = config.orientation ?? 'horizontal';
  const isVertical = orientation === 'vertical';
  const showLabel = config.showLabel ?? false;

  const title = config.title ?? system?.name ?? 'Unknown';
  const status = system?.effective_status ?? system?.status ?? 'offline';
  const limitingParent = system?.limiting_parent;

  // Calculate menu position when opening
  useEffect(() => {
    if (isDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleStatusChange = (newStatus: SystemStatus) => {
    if (canEdit && systemId) {
      updateSystemState.mutate({ id: systemId, data: { status: newStatus } });
    }
    setIsDropdownOpen(false);
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
      <div className={`status-display-widget vertical status-${status}`} ref={dropdownRef}>
        <div
          className={`status-icon status-icon--lg status-icon-${getStatusIconShape(status)} status-${status}${canEdit ? ' clickable' : ''}`}
          onClick={canEdit ? () => setIsDropdownOpen(!isDropdownOpen) : undefined}
          role={canEdit ? 'button' : undefined}
          tabIndex={canEdit ? 0 : undefined}
          ref={triggerRef as React.RefObject<HTMLDivElement>}
        />
        {limitingParent && <LimitingParentLabel limitingParent={limitingParent} />}
        {showLabel && (
          <span className={`status-display-abbrev status-${status}`}>
            {getAbbreviatedStatus(status)}
          </span>
        )}
        <span className="status-display-title-vertical">{title}</span>

        {/* Status dropdown menu */}
        {isDropdownOpen && (
          <div
            className="status-dropdown-menu"
            style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
          >
            {STATUS_OPTIONS.map((statusKey) => (
              <button
                key={statusKey}
                className={`status-dropdown-option status-${statusKey} ${statusKey === status ? 'active' : ''}`}
                onClick={() => handleStatusChange(statusKey)}
                type="button"
              >
                <span className="status-indicator" />
                {STATUS_LABELS[statusKey]}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Horizontal variant - text-based display (default)
  return (
    <div className={`status-display-widget status-${status}`} ref={dropdownRef}>
      <span className="status-display-title">{title}</span>
      <div className="status-display-content">
        {canEdit ? (
          <button
            ref={triggerRef as React.RefObject<HTMLButtonElement>}
            className={`status-display-label status-${status} clickable`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            type="button"
          >
            {status}
            <span className="status-caret">{isDropdownOpen ? '▲' : '▼'}</span>
          </button>
        ) : (
          <span className={`status-display-label status-${status}`}>
            {status}
          </span>
        )}
        {limitingParent && <LimitingParentLabel limitingParent={limitingParent} />}
      </div>

      {/* Status dropdown menu */}
      {isDropdownOpen && (
        <div
          className="status-dropdown-menu"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
        >
          {STATUS_OPTIONS.map((statusKey) => (
            <button
              key={statusKey}
              className={`status-dropdown-option status-${statusKey} ${statusKey === status ? 'active' : ''}`}
              onClick={() => handleStatusChange(statusKey)}
              type="button"
            >
              <span className="status-indicator" />
              {STATUS_LABELS[statusKey]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
