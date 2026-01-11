import { useState, useMemo, useCallback, useEffect } from 'react';
import { Group } from '@visx/group';
import { Circle, Line } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { localPoint } from '@visx/event';
import { pointRadial } from 'd3-shape';
import { useAllSensorContactsWithDossiers, useContacts } from '../../hooks/useShipData';
import {
  useCreateSensorContact,
  useUpdateSensorContact,
  useDeleteSensorContact,
  useRevealSensorContact,
  useHideSensorContact,
} from '../../hooks/useMutations';
import type { SensorContactWithDossier, SensorContactCreate, SensorContactUpdate, ThreatLevel, Contact } from '../../types';
import './Admin.css';
import './AdminRadar.css';

const DEFAULT_SHIP_ID = 'constellation';
const DEFAULT_RANGE_SCALES = [1000, 10000, 100000, 1000000];

const THREAT_LEVEL_OPTIONS: { value: ThreatLevel; label: string }[] = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'suspicious', label: 'Suspicious' },
  { value: 'hostile', label: 'Hostile' },
];

const BEARING_LABELS = [
  { angle: 0, label: '0°' },
  { angle: 45, label: '45°' },
  { angle: 90, label: '90°' },
  { angle: 135, label: '135°' },
  { angle: 180, label: '180°' },
  { angle: 225, label: '225°' },
  { angle: 270, label: '270°' },
  { angle: 315, label: '315°' },
];

// Format range for display
// Uses K/M suffixes for large values (implicitly km), shows "km" only for small values
function formatRange(km: number): string {
  if (km >= 1000000) return `${(km / 1000000).toFixed(1)}M`;
  if (km >= 1000) return `${(km / 1000).toFixed(0)}K`;
  return `${km.toFixed(0)} km`;
}

