import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ScenarioAction, SystemState } from '../../types';
import './ScenarioForm.css';

const ACTION_TYPES = [
  { value: 'set_status', label: 'Set Status' },
  { value: 'set_value', label: 'Set Value' },
  { value: 'adjust_value', label: 'Adjust Value' },
  { value: 'set_posture', label: 'Set Posture' },
  { value: 'emit_event', label: 'Emit Event' },
];

const STATUS_OPTIONS = [
  { value: 'fully_operational', label: 'Fully Operational' },
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'compromised', label: 'Compromised' },
  { value: 'critical', label: 'Critical' },
  { value: 'destroyed', label: 'Destroyed' },
  { value: 'offline', label: 'Offline' },
];

const POSTURE_OPTIONS = [
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'red', label: 'Red' },
  { value: 'silent_running', label: 'Silent Running' },
  { value: 'general_quarters', label: 'General Quarters' },
];

const EVENT_SEVERITY_OPTIONS = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

interface ActionRowProps {
  id: string;
  action: ScenarioAction;
  index: number;
  systems: SystemState[];
  onChange: (index: number, action: ScenarioAction) => void;
  onRemove: (index: number) => void;
}

export function ActionRow({ id, action, index, systems, onChange, onRemove }: ActionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateAction = (updates: Partial<ScenarioAction>) => {
    onChange(index, { ...action, ...updates });
  };

  const needsSystemTarget = ['set_status', 'set_value', 'adjust_value'].includes(action.type);
  const selectedSystem = systems.find(s => s.id === action.target);

  return (
    <div className="action-row" ref={setNodeRef} style={style}>
      <button
        type="button"
        className="action-drag-handle"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        ⋮⋮
      </button>
      <span className="action-number">{index + 1}</span>

      <div className="action-fields">
        {/* Action Type */}
        <div className="action-field">
          <label>Action</label>
          <select
            value={action.type}
            onChange={e => {
              const newType = e.target.value;
              // Reset fields when type changes
              const newAction: ScenarioAction = { type: newType };
              if (['set_status', 'set_value', 'adjust_value'].includes(newType)) {
                newAction.target = systems[0]?.id ?? '';
              }
              if (newType === 'set_status') {
                newAction.value = 'operational';
              } else if (newType === 'set_value') {
                newAction.value = 100;
              } else if (newType === 'adjust_value') {
                newAction.value = -10;
              } else if (newType === 'set_posture') {
                newAction.value = 'yellow';
              } else if (newType === 'emit_event') {
                newAction.data = { type: 'alert', severity: 'warning', message: '' };
              }
              onChange(index, newAction);
            }}
          >
            {ACTION_TYPES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Target System (for system-related actions) */}
        {needsSystemTarget && (
          <div className="action-field">
            <label>System</label>
            <select
              value={action.target ?? ''}
              onChange={e => updateAction({ target: e.target.value })}
            >
              {systems.map(sys => (
                <option key={sys.id} value={sys.id}>{sys.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Value field - varies by action type */}
        {action.type === 'set_status' && (
          <div className="action-field">
            <label>Status</label>
            <select
              value={(action.value as string) ?? 'operational'}
              onChange={e => updateAction({ value: e.target.value })}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {action.type === 'set_value' && (
          <div className="action-field">
            <label>Value</label>
            <div className="value-input-group">
              <input
                type="number"
                min={0}
                max={selectedSystem?.max_value ?? 100}
                value={(action.value as number) ?? 100}
                onChange={e => updateAction({ value: parseFloat(e.target.value) || 0 })}
              />
              <span className="value-max">/ {selectedSystem?.max_value ?? 100}</span>
            </div>
          </div>
        )}

        {action.type === 'adjust_value' && (
          <div className="action-field">
            <label>Adjust By</label>
            <input
              type="number"
              value={(action.value as number) ?? 0}
              onChange={e => updateAction({ value: parseFloat(e.target.value) || 0 })}
              placeholder="+10 or -20"
            />
          </div>
        )}

        {action.type === 'set_posture' && (
          <div className="action-field">
            <label>Posture</label>
            <select
              value={(action.value as string) ?? 'green'}
              onChange={e => updateAction({ value: e.target.value })}
            >
              {POSTURE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {action.type === 'emit_event' && (
          <>
            <div className="action-field">
              <label>Event Type</label>
              <input
                type="text"
                value={action.data?.type as string ?? 'alert'}
                onChange={e => updateAction({
                  data: { ...action.data, type: e.target.value }
                })}
                placeholder="alert"
              />
            </div>
            <div className="action-field">
              <label>Severity</label>
              <select
                value={action.data?.severity as string ?? 'warning'}
                onChange={e => updateAction({
                  data: { ...action.data, severity: e.target.value }
                })}
              >
                {EVENT_SEVERITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="action-field action-field-wide">
              <label>Message</label>
              <input
                type="text"
                value={action.data?.message as string ?? ''}
                onChange={e => updateAction({
                  data: { ...action.data, message: e.target.value }
                })}
                placeholder="Event message..."
              />
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className="btn btn-small btn-danger action-remove"
        onClick={() => onRemove(index)}
        title="Remove action"
      >
        &times;
      </button>
    </div>
  );
}
