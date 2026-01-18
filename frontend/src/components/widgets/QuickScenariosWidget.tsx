import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useScenarios } from '../../hooks/useShipData';
import { scenariosApi } from '../../services/api';
import type { WidgetRendererProps } from '../../types';
import './QuickScenariosWidget.css';

export function QuickScenariosWidget({ instance, isEditing }: WidgetRendererProps) {
  const queryClient = useQueryClient();
  const { data: scenarios, isLoading, error } = useScenarios();

  const config = instance.config as {
    maxVisible?: number;
    showDescriptions?: boolean;
  };
  const maxVisible = config.maxVisible ?? 10;
  const showDescriptions = config.showDescriptions !== false;

  const executeScenario = useMutation({
    mutationFn: (scenarioId: string) => scenariosApi.execute(scenarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['posture'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  if (isEditing) {
    return (
      <div className="quick-scenarios-widget editing">
        <div className="quick-scenarios-header">
          <h3 className="quick-scenarios-title">Quick Scenarios</h3>
        </div>
        <div className="quick-scenarios-preview">
          <div className="scenario-btn-preview">
            <span className="scenario-name-preview">Hull Breach</span>
            <span className="scenario-desc-preview">Simulated hull breach event</span>
          </div>
          <div className="scenario-btn-preview">
            <span className="scenario-name-preview">Power Surge</span>
            <span className="scenario-desc-preview">Engineering emergency</span>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="quick-scenarios-widget loading">
        <div className="quick-scenarios-header">
          <h3 className="quick-scenarios-title">Quick Scenarios</h3>
        </div>
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quick-scenarios-widget error">
        <div className="quick-scenarios-header">
          <h3 className="quick-scenarios-title">Quick Scenarios</h3>
        </div>
        <div className="error-state">Unable to load scenarios</div>
      </div>
    );
  }

  const displayScenarios = scenarios?.slice(0, maxVisible) ?? [];
  const hasMore = (scenarios?.length ?? 0) > maxVisible;

  return (
    <div className="quick-scenarios-widget">
      <div className="quick-scenarios-header">
        <h3 className="quick-scenarios-title">Quick Scenarios</h3>
        <Link to="/admin/scenarios" className="manage-link" title="Manage scenarios">
          Manage
        </Link>
      </div>

      <div className="quick-scenarios-content">
        {displayScenarios.length === 0 ? (
          <div className="empty-state">
            <p>No scenarios configured</p>
            <Link to="/admin/scenarios" className="btn btn-small">
              Create Scenario
            </Link>
          </div>
        ) : (
          <div className="scenario-list">
            {displayScenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className="scenario-btn"
                onClick={() => executeScenario.mutate(scenario.id)}
                disabled={executeScenario.isPending}
                title={scenario.description || scenario.name}
              >
                <span className="scenario-name">{scenario.name}</span>
                {showDescriptions && scenario.description && (
                  <span className="scenario-desc">{scenario.description}</span>
                )}
                {executeScenario.isPending &&
                  executeScenario.variables === scenario.id && (
                    <span className="scenario-loading">Running...</span>
                  )}
              </button>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="scenarios-overflow">
            <Link to="/admin/scenarios" className="view-all-link">
              +{(scenarios?.length ?? 0) - maxVisible} more scenarios
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
