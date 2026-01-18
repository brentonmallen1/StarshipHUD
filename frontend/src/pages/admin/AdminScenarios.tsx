import { useState } from 'react';
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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useScenarios, useSystemStates } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import {
  useCreateScenario,
  useUpdateScenario,
  useDeleteScenario,
  useExecuteScenario,
  useRehearsalScenario,
  useReorderScenarios,
  useDuplicateScenario,
} from '../../hooks/useMutations';
import { ScenarioFormModal } from '../../components/admin/ScenarioFormModal';
import { RehearsalModal } from '../../components/admin/RehearsalModal';
import type { Scenario, ScenarioCreate, ScenarioUpdate, ScenarioRehearsalResult } from '../../types';
import './Admin.css';

export function AdminScenarios() {
  const shipId = useCurrentShipId();
  const { data: scenarios, isLoading } = useScenarios();
  const { data: systems } = useSystemStates();

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | undefined>();
  const [isRehearsalModalOpen, setIsRehearsalModalOpen] = useState(false);
  const [rehearsalResult, setRehearsalResult] = useState<ScenarioRehearsalResult | null>(null);
  const [rehearsalScenarioId, setRehearsalScenarioId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mutations
  const createScenario = useCreateScenario();
  const updateScenario = useUpdateScenario();
  const deleteScenario = useDeleteScenario();
  const executeScenario = useExecuteScenario();
  const rehearseScenario = useRehearsalScenario();
  const reorderScenarios = useReorderScenarios();
  const duplicateScenario = useDuplicateScenario();

  // DnD sensors
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

  const handleDuplicate = (scenarioId: string) => {
    duplicateScenario.mutate(scenarioId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && scenarios) {
      const oldIndex = scenarios.findIndex((s) => s.id === active.id);
      const newIndex = scenarios.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(scenarios, oldIndex, newIndex);
      reorderScenarios.mutate({
        shipId: shipId ?? '',
        scenarioIds: newOrder.map((s) => s.id),
      });
    }
  };

  // Filter scenarios by search query
  const filteredScenarios = scenarios?.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <div className="loading">Loading scenarios...</div>;
  }

  return (
    <div className="admin-scenarios">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Scenarios</h2>
        <div className="admin-header-actions">
          <input
            type="text"
            className="scenario-search"
            placeholder="Search scenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleNewScenario}>
            + New Scenario
          </button>
        </div>
      </div>

      {scenarios?.length === 0 ? (
        <div className="empty-state">
          <p>No scenarios yet. Create one to get started!</p>
        </div>
      ) : filteredScenarios?.length === 0 ? (
        <div className="empty-state">
          <p>No scenarios match "{searchQuery}"</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredScenarios?.map((s) => s.id) ?? []}
            strategy={rectSortingStrategy}
          >
            <div className="scenario-grid">
              {filteredScenarios?.map((scenario) => (
                <SortableScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onEdit={() => handleEditScenario(scenario)}
                  onRehearse={() => handleRehearse(scenario.id)}
                  onExecute={() => executeScenario.mutate(scenario.id)}
                  onDuplicate={() => handleDuplicate(scenario.id)}
                  onDelete={() => handleDelete(scenario.id)}
                  isRehearsing={rehearseScenario.isPending && rehearsalScenarioId === scenario.id}
                  isExecuting={executeScenario.isPending}
                  isDuplicating={duplicateScenario.isPending}
                  deleteConfirmId={deleteConfirmId}
                  setDeleteConfirmId={setDeleteConfirmId}
                  isDeleting={deleteScenario.isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Scenario Form Modal */}
      <ScenarioFormModal
        scenario={editingScenario}
        shipId={shipId ?? ''}
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

// Sortable scenario card component
interface SortableScenarioCardProps {
  scenario: Scenario;
  onEdit: () => void;
  onRehearse: () => void;
  onExecute: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isRehearsing: boolean;
  isExecuting: boolean;
  isDuplicating: boolean;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  isDeleting: boolean;
}

function SortableScenarioCard({
  scenario,
  onEdit,
  onRehearse,
  onExecute,
  onDuplicate,
  onDelete,
  isRehearsing,
  isExecuting,
  isDuplicating,
  deleteConfirmId,
  setDeleteConfirmId,
  isDeleting,
}: SortableScenarioCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scenario.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div className="scenario-card" ref={setNodeRef} style={style}>
      <div className="scenario-card-header">
        <button
          type="button"
          className="scenario-drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
        <h3 className="scenario-title">{scenario.name}</h3>
      </div>
      <p className="scenario-description">{scenario.description}</p>
      <div className="scenario-actions-count">
        {scenario.actions.length} action{scenario.actions.length !== 1 ? 's' : ''}
      </div>
      <div className="scenario-buttons">
        <button className="btn btn-small" onClick={onEdit}>
          Edit
        </button>
        <button
          className="btn btn-small"
          onClick={onDuplicate}
          disabled={isDuplicating}
          title="Duplicate scenario"
        >
          Copy
        </button>
        <button
          className="btn btn-small"
          onClick={onRehearse}
          disabled={isRehearsing}
        >
          {isRehearsing ? '...' : 'Rehearse'}
        </button>
        <button
          className="btn btn-small btn-primary"
          onClick={onExecute}
          disabled={isExecuting}
        >
          Execute
        </button>
        {deleteConfirmId === scenario.id ? (
          <>
            <button
              className="btn btn-small btn-danger"
              onClick={onDelete}
              disabled={isDeleting}
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
  );
}
