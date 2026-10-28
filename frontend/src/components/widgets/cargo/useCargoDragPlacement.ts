import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCreateCargoPlacement, useUpdateCargoPlacement } from '../../../hooks/useMutations';
import type { Cargo, CargoBayWithPlacements, CargoPlacementWithCargo } from '../../../types';
import { buildOccupiedTilesSet, checkPlacementValidity } from '../../../utils/cargoShapes';

export interface GridPoint {
  x: number;
  y: number;
}

/** A placed item turned back into a Cargo so it can be dragged like an unplaced one. */
function placementToCargo(placement: CargoPlacementWithCargo): Cargo {
  return {
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
  };
}

/**
 * Drag-to-place state machine for the cargo bay grid: which cargo is being
 * carried, where it hovers, its rotation, whether the drop is valid, and the
 * create/update placement call on drop. Releasing the mouse anywhere outside
 * the grid cancels the drag (the grid stops propagation of its own mouseup).
 * Mutation failures are toasted by the cargo mutation hooks.
 */
export function useCargoDragPlacement(bay: CargoBayWithPlacements | undefined, canEditData: boolean) {
  const [draggingCargo, setDraggingCargo] = useState<Cargo | null>(null);
  const [dragPosition, setDragPosition] = useState<GridPoint | null>(null);
  const [dragRotation, setDragRotation] = useState(0);

  const createPlacement = useCreateCargoPlacement();
  const updatePlacement = useUpdateCargoPlacement();

  // Tiles taken by other cargo (the carried item doesn't block itself)
  const occupiedTiles = useMemo(() => {
    if (!bay?.placements) return new Set<string>();
    return buildOccupiedTilesSet(bay.placements, draggingCargo?.id);
  }, [bay, draggingCargo]);

  const dragValid = useMemo(() => {
    if (!draggingCargo || !dragPosition || !bay) return false;
    return checkPlacementValidity(
      dragPosition.x,
      dragPosition.y,
      draggingCargo.size_class,
      draggingCargo.shape_variant,
      dragRotation,
      bay.width,
      bay.height,
      occupiedTiles
    ).valid;
  }, [draggingCargo, dragPosition, dragRotation, bay, occupiedTiles]);

  const cancel = useCallback(() => {
    setDraggingCargo(null);
    setDragPosition(null);
    setDragRotation(0);
  }, []);

  const rotate = useCallback(() => {
    setDragRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rotate();
    },
    [rotate]
  );

  /** Commit the carried cargo at the hover position (or just cancel if invalid). */
  const drop = useCallback(async () => {
    if (!draggingCargo || !dragPosition || !bay || !dragValid) {
      cancel();
      return;
    }
    try {
      const existing = bay.placements.find((p) => p.cargo_id === draggingCargo.id);
      if (existing) {
        await updatePlacement.mutateAsync({
          id: existing.id,
          data: { x: dragPosition.x, y: dragPosition.y, rotation: dragRotation },
        });
      } else {
        await createPlacement.mutateAsync({
          cargo_id: draggingCargo.id,
          bay_id: bay.id,
          x: dragPosition.x,
          y: dragPosition.y,
          rotation: dragRotation,
        });
      }
    } catch {
      // Already reported by the mutation's onError toast; just drop the drag state
    }
    cancel();
  }, [draggingCargo, dragPosition, bay, dragValid, dragRotation, createPlacement, updatePlacement, cancel]);

  /** Pick up an already-placed item, keeping its current rotation. */
  const startMoving = useCallback((placement: CargoPlacementWithCargo) => {
    setDraggingCargo(placementToCargo(placement));
    setDragRotation(placement.rotation);
    setDragPosition({ x: placement.x, y: placement.y });
  }, []);

  /** Pick up an unplaced item. Returns false when placement isn't possible right now. */
  const startPlacing = useCallback(
    (cargo: Cargo) => {
      if (!canEditData || !bay) return false;
      setDraggingCargo(cargo);
      setDragRotation(0);
      setDragPosition(null);
      return true;
    },
    [canEditData, bay]
  );

  // Releasing the mouse outside the grid cancels the drag
  useEffect(() => {
    if (!draggingCargo) return;
    document.addEventListener('mouseup', cancel);
    return () => document.removeEventListener('mouseup', cancel);
  }, [draggingCargo, cancel]);

  return {
    draggingCargo,
    dragPosition,
    setDragPosition,
    dragRotation,
    dragValid,
    drop,
    cancel,
    rotate,
    handleKeyDown,
    startMoving,
    startPlacing,
  };
}
