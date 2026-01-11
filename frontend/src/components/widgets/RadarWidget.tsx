import { useState, useMemo, useCallback, useEffect } from 'react';
import { Group } from '@visx/group';
import { Circle, Line } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { pointRadial } from 'd3-shape';
import { useSensorContactsWithDossiers } from '../../hooks/useShipData';
import { useUpdateSensorContact } from '../../hooks/useMutations';
import type { WidgetRendererProps, SensorContactWithDossier, ThreatLevel } from '../../types';
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

// ThreatLevel severity order (from most severe to least)
// Alerts will trigger for the selected level AND more severe levels
const THREAT_SEVERITY: ThreatLevel[] = ['hostile', 'suspicious', 'unknown', 'neutral', 'friendly'];

// Get index of threat level (lower = more severe)
function getThreatSeverityIndex(threat: ThreatLevel): number {
  const idx = THREAT_SEVERITY.indexOf(threat);
  return idx === -1 ? THREAT_SEVERITY.length : idx;
}

// Format range for display
// Uses K/M suffixes for large values (implicitly km), shows "km" only for small values
function formatRange(km: number): string {
  if (km >= 1000000) {
    return `${(km / 1000000).toFixed(1)}M`;
  }
  if (km >= 1000) {
    return `${(km / 1000).toFixed(0)}K`;
  }
  return `${km.toFixed(0)} km`;
}

// Get threat level color (matches contact status colors)
function getThreatColor(threat: ThreatLevel): string {
  switch (threat) {
    case 'hostile':
      return 'var(--color-critical)';
    case 'suspicious':
      return 'var(--color-degraded)';
    case 'unknown':
      return 'var(--color-degraded)';
    case 'neutral':
      return 'var(--color-text-muted)';
    case 'friendly':
      return 'var(--color-operational)';
    default:
      return 'var(--color-text-muted)';
  }
}

// Default alert proximity in km (absolute, not relative to scale)
const DEFAULT_ALERT_PROXIMITY_KM = 5000;

interface RadarWidgetConfig {
  range_scales?: number[];
  current_range_scale?: number;
  alert_threshold?: ThreatLevel;  // Alert on this level and more severe
  alert_proximity_km?: number;    // Absolute km threshold
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

  // Alert threshold: triggers on this level AND more severe
  // Default to 'suspicious' (alerts on hostile and suspicious)
  const [alertThreshold, setAlertThreshold] = useState<ThreatLevel>(
    config.alert_threshold ?? 'suspicious'
  );

  // Absolute km proximity threshold (not scale-relative)
  const [alertProximityKm, setAlertProximityKm] = useState<number>(
    config.alert_proximity_km ?? DEFAULT_ALERT_PROXIMITY_KM
  );

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

  // Check for alert conditions and get alerting contacts
  const alertingContacts = useMemo(() => {
    if (!contacts) return [];
    const thresholdIndex = getThreatSeverityIndex(alertThreshold);
    return contacts.filter((c) => {
      if (c.range_km === undefined) return false;
      // Check absolute km proximity (not scale-relative)
      const isInProximity = c.range_km <= alertProximityKm;
      // Check if threat level is at or more severe than threshold
      const threatIndex = getThreatSeverityIndex(c.threat_level);
      const isThreat = threatIndex <= thresholdIndex;
      return isInProximity && isThreat;
    });
  }, [contacts, alertProximityKm, alertThreshold]);

  const hasAlert = alertingContacts.length > 0;

  // Selected contact details
  const selectedContact = useMemo(() => {
    if (!selectedContactId || !contacts) return null;
    return contacts.find((c) => c.id === selectedContactId) ?? null;
  }, [selectedContactId, contacts]);

  // Cycle through range scales
  const cycleScale = useCallback(() => {
    setCurrentScaleIndex((prev) => (prev + 1) % rangeScales.length);
  }, [rangeScales.length]);

  // Handle alert threshold change
  const handleThresholdChange = useCallback((level: ThreatLevel) => {
    setAlertThreshold(level);
  }, []);

  // Handle proximity range change
  const handleProximityChange = useCallback((km: number) => {
    setAlertProximityKm(km);
  }, []);

