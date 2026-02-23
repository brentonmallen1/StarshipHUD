import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useActiveSectorMap } from '../../hooks/useShipData';
import { useCreateWaypoint, useDeleteWaypoint } from '../../hooks/useMutations';
import { SectorMapHexGrid } from '../SectorMapHexGrid';
import type { SectorMapObject, SectorWaypoint } from '../../types';
import './SectorMapOverlay.css';

// Waypoint color/symbol configuration
const WAYPOINT_COLORS = [
  { color: '#00d4ff', symbol: '◆', name: 'Alpha' },
  { color: '#d4a72c', symbol: '▲', name: 'Bravo' },
  { color: '#3fb950', symbol: '●', name: 'Charlie' },
  { color: '#d946ef', symbol: '■', name: 'Delta' },
] as const;

// Export for use in HexGrid
export function getWaypointSymbol(color: string): string {
  const wp = WAYPOINT_COLORS.find((c) => c.color === color);
  return wp?.symbol ?? '◆';
}

export function SectorMapOverlay() {
  const { data: activeMap, isLoading } = useActiveSectorMap();
  const createWaypoint = useCreateWaypoint();
  const deleteWaypoint = useDeleteWaypoint();

  const [selectedObject, setSelectedObject] = useState<SectorMapObject | null>(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState<SectorWaypoint | null>(null);
  const [activeWaypointColor, setActiveWaypointColor] = useState<string | null>(null);

  // Drawer state (persisted to localStorage)
  const [drawerOpen, setDrawerOpen] = useState(() => {
    const saved = localStorage.getItem('sector-map-drawer-open');
    return saved === 'true'; // default to closed (tab only)
  });
  // Drawer size in pixels (square aspect ratio - width = height)
  const [drawerSize, setDrawerSize] = useState(() => {
    const saved = localStorage.getItem('sector-map-drawer-size');
    return saved ? parseInt(saved, 10) : 450; // pixels, default 450px
  });
  const [drawerOpacity, setDrawerOpacity] = useState(() => {
    const saved = localStorage.getItem('sector-map-drawer-opacity');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [mapKey, setMapKey] = useState(0); // Used to trigger map recenter

  // Resize drag state
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartSizeRef = useRef(450);

  // Persist drawer state changes
  useEffect(() => {
    localStorage.setItem('sector-map-drawer-open', String(drawerOpen));
  }, [drawerOpen]);
  useEffect(() => {
    localStorage.setItem('sector-map-drawer-size', String(drawerSize));
  }, [drawerSize]);
  useEffect(() => {
    localStorage.setItem('sector-map-drawer-opacity', String(drawerOpacity));
  }, [drawerOpacity]);

  // Trigger map recenter when drawer opens
  useEffect(() => {
    if (drawerOpen) {
      setMapKey((k) => k + 1);
    }
  }, [drawerOpen]);

  // Resize handlers (horizontal drag from left edge, maintains square aspect)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartSizeRef.current = drawerSize;

    const handleResizeMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.clientX - resizeStartXRef.current;
      // Dragging left (negative deltaX) increases size
      const newSize = Math.max(300, Math.min(800, resizeStartSizeRef.current - deltaX));
      setDrawerSize(newSize);
    };

    const handleResizeEnd = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      // Trigger map recenter after resize completes
      setMapKey((k) => k + 1);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [drawerSize]);

  // Track which colors are already used by player waypoints
  const usedColors = useMemo(() => {
    if (!activeMap) return new Set<string>();
    return new Set(
      activeMap.waypoints
        .filter((wp) => wp.created_by === 'player')
        .map((wp) => wp.color)
    );
  }, [activeMap]);

  const waypointMode = activeWaypointColor !== null;

  // Collapse drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  const handleObjectClick = useCallback((obj: SectorMapObject) => {
    setSelectedWaypoint(null);
    setSelectedObject((prev) => (prev?.id === obj.id ? null : obj));
  }, []);

  const handleWaypointClick = useCallback((wp: SectorWaypoint) => {
    // Player waypoints can be clicked to remove directly
    if (wp.created_by === 'player') {
      deleteWaypoint.mutate(wp.id);
      setSelectedWaypoint(null);
      return;
    }
    // GM waypoints can be selected for info
    setSelectedObject(null);
    setSelectedWaypoint((prev) => (prev?.id === wp.id ? null : wp));
  }, [deleteWaypoint]);

  const handleHexClick = useCallback((q: number, r: number) => {
    if (!activeMap || !activeWaypointColor) return;

    // Find existing player waypoint with the same color
    const existingWaypoint = activeMap.waypoints.find(
      (wp) => wp.created_by === 'player' && wp.color === activeWaypointColor
    );

    // Delete existing if present, then create new
    if (existingWaypoint) {
      deleteWaypoint.mutate(existingWaypoint.id);
    }

    createWaypoint.mutate({
      mapId: activeMap.id,
      data: { hex_q: q, hex_r: r, color: activeWaypointColor, created_by: 'player' },
    });
    setActiveWaypointColor(null);
  }, [activeMap, activeWaypointColor, createWaypoint, deleteWaypoint]);

  const handleClearAllWaypoints = useCallback(() => {
    if (!activeMap) return;
    const playerWaypoints = activeMap.waypoints.filter((wp) => wp.created_by === 'player');
    playerWaypoints.forEach((wp) => deleteWaypoint.mutate(wp.id));
  }, [activeMap, deleteWaypoint]);

  const isAnomalySelected = selectedObject?.visibility_state === 'anomaly';

  const content = (
    <div
      className={[
        'sector-overlay',
        'sector-overlay--docked',
        !drawerOpen ? 'sector-overlay--collapsed' : '',
      ].filter(Boolean).join(' ')}
      style={drawerOpen ? {
        width: `${drawerSize}px`,
        height: `${drawerSize}px`,
        opacity: drawerOpacity,
      } : undefined}
      role="complementary"
      aria-label="Sector Map"
    >
      {/* Collapsed tab (always visible when drawer closed) */}
      {!drawerOpen && (
        <button
          className={`sector-overlay__tab ${activeMap ? 'sector-overlay__tab--active' : ''}`}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open sector map"
        >
          <span className="sector-overlay__tab-icon">⬡</span>
          <span className="sector-overlay__tab-text">MAP</span>
        </button>
      )}

      {/* Main content (visible when drawer open) */}
      {drawerOpen && (
        <>
          {/* Resize handle */}
          <div
            className="sector-overlay__resize-handle"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          />

          {/* Header */}
          <div className="sector-overlay__header">
            <span className="sector-overlay__title">
              <span className="sector-overlay__hex-icon">⬡</span>
              {activeMap ? activeMap.name : 'SECTOR MAP'}
            </span>
            <div className="sector-overlay__header-controls">
              {activeMap && (
                <>
                  {/* Color waypoint selector */}
                  <div className="sector-overlay__waypoint-colors">
                    {WAYPOINT_COLORS.map((wp) => {
                      const isUsed = usedColors.has(wp.color);
                      const isActive = activeWaypointColor === wp.color;
                      return (
                        <button
                          key={wp.color}
                          className={[
                            'sector-overlay__color-btn',
                            isUsed ? 'sector-overlay__color-btn--used' : '',
                            isActive ? 'sector-overlay__color-btn--active' : '',
                          ].filter(Boolean).join(' ')}
                          style={{ '--wp-color': wp.color } as React.CSSProperties}
                          onClick={() => {
                            setActiveWaypointColor((prev) => (prev === wp.color ? null : wp.color));
                            setSelectedObject(null);
                            setSelectedWaypoint(null);
                          }}
                          title={`Place ${wp.name} waypoint`}
                        >
                          <span className="sector-overlay__color-symbol">{wp.symbol}</span>
                        </button>
                      );
                    })}
                  </div>
                  {usedColors.size > 0 && (
                    <button
                      className="sector-overlay__clear-btn"
                      onClick={handleClearAllWaypoints}
                      title="Clear all player waypoints"
                    >
                      Clear
                    </button>
                  )}
                </>
              )}
              {/* Opacity slider */}
              <div className="sector-overlay__opacity-control" title="Adjust opacity">
                <span className="sector-overlay__opacity-icon">◐</span>
                <input
                  type="range"
                  className="sector-overlay__opacity-slider"
                  min={0.6}
                  max={1}
                  step={0.05}
                  value={drawerOpacity}
                  onChange={(e) => setDrawerOpacity(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Left-edge collapse tab */}
          <button
            className="sector-overlay__collapse-tab"
            onClick={() => setDrawerOpen(false)}
            aria-label="Collapse drawer"
          >
            <span className="sector-overlay__collapse-tab-icon">›</span>
          </button>

          {/* Content */}
          <div className="sector-overlay__body" onClick={() => { setSelectedObject(null); setSelectedWaypoint(null); }}>
            {isLoading ? (
              <div className="sector-overlay__status">SCANNING SECTOR…</div>
            ) : !activeMap ? (
              <div className="sector-overlay__status sector-overlay__status--offline">
                <span className="sector-overlay__hex-icon sector-overlay__hex-icon--large">⬡</span>
                <p>NO ACTIVE SECTOR MAP</p>
                <p className="sector-overlay__status-sub">Contact the GM to activate a map</p>
              </div>
            ) : (
              <div
                className="sector-overlay__grid-wrap"
                onClick={(e) => e.stopPropagation()}
              >
                <SectorMapHexGrid
                  key={`${activeMap.id}-${mapKey}`}
                  map={activeMap}
                  objects={activeMap.objects}
                  sprites={activeMap.sprites}
                  waypoints={activeMap.waypoints}
                  gmView={false}
                  onObjectClick={handleObjectClick}
                  onWaypointClick={handleWaypointClick}
                  onHexClick={waypointMode ? handleHexClick : undefined}
                  interaction={{
                    mode: waypointMode ? 'waypoint' : 'view',
                    selectedObjectId: selectedObject?.id,
                  }}
                />
              </div>
            )}
          </div>

          {/* Object info card */}
          {selectedObject && (
            <div className="sector-overlay__info-card" onClick={(e) => e.stopPropagation()}>
              {isAnomalySelected ? (
                <>
                  <div className="sector-overlay__info-name sector-overlay__info-name--anomaly">
                    ANOMALY DETECTED
                  </div>
                  <p className="sector-overlay__info-desc">
                    Unidentified contact. Classification pending sensor analysis.
                  </p>
                </>
              ) : (
                <>
                  {selectedObject.label && (
                    <div className="sector-overlay__info-name">{selectedObject.label}</div>
                  )}
                  {selectedObject.description ? (
                    <p className="sector-overlay__info-desc">{selectedObject.description}</p>
                  ) : (
                    <p className="sector-overlay__info-desc sector-overlay__info-desc--empty">
                      No additional data available.
                    </p>
                  )}
                </>
              )}
              <button
                className="sector-overlay__info-close"
                onClick={() => setSelectedObject(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Waypoint info card */}
          {selectedWaypoint && (
            <div className="sector-overlay__info-card" onClick={(e) => e.stopPropagation()}>
              <div className="sector-overlay__info-name" style={{ color: selectedWaypoint.color }}>
                {selectedWaypoint.label || `WAYPOINT ${selectedWaypoint.hex_q}, ${selectedWaypoint.hex_r}`}
              </div>
              <p className="sector-overlay__info-desc sector-overlay__info-desc--empty">
                Coord: {selectedWaypoint.hex_q}, {selectedWaypoint.hex_r}
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                {selectedWaypoint.created_by === 'player' && (
                  <button
                    className="sector-overlay__info-close"
                    style={{ color: 'var(--color-critical, #f85149)', borderColor: 'rgba(248,81,73,0.3)' }}
                    onClick={() => { deleteWaypoint.mutate(selectedWaypoint.id); setSelectedWaypoint(null); }}
                  >
                    Remove
                  </button>
                )}
                <button
                  className="sector-overlay__info-close"
                  onClick={() => setSelectedWaypoint(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Scan line decoration */}
          <div className="sector-overlay__scanlines" aria-hidden="true" />
        </>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
