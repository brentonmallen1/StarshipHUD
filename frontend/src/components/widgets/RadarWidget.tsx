import { useState, useMemo, useCallback, useEffect } from 'react';
import { Group } from '@visx/group';
import { Circle, Line } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { pointRadial } from 'd3-shape';
import { useSensorContactsWithDossiers } from '../../hooks/useShipData';
import { useUpdateSensorContact } from '../../hooks/useMutations';
import type { WidgetRendererProps, SensorContactWithDossier, RadarThreatLevel, IFF } from '../../types';
import './RadarWidget.css';

// Default range scales in km
const DEFAULT_RANGE_SCALES = [1000, 10000, 100000, 1000000];

// Bearing labels (degrees, 0° at top)
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
function formatRange(km: number): string {
  if (km >= 1000000) return `${(km / 1000000).toFixed(1)}M`;
  if (km >= 1000) return `${(km / 1000).toFixed(0)}K`;
  return `${km.toFixed(0)}`;
}

// Get threat level color
function getThreatColor(threat: RadarThreatLevel): string {
  switch (threat) {
    case 'critical':
      return 'var(--color-critical)';
    case 'high':
      return 'var(--color-compromised)';
    case 'moderate':
      return 'var(--color-degraded)';
    case 'low':
      return 'var(--color-operational)';
    default:
      return 'var(--color-text-muted)';
  }
}

interface RadarWidgetConfig {
  range_scales?: number[];
  current_range_scale?: number;
  alert_threat_levels?: RadarThreatLevel[];
  alert_proximity_km?: number;
  show_sweep?: boolean;
}

