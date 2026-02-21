import { useState, useMemo, useEffect } from 'react';
import { useHolomapLayers, useHolomapLayer } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { PlaceholderDeckPlan } from '../shared/PlaceholderDeckPlan';
import type { WidgetRendererProps, HolomapMarker, HolomapLayerWithMarkers, MarkerType, EventSeverity } from '../../types';
import { getConfig } from '../../types';
import type { HolomapConfig } from '../../types';
import './HolomapWidget.css';

// Marker type configuration
const MARKER_CONFIG: Record<MarkerType, { icon: string; label: string; color: string }> = {
  breach: { icon: '◯', label: 'Breach', color: 'var(--color-critical)' },
  fire: { icon: '🔥', label: 'Fire', color: 'var(--color-critical)' },
  hazard: { icon: '⚠', label: 'Hazard', color: 'var(--color-degraded)' },
  crew: { icon: '●', label: 'Crew', color: 'var(--color-accent-cyan)' },
  objective: { icon: '◆', label: 'Objective', color: 'var(--color-accent-cyan)' },
  damage: { icon: '✕', label: 'Damage', color: 'var(--color-compromised)' },
  other: { icon: '○', label: 'Other', color: 'var(--color-text-dim)' },
};

// Severity priority for determining tab color (higher = more severe)
const SEVERITY_PRIORITY: Record<EventSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

interface RadarMarkerProps {
  marker: HolomapMarker;
  onHover?: (marker: HolomapMarker | null) => void;
  onClick?: (marker: HolomapMarker) => void;
}

function RadarMarker({ marker, onHover, onClick }: RadarMarkerProps) {
  const config = MARKER_CONFIG[marker.type];
  const severityClass = marker.severity ? `severity-${marker.severity}` : '';

  return (
    <div
      className={`radar-marker type-${marker.type} ${severityClass}`}
      style={{
        left: `${marker.x * 100}%`,
        top: `${marker.y * 100}%`,
        '--marker-color': config.color,
      } as React.CSSProperties}
      onMouseEnter={() => onHover?.(marker)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(marker)}
    >
      <span className="radar-marker-icon">{config.icon}</span>
    </div>
  );
}

// Modal component for marker details
interface MarkerModalProps {
  marker: HolomapMarker;
  onClose: () => void;
}

