import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ScenarioAction, SystemState, ShipEvent, HolomapMarker, SensorContact } from '../../types';
import type { SoundboardWidgetConfig } from '../../types';
import { AudioPickerModal } from './AudioPickerModal';
import './ScenarioForm.css';

const ACTION_TYPES = [
  { value: 'set_status', label: 'Set Status' },
  { value: 'set_value', label: 'Set Value' },
  { value: 'adjust_value', label: 'Adjust Value' },
  { value: 'set_posture', label: 'Set Posture' },
  { value: 'emit_event', label: 'Emit Event' },
  { value: 'initiate_hail', label: 'Initiate Hail' },
  { value: 'toggle_transmission', label: 'Toggle Transmission' },
  { value: 'toggle_holomap_marker', label: 'Toggle Holomap Marker' },
  { value: 'toggle_sensor_contact', label: 'Toggle Sensor Contact' },
  { value: 'play_audio', label: 'Play Audio' },
  { value: 'play_soundboard', label: 'Play Soundboard Button' },
  { value: 'stop_audio', label: 'Stop Audio' },
];

const STATUS_OPTIONS = [
  { value: 'optimal', label: 'Optimal' },
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

interface SoundboardWidgetInfo {
  id: string;
  panelName: string;
  config: SoundboardWidgetConfig;
}

interface ActionRowProps {
  id: string;
  action: ScenarioAction;
  index: number;
  systems: SystemState[];
  transmissions?: ShipEvent[];
  holomapMarkers?: HolomapMarker[];
  sensorContacts?: SensorContact[];
  audioAssets?: string[];
  soundboardWidgets?: SoundboardWidgetInfo[];
  onChange: (index: number, action: ScenarioAction) => void;
  onRemove: (index: number) => void;
}

export function ActionRow({ id, action, index, systems, transmissions, holomapMarkers, sensorContacts, audioAssets, soundboardWidgets, onChange, onRemove }: ActionRowProps) {
  const [showAudioPicker, setShowAudioPicker] = useState(false);

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

  // For play_soundboard - get buttons from selected widget
  const selectedSoundboardWidget = soundboardWidgets?.find(w => w.id === action.target);
  const soundboardButtons = selectedSoundboardWidget?.config?.buttons ?? [];

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
              } else if (newType === 'initiate_hail') {
                // No additional config needed - just uses value for toggle/on/off
              } else if (newType === 'toggle_transmission') {
                newAction.target = transmissions?.[0]?.id ?? '';
              } else if (newType === 'toggle_holomap_marker') {
                newAction.target = holomapMarkers?.[0]?.id ?? '';
              } else if (newType === 'toggle_sensor_contact') {
                newAction.target = sensorContacts?.[0]?.id ?? '';
              } else if (newType === 'play_audio') {
                newAction.target = audioAssets?.[0] ?? '';
                newAction.data = { loop: false };
              } else if (newType === 'play_soundboard') {
                const firstWidget = soundboardWidgets?.[0];
                newAction.target = firstWidget?.id ?? '';
                newAction.value = firstWidget?.config?.buttons?.[0]?.id ?? '';
              } else if (newType === 'stop_audio') {
                // No additional config needed
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

        {action.type === 'initiate_hail' && (
          <div className="action-field">
            <label>Action</label>
            <select
              value={action.value === undefined ? 'toggle' : action.value ? 'on' : 'off'}
              onChange={e => {
                const val = e.target.value;
                updateAction({ value: val === 'toggle' ? undefined : val === 'on' });
              }}
            >
              <option value="toggle">Toggle</option>
              <option value="on">Activate Hail</option>
              <option value="off">Clear Hail</option>
            </select>
          </div>
        )}

        {action.type === 'toggle_transmission' && (
          <>
            <div className="action-field">
              <label>Transmission</label>
              <select
                value={action.target ?? ''}
                onChange={e => updateAction({ target: e.target.value })}
              >
                {transmissions && transmissions.length > 0 ? (
                  transmissions.map(t => (
                    <option key={t.id} value={t.id}>{t.message || t.id}</option>
                  ))
                ) : (
                  <option value="">No transmissions available</option>
                )}
              </select>
            </div>
            <div className="action-field">
              <label>Action</label>
              <select
                value={action.value === undefined ? 'toggle' : action.value ? 'show' : 'hide'}
                onChange={e => {
                  const val = e.target.value;
                  updateAction({ value: val === 'toggle' ? undefined : val === 'show' });
                }}
              >
                <option value="toggle">Toggle</option>
                <option value="show">Show (Transmit)</option>
                <option value="hide">Hide (Untransmit)</option>
              </select>
            </div>
          </>
        )}

        {action.type === 'toggle_holomap_marker' && (
          <>
            <div className="action-field">
              <label>Marker</label>
              <select
                value={action.target ?? ''}
                onChange={e => updateAction({ target: e.target.value })}
              >
                {holomapMarkers && holomapMarkers.length > 0 ? (
                  holomapMarkers.map(m => (
                    <option key={m.id} value={m.id}>{m.label || m.type || m.id}</option>
                  ))
                ) : (
                  <option value="">No markers available</option>
                )}
              </select>
            </div>
            <div className="action-field">
              <label>Action</label>
              <select
                value={action.value === undefined ? 'toggle' : action.value ? 'show' : 'hide'}
                onChange={e => {
                  const val = e.target.value;
                  updateAction({ value: val === 'toggle' ? undefined : val === 'show' });
                }}
              >
                <option value="toggle">Toggle</option>
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </select>
            </div>
          </>
        )}

        {action.type === 'toggle_sensor_contact' && (
          <>
            <div className="action-field">
              <label>Sensor Contact</label>
              <select
                value={action.target ?? ''}
                onChange={e => updateAction({ target: e.target.value })}
              >
                {sensorContacts && sensorContacts.length > 0 ? (
                  sensorContacts.map(c => (
                    <option key={c.id} value={c.id}>{c.label || c.id}</option>
                  ))
                ) : (
                  <option value="">No contacts available</option>
                )}
              </select>
            </div>
            <div className="action-field">
              <label>Action</label>
              <select
                value={action.value === undefined ? 'toggle' : action.value ? 'show' : 'hide'}
                onChange={e => {
                  const val = e.target.value;
                  updateAction({ value: val === 'toggle' ? undefined : val === 'show' });
                }}
              >
                <option value="toggle">Toggle</option>
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </select>
            </div>
          </>
        )}

        {action.type === 'play_audio' && (
          <>
            <div className="action-field">
              <label>Audio File</label>
              <div className="audio-select-row">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setShowAudioPicker(true)}
                >
                  {action.target ? 'Change' : 'Select'}
                </button>
                {action.target && (
                  <span className="audio-filename">{(action.target as string).split('/').pop()}</span>
                )}
              </div>
            </div>
            <div className="action-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={action.data?.loop as boolean ?? false}
                  onChange={e => updateAction({ data: { ...action.data, loop: e.target.checked } })}
                />
                Loop
              </label>
            </div>
          </>
        )}

        {action.type === 'play_soundboard' && (
          <>
            <div className="action-field">
              <label>Soundboard Widget</label>
              <select
                value={action.target ?? ''}
                onChange={e => {
                  const widgetId = e.target.value;
                  const widget = soundboardWidgets?.find(w => w.id === widgetId);
                  const firstButton = widget?.config?.buttons?.[0];
                  updateAction({
                    target: widgetId,
                    value: firstButton?.id ?? '',
                  });
                }}
              >
                {soundboardWidgets && soundboardWidgets.length > 0 ? (
                  soundboardWidgets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.panelName} - Soundboard
                    </option>
                  ))
                ) : (
                  <option value="">No soundboards available</option>
                )}
              </select>
            </div>
            <div className="action-field">
              <label>Button</label>
              <select
                value={(action.value as string) ?? ''}
                onChange={e => updateAction({ value: e.target.value })}
              >
                {soundboardButtons.length > 0 ? (
                  soundboardButtons.map(b => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))
                ) : (
                  <option value="">No buttons in this soundboard</option>
                )}
              </select>
            </div>
          </>
        )}

        {action.type === 'stop_audio' && (
          <div className="action-field">
            <span className="action-hint">Stops any currently playing audio</span>
          </div>
        )}
      </div>

      {showAudioPicker && (
        <AudioPickerModal
          currentUrl={action.target as string}
          onSelect={(url) => {
            updateAction({ target: url });
            setShowAudioPicker(false);
          }}
          onClose={() => setShowAudioPicker(false)}
        />
      )}

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