  // Handle threat level change for a contact
  const handleThreatChange = useCallback((contactId: string, threat_level: ThreatLevel) => {
    updateContact.mutate({ id: contactId, data: { threat_level } });
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
    <div className={`radar-widget${hasAlert ? ' alert-active' : ''}`}>
      {/* Alert banner at top when contacts in proximity */}
      {hasAlert && (
        <div className="radar-alert-banner">
          <span className="radar-alert-icon">⚠</span>
          <span className="radar-alert-text">
            {alertingContacts.length} contact{alertingContacts.length > 1 ? 's' : ''} within {formatRange(alertProximityKm)}
          </span>
        </div>
      )}

      <div className="radar-header">
        <h3 className="radar-title">Radar</h3>
        <div className="radar-controls">
          <button
            type="button"
            className="radar-scale-btn"
            onClick={cycleScale}
            title="Change range scale"
          >
            {formatRange(currentScale)}
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
                <div className="radar-alert-settings-label">Alert threshold:</div>
                <select
                  className="radar-threshold-select"
                  value={alertThreshold}
                  onChange={(e) => handleThresholdChange(e.target.value as ThreatLevel)}
                  title="Alert on this threat level and more severe"
                >
                  {THREAT_SEVERITY.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}+
                    </option>
                  ))}
                </select>
                <div className="radar-alert-settings-label" style={{ marginTop: '8px' }}>
                  Proximity (km):
                </div>
                <input
                  type="number"
                  className="radar-proximity-input"
                  value={alertProximityKm}
                  onChange={(e) => handleProximityChange(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  step={1000}
                  title="Alert when contacts are within this range"
                />
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
              className={`radar-blip threat-${contact.threat_level}${isSelected ? ' selected' : ''}`}
              onClick={() => onContactClick(contact.id)}
            >
              {/* Outer ring for threat indication */}
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 14 : 12}
                className="radar-blip-ring"
                style={{ stroke: getThreatColor(contact.threat_level) }}
              />
              {/* Blip marker */}
              <BlipMarker x={x} y={y} threatLevel={contact.threat_level} />
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
              className={`radar-edge-dot threat-${contact.threat_level}`}
              onClick={() => onContactClick(contact.id)}
            />
          );
        })}
      </Group>
    </svg>
  );
}

// Blip marker shape based on ThreatLevel
interface BlipMarkerProps {
  x: number;
  y: number;
  threatLevel: ThreatLevel;
}

function BlipMarker({ x, y, threatLevel }: BlipMarkerProps) {
  // Different shapes for different threat levels
  switch (threatLevel) {
    case 'hostile':
      // Diamond shape (aggressive/dangerous)
      return (
        <polygon
          points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`}
          className="radar-blip-marker"
        />
      );
    case 'suspicious':
      // Triangle pointing up (caution)
      return (
        <polygon
          points={`${x},${y - 5} ${x + 5},${y + 4} ${x - 5},${y + 4}`}
          className="radar-blip-marker"
        />
      );
    case 'friendly':
      // Circle (safe/ally)
      return (
        <Circle
          cx={x}
          cy={y}
          r={4}
          className="radar-blip-marker"
        />
      );
    case 'neutral':
      // Square (passive/unaligned)
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
      // Question mark shape (inverted triangle)
      return (
        <polygon
          points={`${x - 5},${y - 4} ${x + 5},${y - 4} ${x},${y + 5}`}
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
  onThreatChange: (id: string, threatLevel: ThreatLevel) => void;
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
          <span className="radar-detail-row-label">Threat Level</span>
          {canEdit ? (
            <select
              className="radar-threat-select"
              value={contact.threat_level}
              onChange={(e) => onThreatChange(contact.id, e.target.value as ThreatLevel)}
            >
              <option value="unknown">Unknown</option>
              <option value="friendly">Friendly</option>
              <option value="neutral">Neutral</option>
              <option value="suspicious">Suspicious</option>
              <option value="hostile">Hostile</option>
            </select>
          ) : (
            <span className={`radar-threat-badge threat-${contact.threat_level}`}>
              {contact.threat_level}
            </span>
          )}
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
            {contact.range_km !== undefined ? formatRange(contact.range_km) : 'Unknown'}
          </span>
        </div>

        <div className="radar-detail-row">
          <span className="radar-detail-row-label">Confidence</span>
          <span className="radar-detail-row-value">
            {contact.confidence}%
          </span>
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
