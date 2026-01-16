import { useState } from 'react';
import { useShip, useSystemStates, usePosture, useScenarios } from '../../hooks/useShipData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scenariosApi, shipsApi } from '../../services/api';
import { useUpdateShip, useBulkResetSystems } from '../../hooks/useMutations';
import { ShipEditModal } from '../../components/admin/ShipEditModal';
import { AllClearModal } from '../../components/admin/AllClearModal';
import { SystemsByStatusModal } from '../../components/admin/SystemsByStatusModal';
import type { ShipUpdate, BulkResetRequest, SystemStatus } from '../../types';
import './Admin.css';

// All system status types in display order
const ALL_STATUSES: { key: SystemStatus; label: string }[] = [
  { key: 'fully_operational', label: 'Optimal' },
  { key: 'operational', label: 'Operational' },
  { key: 'degraded', label: 'Degraded' },
  { key: 'compromised', label: 'Compromised' },
  { key: 'critical', label: 'Critical' },
  { key: 'destroyed', label: 'Destroyed' },
  { key: 'offline', label: 'Offline' },
];

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const { data: ship } = useShip();
  const { data: systems } = useSystemStates();
  const { data: posture } = usePosture();
  const { data: scenarios } = useScenarios();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAllClearModalOpen, setIsAllClearModalOpen] = useState(false);
  const [statusModalStatus, setStatusModalStatus] = useState<SystemStatus | null>(null);
  const updateShipMutation = useUpdateShip();
  const bulkResetMutation = useBulkResetSystems();

  const executeScenario = useMutation({
    mutationFn: (scenarioId: string) => scenariosApi.execute(scenarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['posture'] });
    },
  });

  const updatePosture = useMutation({
    mutationFn: ({ posture, reason }: { posture: string; reason?: string }) =>
      shipsApi.updatePosture('constellation', posture, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posture'] });
    },
  });

  // Count systems by status
  const statusCounts = systems?.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  return (
    <div className="admin-dashboard">
      <h2 className="admin-page-title">Dashboard</h2>

      <div className="admin-grid">
        {/* Ship Overview */}
        <section className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Ship Overview</h3>
            <button
              className="btn btn-small"
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit
            </button>
          </div>
          <div className="ship-overview">
            <p><strong>Name:</strong> {ship?.name}</p>
            <p><strong>Class:</strong> {ship?.ship_class}</p>
            <p><strong>Registry:</strong> {ship?.registry}</p>
            {ship?.attributes && Object.keys(ship.attributes).length > 0 && (
              <div className="ship-attributes">
                {Object.entries(ship.attributes).map(([key, value]) => (
                  <p key={key}>
                    <strong>{key}:</strong> {String(value)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Posture Control */}
        <section className="admin-card">
          <h3 className="admin-card-title">Threat Posture</h3>
          <div className="posture-control">
            <div className={`current-posture posture-${posture?.posture}`}>
              {posture?.posture?.toUpperCase()}
            </div>
            <div className="posture-buttons">
              <button
                className={`btn ${posture?.posture === 'green' ? 'active' : ''}`}
                onClick={() => updatePosture.mutate({ posture: 'green' })}
              >
                Green
              </button>
              <button
                className={`btn ${posture?.posture === 'yellow' ? 'active' : ''}`}
                onClick={() => updatePosture.mutate({ posture: 'yellow' })}
              >
                Yellow
              </button>
              <button
                className={`btn btn-danger ${posture?.posture === 'red' ? 'active' : ''}`}
                onClick={() => updatePosture.mutate({ posture: 'red' })}
              >
                Red
              </button>
            </div>
          </div>
        </section>

        {/* System Status Summary */}
        <section className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">System Status</h3>
            <button
              className="btn btn-small"
              onClick={() => setIsAllClearModalOpen(true)}
            >
              All Clear
            </button>
          </div>
          <div className="status-summary">
            {ALL_STATUSES.map(({ key, label }) => (
              <div
                key={key}
                className={`status-count ${key}`}
                onClick={() => setStatusModalStatus(key)}
                title={`Click to view ${label} systems`}
              >
                <span className="count">{statusCounts[key] ?? 0}</span>
                <span className="label">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Scenarios */}
        <section className="admin-card">
          <h3 className="admin-card-title">Quick Scenarios</h3>
          <div className="scenario-list">
            {scenarios?.map((scenario) => (
              <button
                key={scenario.id}
                className="scenario-btn"
                onClick={() => executeScenario.mutate(scenario.id)}
                disabled={executeScenario.isPending}
              >
                <span className="scenario-name">{scenario.name}</span>
                <span className="scenario-desc">{scenario.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Ship Edit Modal */}
      {ship && (
        <ShipEditModal
          ship={ship}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(data: ShipUpdate) => {
            updateShipMutation.mutate(
              { id: ship.id, data },
              {
                onSuccess: () => setIsEditModalOpen(false),
              }
            );
          }}
          isSaving={updateShipMutation.isPending}
        />
      )}

      {/* All Clear Modal */}
      <AllClearModal
        shipId={ship?.id ?? 'constellation'}
        systems={systems ?? []}
        isOpen={isAllClearModalOpen}
        onClose={() => setIsAllClearModalOpen(false)}
        onReset={(data: BulkResetRequest) => {
          bulkResetMutation.mutate(data, {
            onSuccess: () => setIsAllClearModalOpen(false),
          });
        }}
        isResetting={bulkResetMutation.isPending}
      />

      {/* Systems By Status Modal */}
      <SystemsByStatusModal
        isOpen={statusModalStatus !== null}
        status={statusModalStatus}
        systems={systems ?? []}
        onClose={() => setStatusModalStatus(null)}
      />
    </div>
  );
}
