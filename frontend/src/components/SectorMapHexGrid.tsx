import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { SectorMap, SectorMapObject, SectorSprite, SectorWaypoint } from '../types';
import { getWaypointSymbol } from './layout/SectorMapOverlay';
import './SectorMapHexGrid.css';

// ---------------------------------------------------------------------------
// Hex math — pointy-top hexes, axial coordinates
// ---------------------------------------------------------------------------

function hexToPixel(q: number, r: number, size: number): [number, number] {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (3 / 2) * r;
  return [x, y];
}

function pixelToHex(px: number, py: number, size: number): [number, number] {
  const q = ((px * Math.sqrt(3)) / 3 - py / 3) / size;
  const r = (py * 2) / 3 / size;
  return hexRound(q, r);
}

function hexRound(q: number, r: number): [number, number] {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  return [rq, rr];
}

/** Returns the 6 corner points of a pointy-top hex centered at (cx, cy). */
function hexCorners(cx: number, cy: number, size: number): string {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

/** Axial distance from origin (0,0). */
function hexDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

// ---------------------------------------------------------------------------
// Grid color presets
// ---------------------------------------------------------------------------

const GRID_COLORS: Record<string, string> = {
  cyan: '#00d4ff',
  black: '#000000',
  grey: '#808080',
  white: '#ffffff',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HexGridInteraction {
  mode: 'view' | 'place' | 'select' | 'waypoint';
  selectedSpriteId?: string;
  selectedObjectId?: string;
}

interface Props {
  map: SectorMap;
  objects: SectorMapObject[];
  sprites: SectorSprite[];
  waypoints?: SectorWaypoint[];
  /** GM view shows hidden objects (ghosted) and lock indicators */
  gmView?: boolean;
  interaction?: HexGridInteraction;
  onHexClick?: (q: number, r: number) => void;
  onObjectClick?: (obj: SectorMapObject) => void;
  onObjectDrop?: (objId: string, q: number, r: number) => void;
  onWaypointClick?: (waypoint: SectorWaypoint) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SectorMapHexGrid({
  map,
  objects,
  sprites,
  waypoints = [],
  gmView = false,
  interaction,
  onHexClick,
  onObjectClick,
  onObjectDrop,
  onWaypointClick,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragTargetHex, setDragTargetHex] = useState<[number, number] | null>(null);
  const [hoveredObject, setHoveredObject] = useState<SectorMapObject | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to avoid stale closures in event handlers
  const isPanningRef = useRef(false);
  const didPanRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);
  const lastFitMapId = useRef('');

  // Drag-to-move refs
  const isDraggingObjectRef = useRef(false);
  const draggingObjectIdRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });

  // ---------------------------------------------------------------------------
  // Container size tracking
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Grid geometry — hexagonal shape centered at (0,0)
  // ---------------------------------------------------------------------------

  const hexSize = map.hex_size ?? 12;
  const gridRadius = map.grid_radius ?? 25;

  // Hexagonal content bounding box
  const contentW = Math.sqrt(3) * hexSize * (2 * gridRadius + 1) + hexSize * 2;
  const contentH = 1.5 * hexSize * (2 * gridRadius + 1) + hexSize * 2;

  // Center of SVG content — (0,0) hex maps to this pixel
  const originX = contentW / 2;
  const originY = contentH / 2;

  // ---------------------------------------------------------------------------
  // Minimum zoom — grid should fill canvas vertically at max zoom-out
  // ---------------------------------------------------------------------------

  const minZoom = containerSize.height > 0 ? containerSize.height / contentH : 0.1;

  // ---------------------------------------------------------------------------
  // Auto-fit on map change — height-based so grid touches top/bottom
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!containerSize.width || !containerSize.height) return;
    if (lastFitMapId.current === map.id) return;

    // Height-based fit: grid top/bottom touch canvas edges
    const fitZoom = containerSize.height / contentH;
    const z = Math.max(minZoom, Math.min(6, fitZoom));
    const newPan = {
      x: (containerSize.width - contentW * z) / 2,
      y: 0, // Grid touches top edge
    };
    setZoom(z);
    setPan(newPan);
    zoomRef.current = z;
    panRef.current = newPan;
    lastFitMapId.current = map.id;
  }, [containerSize.width, containerSize.height, map.id, contentW, contentH, minZoom]);

  // Keep refs in sync with state
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Zoom (shared logic for wheel and slider)
  // ---------------------------------------------------------------------------

  const applyZoom = useCallback((newZoom: number, anchorX?: number, anchorY?: number) => {
    const clamped = Math.max(minZoom, Math.min(6, newZoom));
    const cx = anchorX ?? containerSize.width / 2;
    const cy = anchorY ?? containerSize.height / 2;
    const factor = clamped / zoomRef.current;
    const newPan = {
      x: cx - (cx - panRef.current.x) * factor,
      y: cy - (cy - panRef.current.y) * factor,
    };
    zoomRef.current = clamped;
    panRef.current = newPan;
    setZoom(clamped);
    setPan(newPan);
  }, [containerSize.width, containerSize.height, minZoom]);

  const applyZoomRef = useRef(applyZoom);
  useEffect(() => { applyZoomRef.current = applyZoom; }, [applyZoom]);

  // ---------------------------------------------------------------------------
  // Mouse wheel zoom (non-passive, reduced sensitivity 0.93/1.07)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.93 : 1.07;
      applyZoomRef.current(zoomRef.current * factor, mouseX, mouseY);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---------------------------------------------------------------------------
  // Mouse drag to pan
  // ---------------------------------------------------------------------------

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Don't start pan if dragging an object or if click is on a hex-object
    if (isDraggingObjectRef.current) return;
    if ((e.target as Element).closest('.hex-object')) return;
    e.preventDefault();
    isPanningRef.current = true;
    didPanRef.current = false;
    setIsPanning(true);
    panStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      px: panRef.current.x,
      py: panRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.mx;
    const dy = e.clientY - panStartRef.current.my;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPanRef.current = true;
    const newPan = { x: panStartRef.current.px + dx, y: panStartRef.current.py + dy };
    panRef.current = newPan;
    setPan(newPan);
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  // ---------------------------------------------------------------------------
  // SVG click → hex coordinates
  // ---------------------------------------------------------------------------

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (didPanRef.current) {
        didPanRef.current = false;
        return;
      }
      if (!onHexClick || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const svgY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
      const [q, r] = pixelToHex(svgX - originX, svgY - originY, hexSize);
      if (hexDistance(q, r) <= gridRadius) {
        onHexClick(q, r);
      }
    },
    [onHexClick, originX, originY, hexSize, gridRadius]
  );

  // ---------------------------------------------------------------------------
  // Drag-to-move object handlers
  // ---------------------------------------------------------------------------

  const computeHexFromPointer = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const svgX = (clientX - rect.left - panRef.current.x) / zoomRef.current;
      const svgY = (clientY - rect.top - panRef.current.y) / zoomRef.current;
      const [q, r] = pixelToHex(svgX - originX, svgY - originY, hexSize);
      if (hexDistance(q, r) <= gridRadius) return [q, r];
      return null;
    },
    [originX, originY, hexSize, gridRadius]
  );

  const handleObjectPointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>, obj: SectorMapObject) => {
      if (!gmView || obj.locked) return;
      e.stopPropagation();
      isDraggingObjectRef.current = true;
      draggingObjectIdRef.current = obj.id;
      dragMovedRef.current = false;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [gmView]
  );

  const handleObjectPointerMove = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      if (!isDraggingObjectRef.current) return;
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMovedRef.current = true;
      }
      if (dragMovedRef.current) {
        const hex = computeHexFromPointer(e.clientX, e.clientY);
        setDragTargetHex(hex);
      }
    },
    [computeHexFromPointer]
  );

  const handleObjectPointerUp = useCallback(
    (e: React.PointerEvent<SVGGElement>, obj: SectorMapObject) => {
      if (!isDraggingObjectRef.current) return;
      e.stopPropagation();
      const moved = dragMovedRef.current;
      const targetHex = moved ? computeHexFromPointer(e.clientX, e.clientY) : null;

      isDraggingObjectRef.current = false;
      draggingObjectIdRef.current = null;
      dragMovedRef.current = false;
      setDragTargetHex(null);

      if (moved && targetHex && onObjectDrop) {
        onObjectDrop(obj.id, targetHex[0], targetHex[1]);
      } else if (!moved) {
        onObjectClick?.(obj);
      }
    },
    [computeHexFromPointer, onObjectDrop, onObjectClick]
  );

  // ---------------------------------------------------------------------------
  // Object hover for tooltips
  // ---------------------------------------------------------------------------

  const handleObjectMouseEnter = useCallback(
    (e: React.MouseEvent<SVGGElement>, obj: SectorMapObject) => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8 });
      }
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredObject(obj);
      }, 200);
    },
    []
  );

  const handleObjectMouseMove = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8 });
      }
    },
    []
  );

  const handleObjectMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredObject(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const allCoords = useMemo(() => {
    const coords: [number, number][] = [];
    for (let q = -gridRadius; q <= gridRadius; q++) {
      for (let r = -gridRadius; r <= gridRadius; r++) {
        if (hexDistance(q, r) <= gridRadius) {
          coords.push([q, r]);
        }
      }
    }
    return coords;
  }, [gridRadius]);

  const spriteMap = useMemo(
    () => new Map(sprites.map((s) => [s.id, s])),
    [sprites]
  );

  const visibleObjects = useMemo(() => {
    if (gmView) return objects;
    return objects.filter((o) => o.visibility_state !== 'hidden');
  }, [objects, gmView]);

  const hexPixel = useCallback(
    (q: number, r: number): [number, number] => {
      const [x, y] = hexToPixel(q, r, hexSize);
      return [x + originX, y + originY];
    },
    [hexSize, originX, originY]
  );

  // ---------------------------------------------------------------------------
  // Grid appearance
  // ---------------------------------------------------------------------------

  const gridStroke = GRID_COLORS[map.grid_color] ?? map.grid_color ?? '#00d4ff';
  const gridOpacity = map.grid_opacity ?? 0.15;
  const gridVisible = map.grid_visible ?? true;
  const selectedObjectId = interaction?.selectedObjectId;

  // ---------------------------------------------------------------------------
  // Mini map
  // ---------------------------------------------------------------------------

  const MINI_W = 160;
  const MINI_H = 110;
  const miniScale = Math.min(MINI_W / contentW, MINI_H / contentH);
  const showMiniMap = zoom > 1.5 && containerSize.width > 0;

  // Mini-map click → pan main view to that location
  const handleMiniMapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert mini-map click to content coordinates
    const contentX = clickX / miniScale;
    const contentY = clickY / miniScale;

    // Calculate new pan to center the main view on this point
    const newPan = {
      x: containerSize.width / 2 - contentX * zoom,
      y: containerSize.height / 2 - contentY * zoom,
    };
    panRef.current = newPan;
    setPan(newPan);
  }, [miniScale, zoom, containerSize.width, containerSize.height]);

  const cursorStyle = interaction?.mode === 'place' || interaction?.mode === 'waypoint'
    ? 'crosshair'
    : isPanning ? 'grabbing' : 'grab';

  // Background image transform
  const bgScale = map.bg_scale ?? 1.0;
  const bgRotation = map.bg_rotation ?? 0;
  const bgOffsetX = map.bg_offset_x ?? 0;
  const bgOffsetY = map.bg_offset_y ?? 0;
  const bgOpacity = map.bg_opacity ?? 1.0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={containerRef} className={`sector-hex-grid-container ${className}`}>
      <svg
        ref={svgRef}
        className="sector-hex-grid"
        width="100%"
        height="100%"
        style={{ display: 'block', cursor: cursorStyle, background: map.background_color }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleSvgClick}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Background image — centered on grid origin with GM-configurable transforms */}
          {map.background_image_url && (
            <image
              href={map.background_image_url}
              x={originX - (contentW / 2) * bgScale}
              y={originY - (contentH / 2) * bgScale}
              width={contentW * bgScale}
              height={contentH * bgScale}
              preserveAspectRatio="xMidYMid meet"
              opacity={bgOpacity}
              transform={`rotate(${bgRotation}, ${originX}, ${originY}) translate(${bgOffsetX}, ${bgOffsetY})`}
            />
          )}

          {/* Grid lines — hexagonal shape */}
          {gridVisible && (
            <g className="hex-grid-lines">
              {allCoords.map(([q, r]) => {
                const [cx, cy] = hexPixel(q, r);
                return (
                  <polygon
                    key={`hex-${q}-${r}`}
                    points={hexCorners(cx, cy, hexSize - 0.5)}
                    className="hex-cell"
                    stroke={gridStroke}
                    strokeOpacity={gridOpacity}
                  />
                );
              })}
            </g>
          )}

          {/* Ghost hex target while dragging a sprite */}
          {dragTargetHex && (
            <polygon
              points={hexCorners(...hexPixel(...dragTargetHex), hexSize * 0.85)}
              fill="rgba(0,255,204,0.12)"
              stroke="rgba(0,255,204,0.5)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              pointerEvents="none"
            />
          )}

          {/* Placed objects */}
          <g className="hex-objects">
            {visibleObjects.map((obj) => {
              const [cx, cy] = hexPixel(obj.hex_q, obj.hex_r);
              const sprite = obj.sprite_id ? spriteMap.get(obj.sprite_id) : undefined;
              const renderSize = hexSize * obj.scale;
              const isHidden = obj.visibility_state === 'hidden';
              const isAnomaly = obj.visibility_state === 'anomaly';
              const isSelected = obj.id === selectedObjectId;
              const rotation = obj.rotation ?? 0;
              const isDraggable = gmView && !obj.locked;

              return (
                <g
                  key={obj.id}
                  className={[
                    'hex-object',
                    isHidden ? 'hex-object--hidden' : '',
                    isAnomaly && !gmView ? 'hex-object--anomaly' : '',
                    isAnomaly && gmView ? 'hex-object--anomaly-gm' : '',
                    isSelected ? 'hex-object--selected' : '',
                    isDraggable ? 'hex-object--draggable' : '',
                  ].filter(Boolean).join(' ')}
                  transform={`translate(${cx},${cy}) rotate(${rotation})`}
                  onPointerDown={(e) => handleObjectPointerDown(e, obj)}
                  onPointerMove={handleObjectPointerMove}
                  onPointerUp={(e) => handleObjectPointerUp(e, obj)}
                  onMouseEnter={(e) => handleObjectMouseEnter(e, obj)}
                  onMouseMove={handleObjectMouseMove}
                  onMouseLeave={handleObjectMouseLeave}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDraggable) onObjectClick?.(obj);
                  }}
                >
                  {/* Anomaly marker (player view only) */}
                  {isAnomaly && !gmView ? (
                    <>
                      <circle r={hexSize * 0.35} className="hex-object__anomaly-ring" />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="hex-object__anomaly-icon"
                        fontSize={hexSize * 0.4}
                        transform={`rotate(${-rotation})`}
                      >
                        ?
                      </text>
                    </>
                  ) : sprite ? (
                    <image
                      href={sprite.image_url}
                      x={-renderSize / 2}
                      y={-renderSize / 2}
                      width={renderSize}
                      height={renderSize}
                      className="hex-object__sprite"
                    />
                  ) : (
                    <polygon
                      points={hexCorners(0, 0, hexSize * 0.6)}
                      className="hex-object__fallback"
                    />
                  )}

                  {/* Label — counter-rotate so text stays upright */}
                  {(obj.label || (isAnomaly && !gmView)) && (
                    <text
                      y={renderSize / 2 + 12}
                      className={[
                        'hex-object__label',
                        isAnomaly && !gmView ? 'hex-object__label--anomaly' : '',
                      ].filter(Boolean).join(' ')}
                      textAnchor="middle"
                      transform={`rotate(${-rotation})`}
                    >
                      {isAnomaly && !gmView ? 'ANOMALY' : obj.label}
                    </text>
                  )}

                  {/* GM: subtle lock indicator (small amber rect top-right) */}
                  {gmView && obj.locked && (
                    <rect
                      x={hexSize * 0.22}
                      y={-hexSize * 0.42}
                      width={hexSize * 0.16}
                      height={hexSize * 0.12}
                      rx={1.5}
                      className="hex-object__lock-indicator"
                    />
                  )}

                  {/* GM: anomaly badge (small ? text) */}
                  {gmView && isAnomaly && (
                    <text
                      x={-hexSize * 0.35}
                      y={-hexSize * 0.28}
                      className="hex-object__anomaly-gm-icon"
                      fontSize={hexSize * 0.28}
                    >
                      ?
                    </text>
                  )}

                  {/* Selection ring — counter-rotated */}
                  {isSelected && (
                    <polygon
                      points={hexCorners(0, 0, hexSize * 0.9)}
                      className="hex-object__selection-ring"
                      transform={`rotate(${-rotation})`}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Waypoints */}
          {waypoints.length > 0 && (
            <g className="hex-waypoints">
              {waypoints.map((wp) => {
                const [cx, cy] = hexPixel(wp.hex_q, wp.hex_r);
                const symbol = getWaypointSymbol(wp.color);
                const isPlayerWaypoint = wp.created_by === 'player';
                return (
                  <g
                    key={wp.id}
                    className={`hex-waypoint ${isPlayerWaypoint ? 'hex-waypoint--clickable' : ''}`}
                    transform={`translate(${cx},${cy})`}
                    onClick={(e) => { e.stopPropagation(); onWaypointClick?.(wp); }}
                  >
                    <circle
                      r={hexSize * 0.38}
                      className="hex-waypoint__ring"
                      stroke={wp.color}
                    />
                    <circle r={hexSize * 0.18} fill={wp.color} className="hex-waypoint__dot" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="hex-waypoint__symbol"
                      fill="#050510"
                      fontSize={hexSize * 0.22}
                    >
                      {symbol}
                    </text>
                    {wp.label && (
                      <text
                        y={hexSize * 0.6}
                        textAnchor="middle"
                        className="hex-waypoint__label"
                        fill={wp.color}
                        fontSize={hexSize * 0.35}
                      >
                        {wp.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>

      {/* Zoom slider controls */}
      <div className="sector-zoom-controls">
        <button
          className="sector-zoom-btn"
          onClick={() => applyZoom(zoom * 0.8)}
          aria-label="Zoom out"
        >−</button>
        <input
          type="range"
          className="sector-zoom-slider"
          min={minZoom}
          max={6}
          step={0.01}
          value={zoom}
          onChange={(e) => applyZoom(parseFloat(e.target.value))}
          aria-label="Zoom level"
        />
        <button
          className="sector-zoom-btn"
          onClick={() => applyZoom(zoom * 1.2)}
          aria-label="Zoom in"
        >+</button>
      </div>

      {/* Mini map — shown when zoomed in beyond 1.5×, click to navigate */}
      {showMiniMap && (
        <svg
          className="sector-minimap"
          width={MINI_W}
          height={MINI_H}
          style={{ position: 'absolute', bottom: 44, left: 8, cursor: 'pointer' }}
          onClick={handleMiniMapClick}
        >
          <rect width={MINI_W} height={MINI_H} fill={map.background_color} rx={4} />

          {allCoords.map(([q, r]) => {
            const [cx, cy] = hexPixel(q, r);
            return (
              <circle
                key={`m-${q}-${r}`}
                cx={cx * miniScale}
                cy={cy * miniScale}
                r={Math.max(0.3, hexSize * miniScale * 0.2)}
                fill="none"
                stroke={gridStroke}
                strokeOpacity={Math.min(1, gridOpacity * 2.5)}
                strokeWidth={0.4}
              />
            );
          })}

          {visibleObjects.map((obj) => {
            const [cx, cy] = hexPixel(obj.hex_q, obj.hex_r);
            return (
              <circle
                key={obj.id}
                cx={cx * miniScale}
                cy={cy * miniScale}
                r={Math.max(1.5, hexSize * miniScale * 0.5)}
                fill={obj.visibility_state === 'anomaly' ? '#d4a72c' : '#00d4ff'}
                opacity={obj.visibility_state === 'hidden' ? 0.3 : 0.85}
              />
            );
          })}

          {waypoints.map((wp) => {
            const [cx, cy] = hexPixel(wp.hex_q, wp.hex_r);
            return (
              <circle
                key={wp.id}
                cx={cx * miniScale}
                cy={cy * miniScale}
                r={Math.max(2, hexSize * miniScale * 0.6)}
                fill={wp.color}
                opacity={0.8}
              />
            );
          })}

          {containerSize.width > 0 && (
            <rect
              x={(-pan.x / zoom) * miniScale}
              y={(-pan.y / zoom) * miniScale}
              width={(containerSize.width / zoom) * miniScale}
              height={(containerSize.height / zoom) * miniScale}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={1}
              rx={1}
            />
          )}

          <rect
            width={MINI_W}
            height={MINI_H}
            fill="none"
            stroke="rgba(0,255,204,0.3)"
            strokeWidth={1}
            rx={4}
          />
        </svg>
      )}

      {/* Hover tooltip */}
      {hoveredObject && (
        <div
          className="sector-object-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {hoveredObject.visibility_state === 'anomaly' && !gmView ? (
            <>
              <span className="sector-object-tooltip__title sector-object-tooltip__title--anomaly">
                Unknown Contact
              </span>
              <span className="sector-object-tooltip__desc">
                Unidentified signal detected
              </span>
            </>
          ) : (
            <>
              {hoveredObject.label && (
                <span className="sector-object-tooltip__title">{hoveredObject.label}</span>
              )}
              {hoveredObject.description && (
                <span className="sector-object-tooltip__desc">
                  {hoveredObject.description.length > 80
                    ? hoveredObject.description.slice(0, 80) + '…'
                    : hoveredObject.description}
                </span>
              )}
              {!hoveredObject.label && !hoveredObject.description && (
                <span className="sector-object-tooltip__title">Unknown Object</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
