import type { ScenarioAction, SystemState } from '../../types';
import { ActionRow } from './ActionRow';
import './ScenarioForm.css';

interface ActionBuilderProps {
  actions: ScenarioAction[];
  systems: SystemState[];
  onChange: (actions: ScenarioAction[]) => void;
}

export function ActionBuilder({ actions, systems, onChange }: ActionBuilderProps) {
  const handleActionChange = (index: number, action: ScenarioAction) => {
    const newActions = [...actions];
    newActions[index] = action;
    onChange(newActions);
  };

  const handleRemoveAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    onChange(newActions);
  };

  const handleAddAction = () => {
    const defaultAction: ScenarioAction = {
      type: 'set_status',
      target: systems[0]?.id ?? '',
      value: 'degraded',
    };
    onChange([...actions, defaultAction]);
  };

  return (
    <div className="action-builder">
      <div className="action-list">
        {actions.length === 0 ? (
          <p className="no-actions">No actions defined. Add an action to get started.</p>
        ) : (
          actions.map((action, index) => (
            <ActionRow
              key={index}
              action={action}
              index={index}
              systems={systems}
              onChange={handleActionChange}
              onRemove={handleRemoveAction}
            />
          ))
        )}
      </div>

      <button
        type="button"
        className="btn add-action-btn"
        onClick={handleAddAction}
      >
        + Add Action
      </button>
    </div>
  );
}
