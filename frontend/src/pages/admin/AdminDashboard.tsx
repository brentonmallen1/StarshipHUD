import { useState } from 'react';
import { useShip, useSystemStates, usePosture, useScenarios } from '../../hooks/useShipData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scenariosApi, shipsApi } from '../../services/api';
import { useUpdateShip } from '../../hooks/useMutations';
import { ShipEditModal } from '../../components/admin/ShipEditModal';
import type { ShipUpdate } from '../../types';
import './Admin.css';

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const { data: ship } = useShip();
  const { data: systems } = useSystemStates();
  const { data: posture } = usePosture();
  const { data: scenarios } = useScenarios();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const updateShipMutation = useUpdateShip();

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
          <h3 className="admin-card-title">System Status</h3>
          <div className="status-summary">
            <div className="status-count operational">
              <span className="count">{statusCounts.operational ?? 0}</span>
              <span className="label">Operational</span>
            </div>
            <div className="status-count degraded">
              <span className="count">{statusCounts.degraded ?? 0}</span>
              <span className="label">Degraded</span>
            </div>
            <div className="status-count compromised">
              <span className="count">{statusCounts.compromised ?? 0}</span>
              <span className="label">Compromised</span>
            </div>
            <div className="status-count critical">
              <span className="count">{statusCounts.critical ?? 0}</span>
              <span className="label">Critical</span>
            </div>
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
    </div>
  );
}
