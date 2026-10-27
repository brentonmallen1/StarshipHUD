import { useState, useMemo, useCallback } from 'react';
import { useCargoBays, useCargoBayWithPlacements, useUnplacedCargo, useCargoCategories } from '../../hooks/useShipData';
import { useDeleteCargoPlacement, useUpdateCargo, useUpdateCargoPlacement } from '../../hooks/useMutations';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import type { WidgetRendererProps, CargoPlacementWithCargo, Cargo, CargoCategory } from '../../types';
import { getConfig, CARGO_BAY_DEFAULTS, type CargoBayConfig } from '../../types';
import { buildOccupiedTilesSet, checkPlacementValidity } from '../../utils/cargoShapes';
import { WidgetState } from './WidgetState';
import { BayGrid } from './cargo/BayGrid';
import { CargoDetail } from './cargo/CargoDetail';
import { InventoryPanel } from './cargo/InventoryPanel';
import { useCargoDragPlacement } from './cargo/useCargoDragPlacement';
import './CargoBayWidget.css';

/** Horizontal/vertical space inside the grid container not available to cells:
 *  the container's own padding (2 × --space-sm) plus breathing room. */
const GRID_INSET = 32;
const MIN_CELL = 20;
const FALLBACK_CELL = 28;

export function CargoBayWidget({ instance, canEditData, isEditing }: WidgetRendererProps) {
  const config = getConfig<CargoBayConfig>(instance.config);
  const showInventory = config.show_inventory ?? CARGO_BAY_DEFAULTS.show_inventory;

  const { data: bays, isLoading: baysLoading, error: baysError } = useCargoBays();
  const { data: unplacedCargo } = useUnplacedCargo();
  const { data: categories } = useCargoCategories();

  // Filter bays based on config.bay_ids (empty/undefined means show all)
  const filteredBays = useMemo(() => {
    if (!bays) return [];
    if (!config.bay_ids || config.bay_ids.length === 0) return bays;
    return bays.filter((bay) => config.bay_ids!.includes(bay.id));
  }, [bays, config.bay_ids]);

  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);
  const [selectedUnplacedCargo, setSelectedUnplacedCargo] = useState<Cargo | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, CargoCategory>();
    categories?.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Auto-select first bay from filtered list
  const activeBayId = selectedBayId || filteredBays?.[0]?.id || null;
  const { data: bay, isLoading: bayLoading, error: bayError } = useCargoBayWithPlacements(activeBayId || '');

  const updatePlacement = useUpdateCargoPlacement();
  const deletePlacement = useDeleteCargoPlacement();
  const updateCargo = useUpdateCargo();
  const drag = useCargoDragPlacement(bay, canEditData);

  // Scale cells to fill the grid container
  const { containerRef: gridContainerRef, width: containerWidth, height: containerHeight } = useContainerDimensions();
  const cellSize = useMemo(() => {
    if (!bay || containerWidth === 0 || containerHeight === 0) return FALLBACK_CELL;
    const size = Math.min((containerWidth - GRID_INSET) / bay.width, (containerHeight - GRID_INSET) / bay.height);
    return Math.max(MIN_CELL, size); // Only min clamp, grid fills container
  }, [bay, containerWidth, containerHeight]);

  const selectedPlacement = useMemo(() => {
    if (!selectedCargoId || !bay?.placements) return null;
    return bay.placements.find((p) => p.cargo_id === selectedCargoId) || null;
  }, [selectedCargoId, bay]);

  const clearSelection = useCallback(() => {
    setSelectedCargoId(null);
    setSelectedUnplacedCargo(null);
  }, []);

  const startPlacing = useCallback(
    (cargo: Cargo) => {
      if (drag.startPlacing(cargo)) clearSelection();
    },
    [drag, clearSelection]
  );

  // Failures below are toasted by the cargo mutation hooks
  const handleRemove = useCallback(
    async (placement: CargoPlacementWithCargo) => {
      try {
        await deletePlacement.mutateAsync(placement.id);
        setSelectedCargoId(null);
      } catch {
        // keep the selection so the player can retry
      }
    },
    [deletePlacement]
  );

  const handleRotatePlaced = useCallback(
    (placement: CargoPlacementWithCargo) => {
      if (!bay) return;
      const rotation = (placement.rotation + 90) % 360;
      const { valid } = checkPlacementValidity(
        placement.x,
        placement.y,
        placement.cargo.size_class,
        placement.cargo.shape_variant,
        rotation,
        bay.width,
        bay.height,
        buildOccupiedTilesSet(bay.placements, placement.cargo_id)
      );
      if (valid) updatePlacement.mutate({ id: placement.id, data: { rotation } });
    },
    [bay, updatePlacement]
  );

  const handleSaveNotes = useCallback(
    (cargoId: string, notes: string) => {
      updateCargo.mutate({ id: cargoId, data: { notes } });
    },
    [updateCargo]
  );

  // Editing mode: show simple placeholder (config is in modal)
  if (isEditing) {
    const displayBays = filteredBays.length > 0 ? filteredBays : bays || [];
    const showingAll = !config.bay_ids || config.bay_ids.length === 0;
    return (
      <div className="cargo-bay-widget editing">
        <div className="widget-title">Cargo Bay</div>
        {displayBays.length > 0 ? (
          <div className="editing-hint">
            <span className="editing-label">{showingAll ? 'Showing all bays:' : 'Visible bays:'}</span>
            <ul className="editing-list">
              {displayBays.map((b) => (
                <li key={b.id}>{b.name}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="editing-hint">No cargo bays configured</p>
        )}
        <p className="editing-hint editing-action">Double-click to configure</p>
      </div>
    );
  }

  if (baysLoading) {
    return (
      <div className="cargo-bay-widget">
        <WidgetState kind="loading" message="Loading cargo manifest" />
      </div>
    );
  }

  if (baysError) {
    return (
      <div className="cargo-bay-widget">
        <WidgetState kind="error" message="Cargo manifest unavailable" />
      </div>
    );
  }

  return (
    <div
      className={`cargo-bay-widget ${drag.draggingCargo ? 'dragging' : ''}`}
      tabIndex={0}
      onKeyDown={drag.handleKeyDown}
    >
      {/* Bay Selector */}
      <div className="cargo-bay-header">
        <label htmlFor="cargo-bay-select">Bay:</label>
        {filteredBays.length > 0 ? (
          <select
            id="cargo-bay-select"
            className="cargo-bay-select"
            value={activeBayId || ''}
            onChange={(e) => {
              setSelectedBayId(e.target.value);
              clearSelection();
            }}
          >
            {filteredBays.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="cargo-bay-no-bays">No cargo bays configured</span>
        )}
      </div>

      <div className="cargo-bay-content">
        <div className="cargo-bay-grid-container" ref={gridContainerRef}>
          {bay ? (
            <BayGrid
              bay={bay}
              cellSize={cellSize}
              categoryMap={categoryMap}
              canEditData={canEditData}
              selectedCargoId={selectedCargoId}
              draggingCargo={drag.draggingCargo}
              dragPosition={drag.dragPosition}
              dragRotation={drag.dragRotation}
              dragValid={drag.dragValid}
              onHover={drag.setDragPosition}
              onDrop={drag.drop}
              onClearSelection={clearSelection}
              onSelectPlacement={(placement) => {
                setSelectedCargoId(placement.cargo_id);
                setSelectedUnplacedCargo(null);
              }}
              onStartMoving={drag.startMoving}
            />
          ) : activeBayId && bayLoading ? (
            <WidgetState kind="loading" message="Scanning bay" compact />
          ) : activeBayId && bayError ? (
            <WidgetState kind="error" message="Bay telemetry unavailable" compact />
          ) : (
            <WidgetState kind="empty" message="No cargo bay selected" compact />
          )}

          {drag.draggingCargo && (
            <div className="cargo-drag-hint">Press R to rotate | Click to place</div>
          )}
        </div>

        <CargoDetail
          placement={selectedPlacement}
          unplaced={selectedPlacement ? null : selectedUnplacedCargo}
          categoryMap={categoryMap}
          canEditData={canEditData}
          canPlace={!!bay}
          onClose={clearSelection}
          onRotate={handleRotatePlaced}
          onMove={drag.startMoving}
          onRemove={handleRemove}
          onPlace={startPlacing}
          onSaveNotes={handleSaveNotes}
        />
      </div>

      {showInventory && (
        <InventoryPanel
          cargo={unplacedCargo}
          categoryMap={categoryMap}
          selectedCargoId={selectedUnplacedCargo?.id ?? null}
          onPick={(cargo) => {
            // Editors pick it straight up for placement; viewers just inspect it
            if (canEditData && bay) {
              startPlacing(cargo);
            } else {
              setSelectedUnplacedCargo(cargo);
              setSelectedCargoId(null);
            }
          }}
        />
      )}
    </div>
  );
}
