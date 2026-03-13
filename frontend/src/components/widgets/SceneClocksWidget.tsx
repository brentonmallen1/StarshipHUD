import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WidgetRendererProps } from '../../types';
import { getConfig } from '../../types';
import type { SceneClock, SceneClocksWidgetConfig } from '../../types';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import { useModalA11y } from '../../hooks/useModalA11y';
import './SceneClocksWidget.css';
import './WidgetCreationModal.css';

// ─── Clock Circle SVG Component ─────────────────────────────────────

interface ClockCircleProps {
  clock: SceneClock;
  size: number;
  onClick?: () => void;
  disabled?: boolean;
}

function ClockCircle({ clock, size, onClick, disabled }: ClockCircleProps) {
  const { segments, filled, direction } = clock;
  const cx = size / 2;
  const cy = size / 2;

  // Ring geometry: outer edge, inner edge (creates donut shape)
  const outerRadius = (size / 2) - 2;
  const innerRadius = outerRadius * 0.45; // Inner circle for the arrow
  const gapAngle = 0.12; // Gap between segments in radians

  // Build arc segments (donut/ring shape)
  const segmentPaths = useMemo(() => {
    const paths: { d: string; filled: boolean }[] = [];
    const anglePerSegment = (2 * Math.PI) / segments;

    for (let i = 0; i < segments; i++) {
      // Start from top (-PI/2) and go clockwise
      const startAngle = -Math.PI / 2 + i * anglePerSegment + gapAngle / 2;
      const endAngle = -Math.PI / 2 + (i + 1) * anglePerSegment - gapAngle / 2;

      // Outer arc points
      const ox1 = cx + outerRadius * Math.cos(startAngle);
      const oy1 = cy + outerRadius * Math.sin(startAngle);
      const ox2 = cx + outerRadius * Math.cos(endAngle);
      const oy2 = cy + outerRadius * Math.sin(endAngle);

      // Inner arc points
      const ix1 = cx + innerRadius * Math.cos(startAngle);
      const iy1 = cy + innerRadius * Math.sin(startAngle);
      const ix2 = cx + innerRadius * Math.cos(endAngle);
      const iy2 = cy + innerRadius * Math.sin(endAngle);

      // Large arc flag: 0 for segments less than 180 degrees
      const largeArc = anglePerSegment - gapAngle > Math.PI ? 1 : 0;

      // Path: outer arc clockwise, then inner arc counter-clockwise
      const d = `M ${ox1} ${oy1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;

      paths.push({
        d,
        filled: i < filled,
      });
    }

    return paths;
  }, [segments, filled, cx, cy, outerRadius, innerRadius, gapAngle]);

  // Direction arrow path (inside the inner circle)
  const arrowSize = innerRadius * 0.5;
  const arrowPath = direction === 'up'
    ? `M ${cx} ${cy - arrowSize} L ${cx + arrowSize * 0.7} ${cy + arrowSize * 0.4} L ${cx - arrowSize * 0.7} ${cy + arrowSize * 0.4} Z`
    : `M ${cx} ${cy + arrowSize} L ${cx + arrowSize * 0.7} ${cy - arrowSize * 0.4} L ${cx - arrowSize * 0.7} ${cy - arrowSize * 0.4} Z`;

  // Compute color value for CSS variable
  const colorValue = clock.color || undefined;

  return (
    <svg
      className={`clock-circle ${disabled ? 'clock-circle--disabled' : ''}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={colorValue ? { '--clock-color': colorValue } as React.CSSProperties : undefined}
      onClick={disabled ? undefined : onClick}
      role="button"
      aria-label={`${clock.title}: ${filled} of ${segments} segments filled, ${direction === 'up' ? 'counting up' : 'counting down'}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Inner circle background */}
      <circle
        cx={cx}
        cy={cy}
        r={innerRadius - 2}
        className="clock-circle__center"
      />

      {/* Arc segments */}
      {segmentPaths.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          className={`clock-circle__segment ${seg.filled ? 'clock-circle__segment--filled' : ''}`}
        />
      ))}

      {/* Direction arrow in center */}
      <path
        d={arrowPath}
        className="clock-circle__arrow"
      />
    </svg>
  );
}

// ─── Sortable Clock Item ────────────────────────────────────────────

interface SortableClockItemProps {
  clock: SceneClock;
  isCompact: boolean;
  canEditData: boolean;
  isEditing: boolean;
  onClockClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableClockItem({
  clock,
  isCompact,
  canEditData,
  isEditing,
  onClockClick,
  onEdit,
  onDelete,
}: SortableClockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clock.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const clockSize = isCompact ? 32 : 64;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`scene-clocks__item ${isCompact ? 'scene-clocks__item--compact' : ''}`}
    >
      {canEditData && !isEditing && (
        <button
          type="button"
          className="scene-clocks__drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
      )}

      <ClockCircle
        clock={clock}
        size={clockSize}
        onClick={() => onClockClick(clock.id)}
        disabled={isEditing || !canEditData}
      />

      <div className="scene-clocks__clock-info">
        <span className="scene-clocks__clock-title">{clock.title}</span>
        {!isCompact && (
          <span className="scene-clocks__clock-status">
            {clock.filled}/{clock.segments}
          </span>
        )}
      </div>

      {canEditData && !isEditing && (
        <div className="scene-clocks__actions">
          <button
            type="button"
            className="scene-clocks__action-btn"
            onClick={() => onEdit(clock.id)}
            title="Edit clock"
          >
            ✎
          </button>
          <button
            type="button"
            className="scene-clocks__action-btn scene-clocks__action-btn--delete"
            onClick={() => onDelete(clock.id)}
            title="Delete clock"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Clock Edit Modal ───────────────────────────────────────────────

interface ClockEditModalProps {
  clock?: SceneClock;
  onSave: (clock: Omit<SceneClock, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

const COLOR_PRESETS = [
  { value: '', label: 'Default (Secondary)' },
  { value: 'var(--color-optimal)', label: 'Optimal (Teal)' },
  { value: 'var(--color-operational)', label: 'Operational (Green)' },
  { value: 'var(--color-degraded)', label: 'Degraded (Amber)' },
  { value: 'var(--color-compromised)', label: 'Compromised (Orange)' },
  { value: 'var(--color-critical)', label: 'Critical (Red)' },
  { value: 'var(--color-accent-cyan)', label: 'Cyan' },
];

function ClockEditModal({ clock, onSave, onClose }: ClockEditModalProps) {
  const modalRef = useModalA11y(onClose);
  const [title, setTitle] = useState(clock?.title ?? '');
  const [segments, setSegments] = useState(clock?.segments ?? 6);
  const [direction, setDirection] = useState<'up' | 'down'>(clock?.direction ?? 'up');
  const [color, setColor] = useState(clock?.color ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      id: clock?.id,
      title: title.trim(),
      segments,
      filled: clock?.filled ?? (direction === 'up' ? 0 : segments),
      direction,
      color: color || undefined,
    });
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal-content"
        style={{ maxWidth: '400px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{clock ? 'Edit Clock' : 'Add Clock'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="config-section">
              <label className="configure-label">Title</label>
              <input
                type="text"
                className="config-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Countdown to Arrival"
                autoFocus
              />
            </div>

            <div className="config-section">
              <label className="configure-label">Segments: {segments}</label>
              <input
                type="range"
                className="config-input"
                min={2}
                max={12}
                value={segments}
                onChange={(e) => setSegments(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="config-section">
              <label className="configure-label">Direction</label>
              <div className="scene-clocks__direction-toggle">
                <button
                  type="button"
                  className={`scene-clocks__direction-btn ${direction === 'up' ? 'scene-clocks__direction-btn--active' : ''}`}
                  onClick={() => setDirection('up')}
                >
                  ↑ Fill Up
                </button>
                <button
                  type="button"
                  className={`scene-clocks__direction-btn ${direction === 'down' ? 'scene-clocks__direction-btn--active' : ''}`}
                  onClick={() => setDirection('down')}
                >
                  ↓ Drain Down
                </button>
              </div>
            </div>

            <div className="config-section">
              <label className="configure-label">Color</label>
              <select
                className="config-input"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              >
                {COLOR_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              {clock ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Widget Component ──────────────────────────────────────────

export function SceneClocksWidget({
  instance,
  isEditing,
  canEditData,
  onConfigChange,
}: WidgetRendererProps) {
  const config = getConfig<SceneClocksWidgetConfig>(instance.config);
  const { containerRef, width, ready } = useContainerDimensions();

  // Local state for immediate UI feedback
  const [localClocks, setLocalClocks] = useState<SceneClock[]>(config.clocks ?? []);
  const [editingClock, setEditingClock] = useState<SceneClock | null>(null);
  const [isAddingClock, setIsAddingClock] = useState(false);

  // Sync local state when config changes externally
  useEffect(() => {
    setLocalClocks(config.clocks ?? []);
  }, [config.clocks]);

  // Persist clocks to config
  const persistClocks = useCallback(
    (clocks: SceneClock[]) => {
      setLocalClocks(clocks);
      onConfigChange?.({ ...instance.config, clocks });
    },
    [onConfigChange, instance.config]
  );

  // Drag and drop setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = localClocks.findIndex((c) => c.id === active.id);
        const newIndex = localClocks.findIndex((c) => c.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          persistClocks(arrayMove(localClocks, oldIndex, newIndex));
        }
      }
    },
    [localClocks, persistClocks]
  );

  // Clock click handler - single step fill/drain with cycling
  const handleClockClick = useCallback(
    (id: string) => {
      if (isEditing || !canEditData) return;

      const clock = localClocks.find((c) => c.id === id);
      if (!clock) return;

      let newFilled: number;

      if (clock.direction === 'up') {
        // Fill mode: increment, cycle to 0 when full
        newFilled = clock.filled >= clock.segments ? 0 : clock.filled + 1;
      } else {
        // Drain mode: decrement, cycle to full when empty
        newFilled = clock.filled <= 0 ? clock.segments : clock.filled - 1;
      }

      const updatedClocks = localClocks.map((c) =>
        c.id === id ? { ...c, filled: newFilled } : c
      );

      persistClocks(updatedClocks);
    },
    [localClocks, isEditing, canEditData, persistClocks]
  );

  // CRUD handlers
  const handleAddClock = useCallback(
    (clockData: Omit<SceneClock, 'id'> & { id?: string }) => {
      const newClock: SceneClock = {
        id: crypto.randomUUID(),
        title: clockData.title,
        segments: clockData.segments,
        filled: clockData.filled,
        direction: clockData.direction,
        color: clockData.color,
      };

      persistClocks([...localClocks, newClock]);
      setIsAddingClock(false);
    },
    [localClocks, persistClocks]
  );

  const handleEditClock = useCallback(
    (clockData: Omit<SceneClock, 'id'> & { id?: string }) => {
      if (!clockData.id) return;

      const updatedClocks = localClocks.map((c) =>
        c.id === clockData.id
          ? {
              ...c,
              title: clockData.title,
              segments: clockData.segments,
              direction: clockData.direction,
              color: clockData.color,
              // Clamp filled to new segment count
              filled: Math.min(c.filled, clockData.segments),
            }
          : c
      );

      persistClocks(updatedClocks);
      setEditingClock(null);
    },
    [localClocks, persistClocks]
  );

  const handleDeleteClock = useCallback(
    (id: string) => {
      persistClocks(localClocks.filter((c) => c.id !== id));
    },
    [localClocks, persistClocks]
  );

  // Responsive layout
  const isCompact = ready && width < 200;
  const clockIds = localClocks.map((c) => c.id);

  // Editing mode placeholder
  if (isEditing) {
    return (
      <div className="scene-clocks-widget scene-clocks-widget--editing">
        <span className="scene-clocks-widget__label">SCENE CLOCKS</span>
        <span className="scene-clocks-widget__hint">
          {localClocks.length} clock{localClocks.length !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`scene-clocks-widget ${isCompact ? 'scene-clocks-widget--compact' : 'scene-clocks-widget--grid'}`}
    >
      {localClocks.length === 0 ? (
        <div className="scene-clocks__empty">
          <p>No clocks yet</p>
          {canEditData && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddingClock(true)}
            >
              + Add Clock
            </button>
          )}
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={clockIds}
              strategy={isCompact ? verticalListSortingStrategy : rectSortingStrategy}
            >
              <div className="scene-clocks__list">
                {localClocks.map((clock) => (
                  <SortableClockItem
                    key={clock.id}
                    clock={clock}
                    isCompact={isCompact}
                    canEditData={canEditData}
                    isEditing={isEditing}
                    onClockClick={handleClockClick}
                    onEdit={(id) => {
                      const c = localClocks.find((cl) => cl.id === id);
                      if (c) setEditingClock(c);
                    }}
                    onDelete={handleDeleteClock}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {canEditData && (
            <button
              type="button"
              className="scene-clocks__add-btn"
              onClick={() => setIsAddingClock(true)}
            >
              + Add Clock
            </button>
          )}
        </>
      )}

      {/* Modals */}
      {isAddingClock && (
        <ClockEditModal
          onSave={handleAddClock}
          onClose={() => setIsAddingClock(false)}
        />
      )}

      {editingClock && (
        <ClockEditModal
          clock={editingClock}
          onSave={handleEditClock}
          onClose={() => setEditingClock(null)}
        />
      )}
    </div>
  );
}