function MarkerModal({ marker, onClose }: MarkerModalProps) {
  const config = MARKER_CONFIG[marker.type];

  return (
    <div className="marker-modal-overlay" onClick={onClose}>
      <div className="marker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="marker-modal-content">
          {/* Header */}
          <div className="marker-modal-header">
            <div className="marker-modal-icon" style={{ '--marker-color': config.color } as React.CSSProperties}>
              {config.icon}
            </div>
            <div className="marker-modal-title">
              <span className="marker-modal-type">{config.label}</span>
              {marker.severity && (
                <span className={`marker-modal-severity severity-${marker.severity}`}>
                  {marker.severity}
                </span>
              )}
            </div>
            <button className="marker-modal-close" onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div className="marker-modal-body">
            {marker.label && (
              <div className="marker-modal-field">
                <span className="field-label">Designation</span>
                <span className="field-value">{marker.label}</span>
              </div>
            )}
            {marker.description && (
              <div className="marker-modal-field">
                <span className="field-label">Details</span>
                <span className="field-value description">{marker.description}</span>
              </div>
            )}
            <div className="marker-modal-field">
              <span className="field-label">Position</span>
              <span className="field-value mono">
                X: {(marker.x * 100).toFixed(1)}% / Y: {(marker.y * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="marker-modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Get highest severity from markers
function getHighestSeverity(markers?: HolomapMarker[]): EventSeverity | null {
  if (!markers?.length) return null;

  let highest: EventSeverity | null = null;
  let highestPriority = 0;

  for (const marker of markers) {
    if (marker.severity) {
      const priority = SEVERITY_PRIORITY[marker.severity];
      if (priority > highestPriority) {
        highestPriority = priority;
        highest = marker.severity;
      }
    }
  }

  return highest;
}

// Hook to fetch layer data for player view (filters to visible markers only)
function useLayerData(layerId: string | undefined) {
  const { data } = useHolomapLayer(layerId || '', true); // visibleMarkersOnly=true for player view
  return data;
}

// Tab component with severity pulsation
interface LayerTabProps {
  layer: HolomapLayerWithMarkers;
  isActive: boolean;
  onClick: () => void;
}

function LayerTab({ layer, isActive, onClick }: LayerTabProps) {
  const severity = getHighestSeverity(layer.markers);
  const severityClass = severity ? `tab-severity-${severity}` : '';

  return (
    <button
      className={`holomap-tab ${isActive ? 'active' : ''} ${severityClass}`}
      onClick={onClick}
    >
      <span className="tab-name">{layer.deck_level || layer.name}</span>
      {severity && <span className="tab-indicator" />}
    </button>
  );
}

export function HolomapWidget({ instance, isEditing, onConfigChange }: WidgetRendererProps) {
  const contextShipId = useCurrentShipId();
  const config = getConfig<HolomapConfig>(instance.config);

  // Fetch all available layers
  const { data: allLayers } = useHolomapLayers(contextShipId ?? undefined, true);

  // Get configured layer IDs (support both legacy single and new multi-layer config)
  const configuredLayerIds = useMemo(() => {
    if (config.layer_ids?.length) {
      return config.layer_ids;
    }
    if (config.layer_id) {
      return [config.layer_id];
    }
    // Default: show all visible layers
    return allLayers?.map(l => l.id) || [];
  }, [config.layer_ids, config.layer_id, allLayers]);

  // Filter to only layers that exist
  const displayLayerIds = useMemo(() => {
    if (!allLayers) return [];
    const layerIdSet = new Set(allLayers.map(l => l.id));
    return configuredLayerIds.filter(id => layerIdSet.has(id));
  }, [configuredLayerIds, allLayers]);

  // Track active tab
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Reset tab index if it's out of bounds
  useEffect(() => {
    if (activeTabIndex >= displayLayerIds.length && displayLayerIds.length > 0) {
      setActiveTabIndex(0);
    }
  }, [displayLayerIds.length, activeTabIndex]);

  // Active layer ID
  const activeLayerId = displayLayerIds[activeTabIndex];

  // Fetch active layer data
  const activeLayer = useLayerData(activeLayerId);

  // Fetch all layer data for tabs (for severity calculation) - support up to 6 layers
  const layer0 = useLayerData(displayLayerIds[0]);
  const layer1 = useLayerData(displayLayerIds[1]);
  const layer2 = useLayerData(displayLayerIds[2]);
  const layer3 = useLayerData(displayLayerIds[3]);
  const layer4 = useLayerData(displayLayerIds[4]);
  const layer5 = useLayerData(displayLayerIds[5]);

  const layerDataMap = useMemo(() => {
    const map = new Map<string, HolomapLayerWithMarkers>();
    [layer0, layer1, layer2, layer3, layer4, layer5].forEach(l => {
      if (l) map.set(l.id, l);
    });
    return map;
  }, [layer0, layer1, layer2, layer3, layer4, layer5]);

  // Tooltip state for hover
  const [hoveredMarker, setHoveredMarker] = useState<HolomapMarker | null>(null);

  // Modal state for selected marker
  const [selectedMarker, setSelectedMarker] = useState<HolomapMarker | null>(null);

  // Memoize marker counts for legend
  const markerCounts = useMemo(() => {
    if (!activeLayer?.markers) return {};
    return activeLayer.markers.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [activeLayer?.markers]);

  const showLegend = config.show_legend !== false;

  // Handle layer selection in edit mode
  const handleLayerToggle = (layerId: string, checked: boolean) => {
    const currentIds = config.layer_ids || allLayers?.map(l => l.id) || [];
    let newIds: string[];
    if (checked) {
      newIds = [...currentIds, layerId];
    } else {
      newIds = currentIds.filter(id => id !== layerId);
    }
    onConfigChange?.({ ...config, layer_ids: newIds });
  };

  if (isEditing) {
    const selectedIds = config.layer_ids || allLayers?.map(l => l.id) || [];
    return (
      <div className="holomap-widget editing">
        <div className="widget-title">Holomap</div>
        <div className="editing-hint">
          {allLayers?.length ? `${allLayers.length} layer(s) available` : 'No layers configured'}
        </div>
        <div className="layer-selector">
          <div className="layer-selector-label">Show layers:</div>
          {allLayers?.map((layer) => (
            <label key={layer.id} className="layer-checkbox">
              <input
                type="checkbox"
                checked={selectedIds.includes(layer.id)}
                onChange={(e) => handleLayerToggle(layer.id, e.target.checked)}
              />
              <span>{layer.name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  const showTabs = displayLayerIds.length > 1;

  return (
    <div className="holomap-widget">
      {/* Tab bar for multiple layers */}
      {showTabs && (
        <div className="holomap-tabs">
          {displayLayerIds.map((layerId, index) => {
            const layerData = layerDataMap.get(layerId);
            if (!layerData) return null;
            return (
              <LayerTab
                key={layerId}
                layer={layerData}
                isActive={index === activeTabIndex}
                onClick={() => setActiveTabIndex(index)}
              />
            );
          })}
        </div>
      )}

      {/* Deck plan container */}
      <div className="holomap-canvas">
        {/* Content layer - contains image/placeholder and markers together */}
        {/* Markers are inside this container so they transform with the image */}
        <div
          className="holomap-content-layer"
          style={activeLayer?.image_url && activeLayer.image_url !== 'placeholder' ? {
            transform: `scale(${activeLayer.image_scale ?? 1}) translate(${(activeLayer.image_offset_x ?? 0) * 100}%, ${(activeLayer.image_offset_y ?? 0) * 100}%)`,
          } : undefined}
        >
          {/* Deck plan image or placeholder */}
          {activeLayer?.image_url && activeLayer.image_url !== 'placeholder' ? (
            <img
              src={activeLayer.image_url}
              alt={activeLayer.name}
              className="holomap-image"
            />
          ) : (
            <PlaceholderDeckPlan className="holomap-placeholder-svg" deckLevel={activeLayer?.deck_level} />
          )}

          {/* Markers - inside the content layer so they move with the image */}
          <div className="holomap-markers">
            {activeLayer?.markers?.filter(m => m.visible !== false).map((marker) => (
              <RadarMarker
                key={marker.id}
                marker={marker}
                onHover={setHoveredMarker}
                onClick={setSelectedMarker}
              />
            ))}
          </div>
        </div>

        {/* Marker tooltip on hover - at canvas level for proper positioning */}
        {hoveredMarker && (
          <div
            className="holomap-tooltip"
            style={{
              left: `${Math.min(hoveredMarker.x * 100, 70)}%`,
              top: `${Math.min(hoveredMarker.y * 100 + 5, 80)}%`,
            }}
          >
            <div className="holomap-tooltip-content">
              <span className="tooltip-label">
                {hoveredMarker.label || MARKER_CONFIG[hoveredMarker.type].label}
              </span>
              {hoveredMarker.severity && (
                <span className={`tooltip-severity severity-${hoveredMarker.severity}`}>
                  {hoveredMarker.severity}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Marker detail modal */}
      {selectedMarker && (
        <MarkerModal
          marker={selectedMarker}
          onClose={() => setSelectedMarker(null)}
        />
      )}

      {/* Legend */}
      {showLegend && Object.keys(markerCounts).length > 0 && (
        <div className="holomap-legend">
          {Object.entries(markerCounts).map(([type, count]) => (
            <div key={type} className="legend-item">
              <span
                className="legend-icon"
                style={{ color: MARKER_CONFIG[type as MarkerType].color }}
              >
                {MARKER_CONFIG[type as MarkerType].icon}
              </span>
              <span className="legend-count">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Layer name */}
      {activeLayer && (
        <div className="holomap-layer-name">{activeLayer.name}</div>
      )}

      {/* No data state */}
      {!activeLayer && !allLayers?.length && (
        <div className="holomap-empty">
          <span>No deck plans available</span>
        </div>
      )}
    </div>
  );
}
