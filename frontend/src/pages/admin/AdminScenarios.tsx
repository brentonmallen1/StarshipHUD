import { useScenarios } from '../../hooks/useShipData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scenariosApi } from '../../services/api';
import './Admin.css';

export function AdminScenarios() {
  const queryClient = useQueryClient();
  const { data: scenarios, isLoading } = useScenarios();

  const executeScenario = useMutation({
    mutationFn: (scenarioId: string) => scenariosApi.execute(scenarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['posture'] });
    },
  });

  if (isLoading) {
    return <div className="loading">Loading scenarios...</div>;
  }

  return (
    <div className="admin-scenarios">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Scenarios</h2>
        <button className="btn btn-primary">+ New Scenario</button>
      </div>

      <div className="scenario-grid">
        {scenarios?.map((scenario) => (
          <div key={scenario.id} className="scenario-card">
            <h3 className="scenario-title">{scenario.name}</h3>
            <p className="scenario-description">{scenario.description}</p>
            <div className="scenario-actions-count">
              {scenario.actions.length} action{scenario.actions.length !== 1 ? 's' : ''}
            </div>
            <div className="scenario-buttons">
              <button className="btn btn-small">Edit</button>
              <button className="btn btn-small">Rehearse</button>
              <button
                className="btn btn-small btn-primary"
                onClick={() => executeScenario.mutate(scenario.id)}
                disabled={executeScenario.isPending}
              >
                Execute
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
