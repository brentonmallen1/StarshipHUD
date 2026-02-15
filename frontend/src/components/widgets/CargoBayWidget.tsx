import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useCargoBays, useCargoBayWithPlacements, useUnplacedCargo, useCargoCategories } from '../../hooks/useShipData';
import {
  useCreateCargoPlacement,
  useUpdateCargoPlacement,
  useDeleteCargoPlacement,
  useUpdateCargo,
} from '../../hooks/useMutations';
import type { WidgetRendererProps, CargoPlacementWithCargo, Cargo, CargoCategory } from '../../types';
import { getConfig } from '../../types';
import type { CargoBayConfig } from '../../types';
import {
  getOccupiedTiles,
  buildOccupiedTilesSet,
  checkPlacementValidity,
  CARGO_SIZE_LABELS,
} from '../../utils/cargoShapes';
import './CargoBayWidget.css';

// Helper function to abbreviate cargo name for display on tiles
function abbreviateName(name: string, maxLen = 3): string {
  const words = name.split(/[\s\-_]+/);
  if (words.length > 1) {
    return words.map((w) => w[0]).join('').toUpperCase().slice(0, maxLen);
  }
  return name.slice(0, maxLen).toUpperCase();
}

// Helper to get cargo color (item color -> category color -> default)
function getCargoColor(
  cargo: { color?: string; category_color?: string; category_id?: string },
  categoryMap?: Map<string, CargoCategory>
): string {
  if (cargo.color) return cargo.color;
  if (cargo.category_color) return cargo.category_color;
  if (cargo.category_id && categoryMap) {
    const cat = categoryMap.get(cargo.category_id);
    if (cat) return cat.color;
  }
  return 'var(--color-text-muted)';
}

