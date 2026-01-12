import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { ScenarioAction, SystemState } from '../../types';
import { ActionRow } from './ActionRow';
import './ScenarioForm.css';

interface ActionBuilderProps {
  actions: ScenarioAction[];
  systems: SystemState[];
  onChange: (actions: ScenarioAction[]) => void;
}

export function ActionBuilder({ actions, systems, onChange }: ActionBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('action-', ''), 10);
      const newIndex = parseInt(String(over.id).replace('action-', ''), 10);
      onChange(arrayMove(actions, oldIndex, newIndex));
    }
  };

  const actionIds = actions.map((_, index) => `action-${index}`);

  return (
    <div className="action-builder">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={actionIds} strategy={verticalListSortingStrategy}>
          <div className="action-list">
            {actions.length === 0 ? (
              <p className="no-actions">No actions defined. Add an action to get started.</p>
            ) : (
              actions.map((action, index) => (
                <ActionRow
                  key={`action-${index}`}
                  id={`action-${index}`}
                  action={action}
                  index={index}
                  systems={systems}
                  onChange={handleActionChange}
                  onRemove={handleRemoveAction}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

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