export function AdminRadar() {
  const { data: contacts, isLoading } = useAllSensorContactsWithDossiers();
  const { data: dossiers } = useContacts(DEFAULT_SHIP_ID);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [currentScaleIndex, setCurrentScaleIndex] = useState(1);
  const currentScale = DEFAULT_RANGE_SCALES[currentScaleIndex];

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [placingMode, setPlacingMode] = useState(false);

  // Form state for new/editing contact
  const [formData, setFormData] = useState<SensorContactCreate & { id?: string }>({
    ship_id: DEFAULT_SHIP_ID,
    label: '',
    threat_level: 'unknown',
    confidence: 50,
    bearing_deg: 0,
    range_km: 1000,
    visible: false,
  });

  // Mutations
  const createContact = useCreateSensorContact();
  const updateContact = useUpdateSensorContact();
  const deleteContact = useDeleteSensorContact();
  const revealContact = useRevealSensorContact();
  const hideContact = useHideSensorContact();

  // Selected contact
  const selectedContact = useMemo(() => {
    if (!selectedContactId || !contacts) return null;
    return contacts.find((c) => c.id === selectedContactId) ?? null;
  }, [selectedContactId, contacts]);

  // When selecting a contact, populate the form
  useEffect(() => {
    if (selectedContact) {
      setFormData({
        ship_id: selectedContact.ship_id,
        label: selectedContact.label,
        contact_id: selectedContact.contact_id,
        threat_level: selectedContact.threat_level,
        confidence: selectedContact.confidence,
        bearing_deg: selectedContact.bearing_deg,
        range_km: selectedContact.range_km,
        vector: selectedContact.vector,
        signal_strength: selectedContact.signal_strength,
        notes: selectedContact.notes,
        visible: selectedContact.visible,
        id: selectedContact.id,
      });
      setShowCreateForm(false);
    }
  }, [selectedContact]);

  // Handle canvas click for placing
  const handleCanvasClick = useCallback((bearingDeg: number, rangeKm: number) => {
    if (!placingMode) return;

    setFormData((prev) => ({
      ...prev,
      bearing_deg: Math.round(bearingDeg * 10) / 10,
      range_km: Math.round(rangeKm),
      label: prev.label || 'New Contact',
    }));
    setShowCreateForm(true);
    setSelectedContactId(null);
    setPlacingMode(false);
  }, [placingMode]);

  // Handle form submit
  const handleSubmit = () => {
    if (!formData.label) {
      alert('Please enter a label');
      return;
    }

    if (selectedContactId) {
      // Update existing
      const updateData: SensorContactUpdate = {
        label: formData.label,
        contact_id: formData.contact_id,
        threat_level: formData.threat_level,
        confidence: formData.confidence,
        bearing_deg: formData.bearing_deg,
        range_km: formData.range_km,
        vector: formData.vector,
        signal_strength: formData.signal_strength,
        notes: formData.notes,
        visible: formData.visible,
      };
      updateContact.mutate(
        { id: selectedContactId, data: updateData },
        {
          onSuccess: () => {
            setSelectedContactId(null);
          },
        }
      );
    } else {
      // Create new
      createContact.mutate(formData, {
        onSuccess: () => {
          resetForm();
          setShowCreateForm(false);
        },
      });
    }
  };

  const handleDelete = () => {
    if (!selectedContactId) return;
    if (window.confirm('Delete this sensor contact?')) {
      deleteContact.mutate(selectedContactId, {
        onSuccess: () => {
          setSelectedContactId(null);
          resetForm();
        },
      });
    }
  };

  const handleToggleVisibility = (contact: SensorContactWithDossier) => {
    if (contact.visible) {
      hideContact.mutate(contact.id);
    } else {
      revealContact.mutate(contact.id);
    }
  };

  const resetForm = () => {
    setFormData({
      ship_id: DEFAULT_SHIP_ID,
      label: '',
      threat_level: 'unknown',
      confidence: 50,
      bearing_deg: 0,
      range_km: 1000,
      visible: false,
    });
  };

  const handleCancel = () => {
    setSelectedContactId(null);
    setShowCreateForm(false);
    setPlacingMode(false);
    resetForm();
  };

  const startPlacing = () => {
    setPlacingMode(true);
    setSelectedContactId(null);
    setShowCreateForm(false);
    resetForm();
  };

  if (isLoading) {
    return <div className="loading">Loading sensor contacts...</div>;
  }

  return (
    <div className="admin-radar">
      <div className="admin-header">
        <h2 className="admin-page-title">Radar / Sensor Contacts</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (showCreateForm || placingMode) {
              handleCancel();
            } else {
              startPlacing();
            }
          }}
        >
          {showCreateForm || placingMode ? 'Cancel' : '+ Place Contact'}
        </button>
      </div>

      <div className="radar-editor">
        {/* Contact List Panel */}
        <div className="radar-contact-list-panel">
          <h3>Contacts ({contacts?.length || 0})</h3>
          <div className="radar-contact-list">
            {contacts?.length === 0 && (
              <p className="empty-hint">No contacts yet. Click "Place Contact" to add one.</p>
            )}
            {contacts?.map((contact) => (
              <div
                key={contact.id}
                className={`radar-contact-item ${selectedContactId === contact.id ? 'selected' : ''} ${!contact.visible ? 'hidden' : ''}`}
                onClick={() => {
                  setSelectedContactId(contact.id);
                  setShowCreateForm(false);
                  setPlacingMode(false);
                }}
              >
                <div className={`radar-contact-threat threat-${contact.threat_level}`} />
                <div className="radar-contact-info">
                  <div className="radar-contact-label">{contact.label}</div>
                  <div className="radar-contact-range">
                    {contact.bearing_deg?.toFixed(0)}° • {contact.range_km ? formatRange(contact.range_km) : '?'}
                  </div>
                </div>
                <div className="radar-contact-actions">
                  <button
                    className={`btn-icon ${contact.visible ? 'visible' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(contact);
                    }}
                    title={contact.visible ? 'Hide from players' : 'Reveal to players'}
                  >
                    {contact.visible ? '👁' : '🚫'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Radar Canvas Panel */}
        <div className="radar-canvas-panel">
          <div className="radar-canvas-header">
            <h3>Radar Plot</h3>
            <div className="radar-canvas-controls">
              <select
                className="radar-scale-select"
                value={currentScaleIndex}
                onChange={(e) => setCurrentScaleIndex(Number(e.target.value))}
              >
                {DEFAULT_RANGE_SCALES.map((scale, idx) => (
                  <option key={scale} value={idx}>
                    {formatRange(scale)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="radar-canvas-body">
            <RadarCanvas
              contacts={contacts ?? []}
              currentScale={currentScale}
              selectedContactId={selectedContactId}
              placingMode={placingMode}
              onContactClick={(id) => {
                setSelectedContactId(id);
                setShowCreateForm(false);
                setPlacingMode(false);
              }}
              onCanvasClick={handleCanvasClick}
              onDragUpdate={(id, bearingDeg, rangeKm) => {
                updateContact.mutate({
                  id,
                  data: {
                    bearing_deg: Math.round(bearingDeg * 10) / 10,
                    range_km: Math.round(rangeKm),
                  },
                });
              }}
            />
          </div>
        </div>

        {/* Editor Panel */}
        <div className="radar-editor-panel">
          <h3>{selectedContactId ? 'Edit Contact' : 'New Contact'}</h3>
          <div className="radar-editor-content">
            {!selectedContactId && !showCreateForm && !placingMode && (
              <div className="radar-editor-empty">
                Select a contact to edit, or click "Place Contact" to add a new one.
              </div>
            )}

            {placingMode && !showCreateForm && (
              <div className="place-mode-active">
                Click on the radar plot to place a new contact
              </div>
            )}

            {(selectedContactId || showCreateForm) && (
              <ContactForm
                formData={formData}
                setFormData={setFormData}
                dossiers={dossiers ?? []}
                isEditing={!!selectedContactId}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                onDelete={handleDelete}
                isPending={createContact.isPending || updateContact.isPending}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Radar Canvas Component
interface RadarCanvasProps {
  contacts: SensorContactWithDossier[];
  currentScale: number;
  selectedContactId: string | null;
  placingMode: boolean;
  onContactClick: (id: string) => void;
  onCanvasClick: (bearingDeg: number, rangeKm: number) => void;
  onDragUpdate: (id: string, bearingDeg: number, rangeKm: number) => void;
}

function RadarCanvas({
  contacts,
  currentScale,
  selectedContactId,
  placingMode,
  onContactClick,
  onCanvasClick,
  onDragUpdate,
}: RadarCanvasProps) {
  const size = 400;
  const radius = (size / 2) - 30;
  const centerX = size / 2;
  const centerY = size / 2;

  const rangeScale = useMemo(
    () => scaleLinear({ domain: [0, currentScale], range: [0, radius] }),
    [currentScale, radius]
  );

  const ringDistances = [0.25, 0.5, 0.75, 1].map((f) => f * currentScale);

  const polarToCartesian = useCallback((bearingDeg: number, rangeKm: number): [number, number] => {
    // pointRadial internally subtracts π/2 (90°) to convert from "0 = up" to standard math angles
    // So we just pass bearing in radians directly - pointRadial handles the offset
    const angleRad = (bearingDeg * Math.PI) / 180;
    const [x, y] = pointRadial(angleRad, rangeScale(rangeKm));
    return [x, y];
  }, [rangeScale]);

  // Drag state for contact repositioning
  const [dragState, setDragState] = useState<{
    contactId: string;
    currentBearing: number;
    currentRange: number;
  } | null>(null);

  // Convert SVG point to polar coordinates (bearing/range)
  const pointToPolar = useCallback((svgX: number, svgY: number): { bearing: number; range: number } => {
    // svgX, svgY are in SVG coordinate space relative to viewBox
    const dx = svgX - centerX;
    const dy = svgY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const rangeKm = rangeScale.invert(distance);

    // Convert to bearing: atan2 gives angle where 0 = right (east), positive = down (clockwise in SVG)
    // We want 0 = up (north), so we need to adjust
    // In SVG: up is -y, right is +x, down is +y, left is -x
    // atan2(dy, dx): right=0, down=90, left=180/-180, up=-90
    // To get bearing (north=0, east=90, south=180, west=270):
    // bearing = atan2(dx, -dy) converted to degrees
    let bearingDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (bearingDeg < 0) bearingDeg += 360;

    return {
      bearing: bearingDeg,
      range: Math.min(rangeKm, currentScale),
    };
  }, [rangeScale, currentScale, centerX, centerY]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!placingMode || dragState) return;

    // Use localPoint for proper SVG coordinate conversion
    const point = localPoint(e);
    if (!point) return;

    const { bearing, range } = pointToPolar(point.x, point.y);
    onCanvasClick(bearing, range);
  };

  // Handle drag start on a blip
  const handleBlipMouseDown = (e: React.MouseEvent, contact: SensorContactWithDossier) => {
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      contactId: contact.id,
      currentBearing: contact.bearing_deg ?? 0,
      currentRange: contact.range_km ?? 0,
    });
  };

  // Handle drag movement
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState) return;

    const point = localPoint(e);
    if (!point) return;

    const { bearing, range } = pointToPolar(point.x, point.y);
    setDragState({
      ...dragState,
      currentBearing: bearing,
      currentRange: range,
    });
  };

  // Handle drag end
  const handleMouseUp = () => {
    if (dragState) {
      onDragUpdate(dragState.contactId, dragState.currentBearing, dragState.currentRange);
      setDragState(null);
    }
  };

  // Handle mouse leave to cancel drag
  const handleMouseLeave = () => {
    if (dragState) {
      setDragState(null);
    }
  };

  return (
    <svg
      className={`radar-canvas-scope ${placingMode ? 'placing' : ''}${dragState ? ' dragging' : ''}`}
      viewBox={`0 0 ${size} ${size}`}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <Group left={centerX} top={centerY}>
        {/* Grid rings */}
        {ringDistances.map((distance, i) => (
          <Circle
            key={`ring-${i}`}
            cx={0}
            cy={0}
            r={rangeScale(distance)}
            className="radar-grid-ring"
          />
        ))}

        {/* Cross lines */}
        {[0, 45, 90, 135].map((angle) => {
          const [x1, y1] = polarToCartesian(angle, currentScale);
          const [x2, y2] = polarToCartesian(angle + 180, currentScale);
          return (
            <Line
              key={`line-${angle}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="radar-grid-line"
            />
          );
        })}

        {/* Bearing labels */}
        {BEARING_LABELS.map(({ angle, label }) => {
          const labelRadius = radius + 15;
          const [x, y] = polarToCartesian(angle, currentScale * (labelRadius / radius));
          return (
            <text
              key={`label-${angle}`}
              x={x}
              y={y}
              dy="0.35em"
              className="radar-bearing-label"
            >
              {label}
            </text>
          );
        })}

        {/* Range labels */}
        {ringDistances.slice(0, -1).map((distance, i) => (
          <text
            key={`range-${i}`}
            x={4}
            y={-rangeScale(distance) - 2}
            className="radar-range-label"
          >
            {formatRange(distance)}
          </text>
        ))}

        {/* Center marker */}
        <Circle
          cx={0}
          cy={0}
          r={4}
          className="radar-center-marker"
        />

        {/* Contact blips */}
        {contacts.map((contact) => {
          if (contact.bearing_deg === undefined || contact.range_km === undefined) {
            return null;
          }

          // Check if this contact is being dragged
          const isDragging = dragState?.contactId === contact.id;

          // Use drag position if dragging, otherwise use contact position
          const displayBearing = isDragging ? dragState.currentBearing : contact.bearing_deg;
          const displayRange = isDragging ? dragState.currentRange : contact.range_km;

          // Skip contacts outside current scale (but not if being dragged)
          if (!isDragging && displayRange > currentScale) return null;

          const [x, y] = polarToCartesian(displayBearing, Math.min(displayRange, currentScale));
          const isSelected = contact.id === selectedContactId;

          return (
            <g
              key={contact.id}
              className={`radar-blip threat-${contact.threat_level}${isSelected ? ' selected' : ''}${!contact.visible ? ' hidden-contact' : ''}${isDragging ? ' dragging' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDragging) {
                  onContactClick(contact.id);
                }
              }}
              onMouseDown={(e) => handleBlipMouseDown(e, contact)}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 14 : 10}
                className="radar-blip-ring"
              />
              <BlipMarker x={x} y={y} threatLevel={contact.threat_level} />
              <text
                x={x}
                y={y + 18}
                className="radar-blip-label"
                textAnchor="middle"
              >
                {contact.label}
              </text>
            </g>
          );
        })}

        {/* Off-screen contact indicators (dots at edge) */}
        {contacts
          .filter(
            (c) =>
              c.bearing_deg !== undefined &&
              c.range_km !== undefined &&
              c.range_km > currentScale &&
              dragState?.contactId !== c.id
          )
          .map((contact) => {
            // Position dot at edge of radar at the same bearing as the contact
            const [x, y] = polarToCartesian(contact.bearing_deg!, currentScale * 0.95);

            // Calculate how many scale steps away the contact is
            // Size decreases for contacts further away
            const scalesAway = Math.ceil(contact.range_km! / currentScale);
            const dotRadius = scalesAway <= 1 ? 4 : scalesAway === 2 ? 3 : 2;
            const isSelected = contact.id === selectedContactId;

            return (
              <circle
                key={`offscreen-${contact.id}`}
                cx={x}
                cy={y}
                r={isSelected ? dotRadius + 2 : dotRadius}
                className={`radar-edge-dot threat-${contact.threat_level}${!contact.visible ? ' hidden-contact' : ''}${isSelected ? ' selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onContactClick(contact.id);
                }}
              />
            );
          })}
      </Group>
    </svg>
  );
}