export function CargoBayWidget({ instance, canEditData }: WidgetRendererProps) {
  const config = getConfig<CargoBayConfig>(instance.config);
  const showInventory = config.show_inventory ?? true;

  const { data: bays } = useCargoBays();
  const { data: unplacedCargo } = useUnplacedCargo();
  const { data: categories } = useCargoCategories();

  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);
  const [selectedUnplacedCargo, setSelectedUnplacedCargo] = useState<Cargo | null>(null);
  const [draggingCargo, setDraggingCargo] = useState<Cargo | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragRotation, setDragRotation] = useState(0);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(160);
  const [isResizing, setIsResizing] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);

  // Container ref for grid scaling
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Build category map for lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, CargoCategory>();
    categories?.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Auto-select first bay
  const activeBayId = selectedBayId || bays?.[0]?.id || null;
  const { data: bayWithPlacements } = useCargoBayWithPlacements(activeBayId || '');

  const createPlacement = useCreateCargoPlacement();
  const updatePlacement = useUpdateCargoPlacement();
  const deletePlacement = useDeleteCargoPlacement();
  const updateCargo = useUpdateCargo();

  // ResizeObserver for dynamic grid scaling
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Find selected placement
  const selectedPlacement = useMemo(() => {
    if (!selectedCargoId || !bayWithPlacements?.placements) return null;
    return bayWithPlacements.placements.find((p) => p.cargo_id === selectedCargoId) || null;
  }, [selectedCargoId, bayWithPlacements]);

  // Sync notes editing state when selection changes
  useEffect(() => {
    if (selectedPlacement) {
      setEditingNotes(selectedPlacement.cargo.notes || '');
    } else if (selectedUnplacedCargo) {
      setEditingNotes(selectedUnplacedCargo.notes || '');
    } else {
      setEditingNotes(null);
    }
  }, [selectedPlacement, selectedUnplacedCargo]);

  // Build occupied tiles set
  const occupiedTiles = useMemo(() => {
    if (!bayWithPlacements?.placements) return new Set<string>();
    return buildOccupiedTilesSet(bayWithPlacements.placements, draggingCargo?.id);
  }, [bayWithPlacements, draggingCargo]);

  // Grid dimensions
  const gridWidth = bayWithPlacements?.width ?? 8;
  const gridHeight = bayWithPlacements?.height ?? 6;

  // Calculate cell size based on container (dynamic scaling - no max clamp)
  const cellSize = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return 28;
    const padding = 16; // Account for container padding
    const availableWidth = containerSize.width - padding;
    const availableHeight = containerSize.height - padding;
    const cellByWidth = availableWidth / gridWidth;
    const cellByHeight = availableHeight / gridHeight;
    const size = Math.min(cellByWidth, cellByHeight);
    return Math.max(20, size); // Only min clamp, grid fills container
  }, [containerSize, gridWidth, gridHeight]);

  // Check if drag position is valid
  const dragValid = useMemo(() => {
    if (!draggingCargo || !dragPosition || !bayWithPlacements) return false;
    const result = checkPlacementValidity(
      dragPosition.x,
      dragPosition.y,
      draggingCargo.size_class,
      draggingCargo.shape_variant,
      dragRotation,
      bayWithPlacements.width,
      bayWithPlacements.height,
      occupiedTiles
    );
    return result.valid;
  }, [draggingCargo, dragPosition, dragRotation, bayWithPlacements, occupiedTiles]);

  // Handle rotation
  const handleRotate = useCallback(() => {
    setDragRotation((prev) => (prev + 90) % 360);
  }, []);

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        handleRotate();
      }
    },
    [handleRotate]
  );

  // Handle drop
  const handleDrop = useCallback(async () => {
    // If no valid placement, just cancel the drag and return to inventory
    if (!draggingCargo || !dragPosition || !activeBayId || !dragValid) {
      setDraggingCargo(null);
      setDragPosition(null);
      setDragRotation(0);
      return;
    }

    try {
      const existingPlacement = bayWithPlacements?.placements.find(
        (p) => p.cargo_id === draggingCargo.id
      );

      if (existingPlacement) {
        await updatePlacement.mutateAsync({
          id: existingPlacement.id,
          data: { x: dragPosition.x, y: dragPosition.y, rotation: dragRotation },
        });
      } else {
        await createPlacement.mutateAsync({
          cargo_id: draggingCargo.id,
          bay_id: activeBayId,
          x: dragPosition.x,
          y: dragPosition.y,
          rotation: dragRotation,
        });
      }
    } catch {
      // Error handling via toast in mutation
    }

    setDraggingCargo(null);
    setDragPosition(null);
    setDragRotation(0);
  }, [
    draggingCargo,
    dragPosition,
    activeBayId,
    dragValid,
    dragRotation,
    bayWithPlacements,
    createPlacement,
    updatePlacement,
  ]);

  // Handle remove from bay
  const handleRemove = useCallback(
    async (placementId: string) => {
      try {
        await deletePlacement.mutateAsync(placementId);
        setSelectedCargoId(null);
      } catch {
        // Error handling via toast
      }
    },
    [deletePlacement]
  );

  // Handle rotate placed item
  const handleRotatePlaced = useCallback(
    async (placement: CargoPlacementWithCargo) => {
      const newRotation = (placement.rotation + 90) % 360;
      const valid = checkPlacementValidity(
        placement.x,
        placement.y,
        placement.cargo.size_class,
        placement.cargo.shape_variant,
        newRotation,
        bayWithPlacements!.width,
        bayWithPlacements!.height,
        buildOccupiedTilesSet(bayWithPlacements!.placements, placement.cargo_id)
      );

      if (valid.valid) {
        await updatePlacement.mutateAsync({
          id: placement.id,
          data: { rotation: newRotation },
        });
      }
    },
    [bayWithPlacements, updatePlacement]
  );

  // Handle notes save
  const handleSaveNotes = useCallback(
    async (cargoId: string) => {
      if (editingNotes === null) return;
      await updateCargo.mutateAsync({
        id: cargoId,
        data: { notes: editingNotes },
      });
    },
    [editingNotes, updateCargo]
  );

  // Calculate grid position from mouse
  const getGridPosition = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / cellSize);
      const y = Math.floor((e.clientY - rect.top) / cellSize);
      return { x: Math.max(0, Math.min(x, gridWidth - 1)), y: Math.max(0, Math.min(y, gridHeight - 1)) };
    },
    [cellSize, gridWidth, gridHeight]
  );

  // Global mouseup handler to cancel drag if dropped outside grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingCargo) {
        setDraggingCargo(null);
        setDragPosition(null);
        setDragRotation(0);
      }
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [draggingCargo]);

  // Handle panel resize
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = panelWidth;

      const handleMove = (moveE: MouseEvent) => {
        const delta = startX - moveE.clientX;
        const newWidth = Math.max(120, Math.min(300, startWidth + delta));
        setPanelWidth(newWidth);
      };

      const handleUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [panelWidth]
  );

  // Start drag mode for a placed cargo item
  const startMovingCargo = useCallback(
    (placement: CargoPlacementWithCargo) => {
      setDraggingCargo({
        id: placement.cargo_id,
        ship_id: '',
        name: placement.cargo.name,
        size_class: placement.cargo.size_class,
        shape_variant: placement.cargo.shape_variant,
        category_id: placement.cargo.category_id,
        notes: placement.cargo.notes,
        color: placement.cargo.color,
        created_at: '',
        updated_at: '',
      });
      setDragRotation(placement.rotation);
      setDragPosition({ x: placement.x, y: placement.y });
    },
    []
  );

  // Start placement mode for unplaced cargo
  const startPlacement = useCallback(
    (cargo: Cargo) => {
      if (canEditData && bayWithPlacements) {
        setDraggingCargo(cargo);
        setDragRotation(0);
        setDragPosition(null);
        setSelectedUnplacedCargo(null);
        setSelectedCargoId(null);
      }
    },
    [canEditData, bayWithPlacements]
  );

  return (
    <div
      className={`cargo-bay-widget ${draggingCargo ? 'dragging' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Bay Selector */}
      <div className="cargo-bay-header">
        <label htmlFor="cargo-bay-select">Bay:</label>
        {bays && bays.length > 0 ? (
          <select
            id="cargo-bay-select"
            className="cargo-bay-select"
            value={activeBayId || ''}
            onChange={(e) => {
              setSelectedBayId(e.target.value);
              setSelectedCargoId(null);
              setSelectedUnplacedCargo(null);
            }}
          >
            {bays.map((bay) => (
              <option key={bay.id} value={bay.id}>
                {bay.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="cargo-bay-no-bays">No cargo bays configured</span>
        )}
      </div>

      <div className="cargo-bay-content">
        {/* Grid */}
        <div className="cargo-bay-grid-container" ref={gridContainerRef}>
          {bayWithPlacements ? (
            <svg
              className="cargo-bay-grid"
              width={gridWidth * cellSize}
              height={gridHeight * cellSize}
              onMouseMove={(e) => {
                if (draggingCargo) {
                  setDragPosition(getGridPosition(e));
                }
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                if (draggingCargo) {
                  handleDrop();
                } else {
                  setSelectedCargoId(null);
                  setSelectedUnplacedCargo(null);
                }
              }}
            >
              {/* Grid cells */}
              {Array.from({ length: gridHeight }, (_, y) =>
                Array.from({ length: gridWidth }, (_, x) => (
                  <rect
                    key={`cell-${x}-${y}`}
                    x={x * cellSize}
                    y={y * cellSize}
                    width={cellSize}
                    height={cellSize}
                    className="cargo-grid-cell"
                  />
                ))
              )}

              {/* Grid border frame */}
              <rect
                x={0}
                y={0}
                width={gridWidth * cellSize}
                height={gridHeight * cellSize}
                className="cargo-grid-border"
              />

              {/* Corner tick marks for visual guidance */}
              {Array.from({ length: gridHeight + 1 }, (_, y) =>
                Array.from({ length: gridWidth + 1 }, (_, x) => (
                  <g key={`tick-${x}-${y}`}>
                    <line
                      x1={x * cellSize - 3}
                      y1={y * cellSize}
                      x2={x * cellSize + 3}
                      y2={y * cellSize}
                      className="cargo-grid-tick"
                    />
                    <line
                      x1={x * cellSize}
                      y1={y * cellSize - 3}
                      x2={x * cellSize}
                      y2={y * cellSize + 3}
                      className="cargo-grid-tick"
                    />
                  </g>
                ))
              )}

              {/* Placed cargo items */}
              {bayWithPlacements.placements.map((placement) => {
                const tiles = getOccupiedTiles(
                  placement.x,
                  placement.y,
                  placement.cargo.size_class,
                  placement.cargo.shape_variant,
                  placement.rotation
                );
                const color = getCargoColor(placement.cargo, categoryMap);
                const isSelected = selectedCargoId === placement.cargo_id;
                const tileCount = tiles.length;
                const label = tileCount >= 3 ? abbreviateName(placement.cargo.name, 3) : placement.cargo.name.charAt(0).toUpperCase();

                return (
                  <g
                    key={placement.id}
                    className={`cargo-piece ${isSelected ? 'selected' : ''}`}
                    style={{ '--piece-glow-color': color } as React.CSSProperties}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!draggingCargo) {
                        if (selectedCargoId === placement.cargo_id) {
                          // Already selected - start move mode on second click
                          if (canEditData) {
                            startMovingCargo(placement);
                          }
                        } else {
                          // First click - select this cargo
                          setSelectedCargoId(placement.cargo_id);
                          setSelectedUnplacedCargo(null);
                        }
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent text selection
                      // Only initiate drag detection if already selected
                      if (canEditData && selectedCargoId === placement.cargo_id && !draggingCargo && e.button === 0) {
                        e.stopPropagation();
                        // Use threshold detection for hold+drag
                        const startX = e.clientX;
                        const startY = e.clientY;
                        let isDragging = false;

                        const handleMove = (moveE: MouseEvent) => {
                          if (!isDragging && (Math.abs(moveE.clientX - startX) > 3 || Math.abs(moveE.clientY - startY) > 3)) {
                            isDragging = true;
                            startMovingCargo(placement);
                          }
                        };

                        const handleUp = () => {
                          document.removeEventListener('mousemove', handleMove);
                          document.removeEventListener('mouseup', handleUp);
                        };

                        document.addEventListener('mousemove', handleMove);
                        document.addEventListener('mouseup', handleUp);
                      }
                    }}
                  >
                    {/* Tooltip */}
                    <title>{placement.cargo.name}</title>
                    {tiles.map(([tx, ty], i) => (
                      <rect
                        key={i}
                        x={tx * cellSize + 1}
                        y={ty * cellSize + 1}
                        width={cellSize - 2}
                        height={cellSize - 2}
                        fill="var(--color-bg-secondary)"
                        stroke={color}
                        strokeWidth={isSelected ? 2 : 1}
                        rx={2}
                      />
                    ))}
                    {/* Primary label on first tile */}
                    <text
                      x={tiles[0][0] * cellSize + cellSize / 2}
                      y={tiles[0][1] * cellSize + cellSize / 2 + 4}
                      className="cargo-piece-label"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Drag preview */}
              {draggingCargo && dragPosition && (
                <g className={`cargo-piece-preview ${dragValid ? 'valid' : 'invalid'}`}>
                  {getOccupiedTiles(
                    dragPosition.x,
                    dragPosition.y,
                    draggingCargo.size_class,
                    draggingCargo.shape_variant,
                    dragRotation
                  ).map(([tx, ty], i) => (
                    <rect
                      key={i}
                      x={tx * cellSize + 1}
                      y={ty * cellSize + 1}
                      width={cellSize - 2}
                      height={cellSize - 2}
                      rx={2}
                    />
                  ))}
                </g>
              )}
            </svg>
          ) : (
            <div className="cargo-bay-empty">No cargo bay selected</div>
          )}

          {draggingCargo && (
            <div className="cargo-drag-hint">Press R to rotate | Click to place</div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="cargo-detail-panel" style={{ width: panelWidth }}>
          <div
            className={`cargo-panel-resize-handle ${isResizing ? 'active' : ''}`}
            onMouseDown={handleResizeStart}
          />
          {selectedPlacement ? (
            <>
              <div className="cargo-detail-header">
                <h4>{selectedPlacement.cargo.name}</h4>
                <button className="cargo-detail-close" onClick={() => setSelectedCargoId(null)}>
                  &times;
                </button>
              </div>
              <div className="cargo-detail-content">
                <div className="cargo-detail-row">
                  <span className="cargo-detail-label">Category</span>
                  <span
                    className="cargo-detail-value"
                    style={{ color: getCargoColor(selectedPlacement.cargo, categoryMap) }}
                  >
                    {selectedPlacement.cargo.category_name || 'Uncategorized'}
                  </span>
                </div>
                <div className="cargo-detail-row">
                  <span className="cargo-detail-label">Size</span>
                  <span className="cargo-detail-value">
                    {CARGO_SIZE_LABELS[selectedPlacement.cargo.size_class]}
                  </span>
                </div>
                <div className="cargo-detail-row cargo-detail-notes-row">
                  <span className="cargo-detail-label">Notes</span>
                  {canEditData ? (
                    <textarea
                      className="cargo-notes-input"
                      value={editingNotes ?? ''}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      onBlur={() => handleSaveNotes(selectedPlacement.cargo_id)}
                      placeholder="Add notes..."
                      rows={3}
                    />
                  ) : (
                    <span className="cargo-detail-value cargo-notes-display">
                      {selectedPlacement.cargo.notes || '—'}
                    </span>
                  )}
                </div>

                {canEditData && (
                  <div className="cargo-detail-actions">
                    <button className="cargo-action-btn" onClick={() => handleRotatePlaced(selectedPlacement)}>
                      Rotate
                    </button>
                    <button className="cargo-action-btn" onClick={() => startMovingCargo(selectedPlacement)}>
                      Move
                    </button>
                    <button className="cargo-action-btn danger" onClick={() => handleRemove(selectedPlacement.id)}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : selectedUnplacedCargo ? (
            <>
              <div className="cargo-detail-header">
                <h4>{selectedUnplacedCargo.name}</h4>
                <button className="cargo-detail-close" onClick={() => setSelectedUnplacedCargo(null)}>
                  &times;
                </button>
              </div>
              <div className="cargo-detail-content">
                <div className="cargo-detail-row">
                  <span className="cargo-detail-label">Status</span>
                  <span className="cargo-detail-value" style={{ color: 'var(--color-degraded)' }}>
                    Not Placed
                  </span>
                </div>
                <div className="cargo-detail-row">
                  <span className="cargo-detail-label">Category</span>
                  <span
                    className="cargo-detail-value"
                    style={{ color: getCargoColor(selectedUnplacedCargo, categoryMap) }}
                  >
                    {selectedUnplacedCargo.category_id
                      ? categoryMap.get(selectedUnplacedCargo.category_id)?.name || 'Unknown'
                      : 'Uncategorized'}
                  </span>
                </div>
                <div className="cargo-detail-row">
                  <span className="cargo-detail-label">Size</span>
                  <span className="cargo-detail-value">
                    {CARGO_SIZE_LABELS[selectedUnplacedCargo.size_class]}
                  </span>
                </div>
                <div className="cargo-detail-row cargo-detail-notes-row">
                  <span className="cargo-detail-label">Notes</span>
                  {canEditData ? (
                    <textarea
                      className="cargo-notes-input"
                      value={editingNotes ?? ''}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      onBlur={() => handleSaveNotes(selectedUnplacedCargo.id)}
                      placeholder="Add notes..."
                      rows={3}
                    />
                  ) : (
                    <span className="cargo-detail-value cargo-notes-display">
                      {selectedUnplacedCargo.notes || '—'}
                    </span>
                  )}
                </div>

                {canEditData && bayWithPlacements && (
                  <div className="cargo-detail-actions">
                    <button className="cargo-action-btn" onClick={() => startPlacement(selectedUnplacedCargo)}>
                      Place in Bay
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="cargo-detail-empty">
              <span>Select cargo to view details</span>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Drawer */}
      {showInventory && (
        <div className={`cargo-inventory-drawer ${inventoryOpen ? 'open' : ''}`}>
          <button className="cargo-inventory-toggle" onClick={() => setInventoryOpen(!inventoryOpen)}>
            {inventoryOpen ? 'Hide' : 'Show'} Unplaced ({unplacedCargo?.length ?? 0})
          </button>
          {inventoryOpen && (
            <div className="cargo-inventory-list">
              {unplacedCargo?.map((cargo) => {
                const color = getCargoColor(cargo, categoryMap);
                return (
                  <div
                    key={cargo.id}
                    className={`cargo-inventory-item ${selectedUnplacedCargo?.id === cargo.id ? 'selected' : ''}`}
                    style={{ borderColor: color }}
                    title={cargo.name}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Click immediately starts placement mode (like "Place in Bay" button)
                      if (canEditData && bayWithPlacements) {
                        startPlacement(cargo);
                      } else {
                        // View-only mode: just select for viewing
                        setSelectedUnplacedCargo(cargo);
                        setSelectedCargoId(null);
                      }
                    }}
                  >
                    <span className="cargo-inventory-name">{cargo.name}</span>
                    <span className="cargo-inventory-size">{CARGO_SIZE_LABELS[cargo.size_class]}</span>
                  </div>
                );
              })}
              {(!unplacedCargo || unplacedCargo.length === 0) && (
                <div className="cargo-inventory-empty">All cargo placed</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