export function RadarWidget({ instance, isEditing, canEditData }: WidgetRendererProps) {
  const config = instance.config as RadarWidgetConfig;

  const rangeScales = config.range_scales ?? DEFAULT_RANGE_SCALES;
  const [currentScaleIndex, setCurrentScaleIndex] = useState(() => {
    const savedScale = config.current_range_scale;
    if (savedScale) {
      const idx = rangeScales.indexOf(savedScale);
      if (idx !== -1) return idx;
    }
    return 0;
  });
  const currentScale = rangeScales[currentScaleIndex];

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [alertThreatLevels, setAlertThreatLevels] = useState<Set<RadarThreatLevel>>(
    new Set(config.alert_threat_levels ?? ['critical', 'high', 'moderate'])
  );
  const alertProximityKm = config.alert_proximity_km ?? currentScale * 0.5;

  const { data: contacts, isLoading, error } = useSensorContactsWithDossiers();
  const updateContact = useUpdateSensorContact();

  // Filter contacts within range
  const visibleContacts = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter((c) =>
      c.bearing_deg !== undefined &&
      c.range_km !== undefined &&
      c.range_km <= currentScale
    );
  }, [contacts, currentScale]);

  // Check for alert conditions
  const hasAlert = useMemo(() => {
    if (!contacts) return false;
    return contacts.some((c) => {
      if (c.range_km === undefined) return false;
      const isInProximity = c.range_km <= alertProximityKm;
      const isThreat = alertThreatLevels.has(c.threat) ||
                       (c.iff === 'hostile' && alertThreatLevels.has('high')) ||
                       (c.iff === 'unknown' && alertThreatLevels.has('moderate'));
      return isInProximity && isThreat;
    });
  }, [contacts, alertProximityKm, alertThreatLevels]);

  // Selected contact details
  const selectedContact = useMemo(() => {
    if (!selectedContactId || !contacts) return null;
    return contacts.find((c) => c.id === selectedContactId) ?? null;
  }, [selectedContactId, contacts]);

  // Cycle through range scales
  const cycleScale = useCallback(() => {
    setCurrentScaleIndex((prev) => (prev + 1) % rangeScales.length);
  }, [rangeScales.length]);

  // Toggle alert threat level
  const toggleAlertLevel = useCallback((level: RadarThreatLevel) => {
    setAlertThreatLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  // Handle threat level change
  const handleThreatChange = useCallback((contactId: string, threat: RadarThreatLevel) => {
    updateContact.mutate({ id: contactId, data: { threat } });
  }, [updateContact]);

  // Clear selection when contact is removed
  useEffect(() => {
    if (selectedContactId && contacts && !contacts.find((c) => c.id === selectedContactId)) {
      setSelectedContactId(null);
    }
  }, [contacts, selectedContactId]);

  if (isEditing) {
    return (
      <div className="radar-widget editing">
        <div className="radar-header">
          <h3 className="radar-title">Radar</h3>
        </div>
        <div className="radar-scope-container">
          <RadarScope
            width={200}
            height={200}
            currentScale={10000}
            contacts={[]}
            allContacts={[]}
            selectedContactId={null}
            onContactClick={() => {}}
            showSweep={false}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="radar-widget">
        <div className="radar-header">
          <h3 className="radar-title">Radar</h3>
        </div>
        <div className="radar-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="radar-widget">
        <div className="radar-header">
          <h3 className="radar-title">Radar</h3>
        </div>
        <div className="radar-error">Error loading contacts</div>
      </div>
    );
  }

  return (
    <div className="radar-widget">
      <div className="radar-header">
        <h3 className="radar-title">Radar</h3>
        <div className="radar-controls">
          {hasAlert && <div className="radar-alert-indicator" title="Contact in proximity" />}
          <button
            type="button"
            className="radar-scale-btn"
            onClick={cycleScale}
            title="Change range scale"
          >
            {formatRange(currentScale)} km
          </button>
        </div>
      </div>

      <div className="radar-content">
        <div className="radar-scope-container">
          <RadarScope
            width={300}
            height={300}
            currentScale={currentScale}
            contacts={visibleContacts}
            allContacts={contacts ?? []}
            selectedContactId={selectedContactId}
            onContactClick={setSelectedContactId}
            showSweep={config.show_sweep ?? true}
          />
        </div>

        <div className="radar-detail-panel">
          {selectedContact ? (
            <ContactDetail
              contact={selectedContact}
              canEdit={canEditData}
              onClose={() => setSelectedContactId(null)}
              onThreatChange={handleThreatChange}
            />
          ) : (
            <>
              <div className="radar-empty-detail">
                Select a contact to view details
              </div>
              <div className="radar-alert-settings">
                <div className="radar-alert-settings-label">Alert on threats:</div>
                <div className="radar-alert-checkboxes">
                  {(['critical', 'high', 'moderate', 'low'] as RadarThreatLevel[]).map((level) => (
                    <label key={level} className="radar-alert-checkbox">
                      <input
                        type="checkbox"
                        checked={alertThreatLevels.has(level)}
                        onChange={() => toggleAlertLevel(level)}
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Radar scope SVG component
interface RadarScopeProps {
  width: number;
  height: number;
  currentScale: number;
  contacts: SensorContactWithDossier[];
  allContacts: SensorContactWithDossier[]; // For off-screen indicators
  selectedContactId: string | null;
  onContactClick: (id: string) => void;
  showSweep: boolean;
}

function RadarScope({
  width,
  height,
  currentScale,
  contacts,
  allContacts,
  selectedContactId,
  onContactClick,
  showSweep,
}: RadarScopeProps) {
  const size = Math.min(width, height);
  const radius = (size / 2) - 25; // Leave room for labels
  const centerX = size / 2;
  const centerY = size / 2;

  // Scale for converting range to pixel distance
  const rangeScale = useMemo(
    () => scaleLinear({ domain: [0, currentScale], range: [0, radius] }),
    [currentScale, radius]
  );

  // Ring distances (4 concentric rings)
  const ringDistances = [0.25, 0.5, 0.75, 1].map((f) => f * currentScale);

  // Convert polar to cartesian
  const polarToCartesian = useCallback((bearingDeg: number, rangeKm: number): [number, number] => {
    // pointRadial internally subtracts π/2 (90°) to convert from "0 = up" to standard math angles
    // So we just pass bearing in radians directly - pointRadial handles the offset
    const angleRad = (bearingDeg * Math.PI) / 180;
    const [x, y] = pointRadial(angleRad, rangeScale(rangeKm));
    return [x, y];
  }, [rangeScale]);

  // Contacts that are beyond the current scale (off-screen indicators)
  const offScreenContacts = useMemo(() => {
    return allContacts.filter((c) =>
      c.bearing_deg !== undefined &&
      c.range_km !== undefined &&
      c.range_km > currentScale
    );
  }, [allContacts, currentScale]);

  return (
    <svg className="radar-scope" viewBox={`0 0 ${size} ${size}`}>
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
          const labelRadius = radius + 12;
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

        {/* Pulse/ping animation (sonar-like effect) */}
        {showSweep && (
          <>
            <circle
              cx={0}
              cy={0}
              r={radius}
              className="radar-ping"
              style={{ '--radar-radius': radius } as React.CSSProperties}
            />
            <circle
              cx={0}
              cy={0}
              r={radius}
              className="radar-ping radar-ping-delayed"
              style={{ '--radar-radius': radius } as React.CSSProperties}
            />
          </>
        )}

        {/* Center marker (own ship) */}
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

          const [x, y] = polarToCartesian(contact.bearing_deg, contact.range_km);
          const isSelected = contact.id === selectedContactId;

          return (
            <g
              key={contact.id}
              className={`radar-blip iff-${contact.iff}${isSelected ? ' selected' : ''}`}
              onClick={() => onContactClick(contact.id)}
            >
              {/* Outer ring for threat indication */}
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 14 : 12}
                className="radar-blip-ring"
                style={{ stroke: getThreatColor(contact.threat) }}
              />
              {/* Blip marker */}
              <BlipMarker x={x} y={y} iff={contact.iff} />
              {/* Label */}
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
        {offScreenContacts.map((contact) => {
          // Position dot at edge of radar at the same bearing as the contact
          const [x, y] = polarToCartesian(contact.bearing_deg!, currentScale * 0.95);

          // Calculate how many scale steps away the contact is
          // Size decreases for contacts further away
          const scalesAway = Math.ceil(contact.range_km! / currentScale);
          const dotRadius = scalesAway <= 1 ? 4 : scalesAway === 2 ? 3 : 2;

          return (
            <circle
              key={`offscreen-${contact.id}`}
              cx={x}
              cy={y}
              r={dotRadius}
              className={`radar-edge-dot iff-${contact.iff}`}
              onClick={() => onContactClick(contact.id)}
            />
          );
        })}
      </Group>
    </svg>
  );
}

// Blip marker shape based on IFF
interface BlipMarkerProps {
  x: number;
  y: number;
  iff: IFF;
}

function BlipMarker({ x, y, iff }: BlipMarkerProps) {
  // Different shapes for different IFF
  switch (iff) {
    case 'hostile':
      // Diamond shape
      return (
        <polygon
          points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`}
          className="radar-blip-marker"
        />
      );
    case 'friendly':
      // Circle
      return (
        <Circle
          cx={x}
          cy={y}
          r={4}
          className="radar-blip-marker"
        />
      );
    case 'neutral':
      // Square
      return (
        <rect
          x={x - 4}
          y={y - 4}
          width={8}
          height={8}
          className="radar-blip-marker"
        />
      );
    case 'unknown':
    default:
      // Triangle
      return (
        <polygon
          points={`${x},${y - 5} ${x + 5},${y + 4} ${x - 5},${y + 4}`}
          className="radar-blip-marker"
        />
      );
  }
}

// Contact detail panel
interface ContactDetailProps {
  contact: SensorContactWithDossier;
  canEdit: boolean;
  onClose: () => void;
  onThreatChange: (id: string, threat: RadarThreatLevel) => void;
}

function ContactDetail({ contact, canEdit, onClose, onThreatChange }: ContactDetailProps) {
  return (
    <>
      <div className="radar-detail-header">
        <h4 className="radar-detail-label">{contact.label}</h4>
        <button type="button" className="radar-detail-close" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className="radar-detail-content">
        <div className="radar-detail-row">
          <span className="radar-detail-row-label">IFF</span>
          <span className={`radar-iff-badge iff-${contact.iff}`}>
            {contact.iff}
          </span>
        </div>

        <div className="radar-detail-row">
          <span className="radar-detail-row-label">Bearing</span>
          <span className="radar-detail-row-value">
            {contact.bearing_deg?.toFixed(1)}°
          </span>
        </div>

        <div className="radar-detail-row">
          <span className="radar-detail-row-label">Range</span>
          <span className="radar-detail-row-value">
            {contact.range_km !== undefined ? `${formatRange(contact.range_km)} km` : 'Unknown'}
          </span>
        </div>

        <div className="radar-detail-row">
          <span className="radar-detail-row-label">Confidence</span>
          <span className="radar-detail-row-value">
            {contact.confidence}%
          </span>
        </div>

        <div className="radar-detail-row">
          <span className="radar-detail-row-label">Threat Level</span>
          {canEdit ? (
            <select
              className="radar-threat-select"
              value={contact.threat}
              onChange={(e) => onThreatChange(contact.id, e.target.value as RadarThreatLevel)}
            >
              <option value="unknown">Unknown</option>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          ) : (
            <span className="radar-detail-row-value" style={{ color: getThreatColor(contact.threat) }}>
              {contact.threat}
            </span>
          )}
        </div>

        {contact.signal_strength !== undefined && (
          <div className="radar-detail-row">
            <span className="radar-detail-row-label">Signal</span>
            <span className="radar-detail-row-value">
              {contact.signal_strength}%
            </span>
          </div>
        )}

        {contact.vector && (
          <div className="radar-detail-row">
            <span className="radar-detail-row-label">Vector</span>
            <span className="radar-detail-row-value">
              {contact.vector}
            </span>
          </div>
        )}

        {contact.notes && (
          <div className="radar-detail-row">
            <span className="radar-detail-row-label">Notes</span>
            <span className="radar-detail-row-value">
              {contact.notes}
            </span>
          </div>
        )}

        {contact.dossier && (
          <a
            href={`#/contacts/${contact.dossier.id}`}
            className="radar-dossier-link"
          >
            View Dossier: {contact.dossier.name}
          </a>
        )}
      </div>
    </>
  );
}