// Blip marker shape based on threat level
function BlipMarker({ x, y, threatLevel }: { x: number; y: number; threatLevel: ThreatLevel }) {
  switch (threatLevel) {
    case 'hostile':
      // Diamond shape
      return (
        <polygon
          points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`}
          className="radar-blip-marker"
        />
      );
    case 'suspicious':
      // Triangle pointing up
      return (
        <polygon
          points={`${x},${y - 5} ${x + 5},${y + 4} ${x - 5},${y + 4}`}
          className="radar-blip-marker"
        />
      );
    case 'friendly':
      // Circle
      return <Circle cx={x} cy={y} r={4} className="radar-blip-marker" />;
    case 'neutral':
      // Square
      return <rect x={x - 4} y={y - 4} width={8} height={8} className="radar-blip-marker" />;
    case 'unknown':
    default:
      // Inverted triangle
      return (
        <polygon
          points={`${x - 5},${y - 4} ${x + 5},${y - 4} ${x},${y + 5}`}
          className="radar-blip-marker"
        />
      );
  }
}

// Contact Form Component
interface ContactFormProps {
  formData: SensorContactCreate & { id?: string };
  setFormData: React.Dispatch<React.SetStateAction<SensorContactCreate & { id?: string }>>;
  dossiers: Contact[];
  isEditing: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isPending: boolean;
}

function ContactForm({
  formData,
  setFormData,
  dossiers,
  isEditing,
  onSubmit,
  onCancel,
  onDelete,
  isPending,
}: ContactFormProps) {
  return (
    <>
      <div className="radar-form-field">
        <label>Label</label>
        <input
          type="text"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="Contact designation"
        />
      </div>

      <div className="radar-form-field">
        <label>Threat Level</label>
        <select
          value={formData.threat_level}
          onChange={(e) => setFormData({ ...formData, threat_level: e.target.value as ThreatLevel })}
        >
          {THREAT_LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="radar-form-row">
        <div className="radar-form-field">
          <label>Bearing (°)</label>
          <input
            type="number"
            min={0}
            max={359.9}
            step={0.1}
            value={formData.bearing_deg ?? 0}
            onChange={(e) => setFormData({ ...formData, bearing_deg: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div className="radar-form-field">
          <label>Range (km)</label>
          <input
            type="number"
            min={0}
            step={100}
            value={formData.range_km ?? 0}
            onChange={(e) => setFormData({ ...formData, range_km: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="radar-form-row">
        <div className="radar-form-field">
          <label>Confidence (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={formData.confidence ?? 50}
            onChange={(e) => setFormData({ ...formData, confidence: parseInt(e.target.value) || 50 })}
          />
        </div>

        <div className="radar-form-field">
          <label>Signal (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={formData.signal_strength ?? ''}
            onChange={(e) => setFormData({ ...formData, signal_strength: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="radar-form-field">
        <label>Vector</label>
        <input
          type="text"
          value={formData.vector ?? ''}
          onChange={(e) => setFormData({ ...formData, vector: e.target.value || undefined })}
          placeholder="e.g., 045° @ 500 km/s"
        />
      </div>

      <div className="radar-form-field">
        <label>Link to Dossier</label>
        <select
          value={formData.contact_id ?? ''}
          onChange={(e) => setFormData({ ...formData, contact_id: e.target.value || undefined })}
        >
          <option value="">None</option>
          {dossiers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="radar-form-field">
        <label>Notes</label>
        <textarea
          value={formData.notes ?? ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value || undefined })}
          placeholder="Additional observations..."
        />
      </div>

      <div className="radar-form-field">
        <label
          className={`radar-visibility-toggle ${formData.visible ? 'visible' : ''}`}
          onClick={() => setFormData({ ...formData, visible: !formData.visible })}
        >
          <input
            type="checkbox"
            checked={formData.visible ?? false}
            onChange={(e) => setFormData({ ...formData, visible: e.target.checked })}
          />
          <span>{formData.visible ? 'Visible to players' : 'Hidden from players'}</span>
        </label>
      </div>

      <div className="radar-form-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
        {isEditing && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={onDelete}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={isPending}
        >
          {isPending ? 'Saving...' : (isEditing ? 'Save' : 'Create')}
        </button>
      </div>
    </>
  );
}
