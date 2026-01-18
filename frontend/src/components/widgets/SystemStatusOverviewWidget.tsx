import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSystemStates } from '../../hooks/useShipData';
import { useShipContext } from '../../contexts/ShipContext';
import { useBulkResetSystems } from '../../hooks/useMutations';
import { SystemsByStatusModal } from '../admin/SystemsByStatusModal';
import { AllClearModal } from '../admin/AllClearModal';
import type { WidgetRendererProps, SystemStatus, BulkResetRequest } from '../../types';
import './SystemStatusOverviewWidget.css';

// All system status types in display order
const ALL_STATUSES: { key: SystemStatus; label: string; shortLabel: string }[] = [
  { key: 'fully_operational', label: 'Fully Operational', shortLabel: 'Optimal' },
  { key: 'operational', label: 'Operational', shortLabel: 'Oper' },
  { key: 'degraded', label: 'Degraded', shortLabel: 'Degr' },
  { key: 'compromised', label: 'Compromised', shortLabel: 'Comp' },
  { key: 'critical', label: 'Critical', shortLabel: 'Crit' },
  { key: 'destroyed', label: 'Destroyed', shortLabel: 'Destr' },
  { key: 'offline', label: 'Offline', shortLabel: 'Off' },
];

export function SystemStatusOverviewWidget({ isEditing, canEditData }: WidgetRendererProps) {
  const { shipId } = useShipContext();
  const { data: systems, isLoading, error } = useSystemStates();
  const bulkResetMutation = useBulkResetSystems();
  const [statusModalStatus, setStatusModalStatus] = useState<SystemStatus | null>(null);
  const [isAllClearOpen, setIsAllClearOpen] = useState(false);

  // Compute status counts
  const statusCounts = useMemo(() => {
    return (
      systems?.reduce(
        (acc, s) => {
          acc[s.status] = (acc[s.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ) ?? {}
    );
  }, [systems]);

  const totalSystems = systems?.length ?? 0;

  if (isEditing) {
    return (
      <div className="system-status-overview-widget editing">
        <div className="system-status-header">
          <h3 className="system-status-title">System Status</h3>
        </div>
        <div className="system-status-preview">
          <div className="status-grid-preview">
            {ALL_STATUSES.slice(0, 4).map(({ key, shortLabel }) => (
              <div key={key} className={`status-tile-preview status-${key}`}>
                <span className="count">--</span>
                <span className="label">{shortLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="system-status-overview-widget loading">
        <div className="system-status-header">
          <h3 className="system-status-title">System Status</h3>
        </div>
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-status-overview-widget error">
        <div className="system-status-header">
          <h3 className="system-status-title">System Status</h3>
        </div>
        <div className="error-state">Unable to load system data</div>
      </div>
    );
  }

  const handleReset = (data: BulkResetRequest) => {
    bulkResetMutation.mutate(data, {
      onSuccess: () => setIsAllClearOpen(false),
    });
  };

  return (
    <div className="system-status-overview-widget">
      <div className="system-status-header">
        <h3 className="system-status-title">System Status</h3>
        {canEditData && (
          <button
            className="all-clear-btn"
            onClick={() => setIsAllClearOpen(true)}
            title="Reset systems to operational"
          >
            All Clear
          </button>
        )}
      </div>

      <div className="system-status-content">
        <div className="status-grid">
          {ALL_STATUSES.map(({ key, label, shortLabel }) => {
            const count = statusCounts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                className={`status-tile status-${key}${count > 0 ? ' has-count' : ''}`}
                onClick={() => setStatusModalStatus(key)}
                title={`Click to view ${label} systems`}
              >
                <span className="status-count">{count}</span>
                <span className="status-label">{shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="status-summary-bar">
          <span className="summary-total">{totalSystems} systems total</span>
        </div>
      </div>

      {/* Systems By Status Modal - rendered via portal to escape widget overflow */}
      {createPortal(
        <SystemsByStatusModal
          isOpen={statusModalStatus !== null}
          status={statusModalStatus}
          systems={systems ?? []}
          onClose={() => setStatusModalStatus(null)}
        />,
        document.body
      )}

      {/* All Clear Modal - rendered via portal to escape widget overflow */}
      {createPortal(
        <AllClearModal
          shipId={shipId ?? ''}
          systems={systems ?? []}
          isOpen={isAllClearOpen}
          onClose={() => setIsAllClearOpen(false)}
          onReset={handleReset}
          isResetting={bulkResetMutation.isPending}
        />,
        document.body
      )}
    </div>
  );
}
