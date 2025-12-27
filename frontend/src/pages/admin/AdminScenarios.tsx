import { useState } from 'react';
import { useScenarios, useSystemStates } from '../../hooks/useShipData';
import {
  useCreateScenario,
  useUpdateScenario,
  useDeleteScenario,
  useExecuteScenario,
  useRehearsalScenario,
} from '../../hooks/useMutations';
import { ScenarioFormModal } from '../../components/admin/ScenarioFormModal';
import { RehearsalModal } from '../../components/admin/RehearsalModal';
import type { Scenario, ScenarioCreate, ScenarioUpdate, ScenarioRehearsalResult } from '../../types';
import './Admin.css';

const DEFAULT_SHIP_ID = 'constellation';

export function AdminScenarios() {
  const { data: scenarios, isLoading } = useScenarios();
  const { data: systems } = useSystemStates();

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | undefined>();
  const [isRehearsalModalOpen, setIsRehearsalModalOpen] = useState(false);
  const [rehearsalResult, setRehearsalResult] = useState<ScenarioRehearsalResult | null>(null);
  const [rehearsalScenarioId, setRehearsalScenarioId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Mutations
  const createScenario = useCreateScenario();
  const updateScenario = useUpdateScenario();
  const deleteScenario = useDeleteScenario();
  const executeScenario = useExecuteScenario();
  const rehearseScenario = useRehearsalScenario();

  const handleNewScenario = () => {
    setEditingScenario(undefined);
    setIsFormModalOpen(true);
  };

  const handleEditScenario = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setIsFormModalOpen(true);
  };

  const handleSaveScenario = (data: ScenarioCreate | ScenarioUpdate) => {
    if (editingScenario) {
      updateScenario.mutate(
        { id: editingScenario.id, data: data as ScenarioUpdate },
        {
          onSuccess: () => setIsFormModalOpen(false),
        }
      );
    } else {
      createScenario.mutate(data as ScenarioCreate, {
        onSuccess: () => setIsFormModalOpen(false),
      });
    }
  };

  const handleRehearse = (scenarioId: string) => {
    setRehearsalScenarioId(scenarioId);
    rehearseScenario.mutate(scenarioId, {
      onSuccess: (result) => {
        setRehearsalResult(result);
        setIsRehearsalModalOpen(true);
      },
    });
  };

  const handleExecuteFromRehearsal = () => {
    if (rehearsalScenarioId) {
      executeScenario.mutate(rehearsalScenarioId, {
        onSuccess: () => {
          setIsRehearsalModalOpen(false);
          setRehearsalResult(null);
          setRehearsalScenarioId(null);
        },
      });
    }
  };

  const handleDelete = (scenarioId: string) => {
    deleteScenario.mutate(scenarioId, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  if (isLoading) {
    return <div className="loading">Loading scenarios...</div>;
  }

  return (
    <div className="admin-scenarios">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Scenarios</h2>
        <button className="btn btn-primary" onClick={handleNewScenario}>
          + New Scenario
        </button>
      </div>

      {scenarios?.length === 0 ? (
        <div className="empty-state">
          <p>No scenarios yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="scenario-grid">
          {scenarios?.map((scenario) => (
            <div key={scenario.id} className="scenario-card">
              <h3 className="scenario-title">{scenario.name}</h3>
              <p className="scenario-description">{scenario.description}</p>
              <div className="scenario-actions-count">
                {scenario.actions.length} action{scenario.actions.length !== 1 ? 's' : ''}
              </div>
              <div className="scenario-buttons">
                <button
                  className="btn btn-small"
                  onClick={() => handleEditScenario(scenario)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-small"
                  onClick={() => handleRehearse(scenario.id)}
                  disabled={rehearseScenario.isPending}
                >
                  {rehearseScenario.isPending && rehearsalScenarioId === scenario.id
                    ? '...'
                    : 'Rehearse'}
                </button>
                <button
                  className="btn btn-small btn-primary"
                  onClick={() => executeScenario.mutate(scenario.id)}
                  disabled={executeScenario.isPending}
                >
                  Execute
                </button>
                {deleteConfirmId === scenario.id ? (
                  <>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(scenario.id)}
                      disabled={deleteScenario.isPending}
                    >
                      Confirm
                    </button>
                    <button
                      className="btn btn-small"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => setDeleteConfirmId(scenario.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scenario Form Modal */}
      <ScenarioFormModal
        scenario={editingScenario}
        shipId={DEFAULT_SHIP_ID}
        systems={systems ?? []}
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingScenario(undefined);
        }}
        onSave={handleSaveScenario}
        isSaving={createScenario.isPending || updateScenario.isPending}
      />

      {/* Rehearsal Modal */}
      {rehearsalResult && (
        <RehearsalModal
          result={rehearsalResult}
          isOpen={isRehearsalModalOpen}
          onClose={() => {
            setIsRehearsalModalOpen(false);
            setRehearsalResult(null);
            setRehearsalScenarioId(null);
          }}
          onExecute={handleExecuteFromRehearsal}
          isExecuting={executeScenario.isPending}
        />
      )}
    </div>
  );
}
