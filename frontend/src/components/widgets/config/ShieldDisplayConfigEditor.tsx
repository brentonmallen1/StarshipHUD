import { useState } from 'react';
import type { ShieldDisplayConfig, ShieldSegment, WidgetConfigEditorProps } from '../../../types';
import { SHIELD_DISPLAY_DEFAULTS } from '../../../types';
import { MediaPickerModal } from '../../admin/MediaPickerModal';
import { CheckboxField, NumberField, SelectField, SystemSelect } from './fields';
import './configEditors.css';

/** Positional label for each segment slot, matching how the widget lays out arcs. */
function slotLabels(count: number, twoSplit: ShieldDisplayConfig['two_segment_split']): string[] {
  if (count <= 1) return ['Full Ring'];
  if (count === 2) return twoSplit === 'fore_aft' ? ['Fore', 'Aft'] : ['Starboard', 'Port'];
  if (count === 3) return ['Fore', 'Starboard-Aft', 'Port-Aft'];
  return ['Fore-Starboard', 'Aft-Starboard', 'Aft-Port', 'Fore-Port'];
}

export function ShieldDisplayConfigEditor({
  config,
  onChange,
  systemStates,
}: WidgetConfigEditorProps<ShieldDisplayConfig>) {
  const c = { ...SHIELD_DISPLAY_DEFAULTS, ...config };
  const segments = c.segments;
  const labels = slotLabels(segments.length, c.two_segment_split);
  const [showPicker, setShowPicker] = useState(false);

  const setSegments = (next: ShieldSegment[]) => onChange({ segments: next });
  const updateSegment = (i: number, patch: Partial<ShieldSegment>) =>
    setSegments(segments.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)));

  return (
    <>
      <div className="configure-section">
        <label className="configure-label">Shield Segments (1–4)</label>
        <p className="field-hint">
          Add up to 4 segments. Each segment covers an arc around the ship. The outer arc
          is the primary system, the inner arc is the optional secondary system.
        </p>

        {segments.map((seg, i) => (
          <div key={i} className="config-subsection">
            <div className="config-subsection__header">
              <span className="configure-label">
                Segment {i + 1}{labels[i] ? ` — ${labels[i]}` : ''}
              </span>
              <button
                className="btn btn-small btn-danger"
                type="button"
                onClick={() => setSegments(segments.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
            </div>

            <label className="configure-label config-sublabel">Primary System (Outer Arc)</label>
            <SystemSelect
              value={seg.primary_id}
              systemStates={systemStates}
              onChange={(primary_id) => updateSegment(i, { primary_id })}
            />

            <label className="configure-label config-sublabel config-sublabel--spaced">
              Secondary System (Inner Arc, optional)
            </label>
            <SystemSelect
              value={seg.secondary_id}
              systemStates={systemStates}
              onChange={(secondary_id) => updateSegment(i, { secondary_id })}
            />
          </div>
        ))}

        {segments.length < 4 && (
          <button className="btn btn-small" type="button" onClick={() => setSegments([...segments, {}])}>
            + Add Segment
          </button>
        )}
      </div>

      {segments.length === 2 && (
        <SelectField
          label="Two-Segment Split"
          value={c.two_segment_split}
          options={[
            { value: 'port_starboard', label: 'Port / Starboard (left–right)' },
            { value: 'fore_aft', label: 'Fore / Aft (top–bottom)' },
          ]}
          onChange={(two_segment_split) => onChange({ two_segment_split })}
          hint="Which axis divides the two 180° arcs"
        />
      )}

      {segments.length > 1 && (
        <NumberField
          label="Gap Between Segments (degrees)"
          min={0}
          max={30}
          step={1}
          fallback={SHIELD_DISPLAY_DEFAULTS.arc_gap_deg}
          value={c.arc_gap_deg}
          onChange={(arc_gap_deg) => onChange({ arc_gap_deg })}
          hint="Angular gap separating adjacent arcs"
        />
      )}

      <CheckboxField
        label="Show system name labels"
        checked={c.show_labels}
        onChange={(show_labels) => onChange({ show_labels })}
        hint="Display the bound system name near each arc segment"
      />

      <div className="configure-section">
        <label className="configure-label">Ship Image (Optional)</label>
        <p className="field-hint">
          Upload an image to replace the default triangle in the center.
          Recommended: square PNG/SVG with transparency.
        </p>
        {c.ship_image_url && (
          <div className="config-image-preview">
            <img src={c.ship_image_url} alt="Ship preview" />
            <button
              className="btn btn-small btn-danger"
              type="button"
              onClick={() => onChange({ ship_image_url: undefined })}
            >
              Remove image
            </button>
          </div>
        )}
        <button className="btn btn-small" type="button" onClick={() => setShowPicker(true)}>
          {c.ship_image_url ? 'Replace image' : 'Upload image'}
        </button>
        {showPicker && (
          <MediaPickerModal
            currentUrl={c.ship_image_url || undefined}
            onSelect={(url) => {
              onChange({ ship_image_url: url || undefined });
              setShowPicker(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </>
  );
}
