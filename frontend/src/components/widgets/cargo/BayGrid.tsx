import { useCallback } from 'react';
import type { Cargo, CargoBayWithPlacements, CargoCategory, CargoPlacementWithCargo } from '../../../types';
import { getOccupiedTiles } from '../../../utils/cargoShapes';
import { abbreviateName, getCargoColor } from './cargoDisplay';
import type { GridPoint } from './useCargoDragPlacement';

interface BayGridProps {
  bay: CargoBayWithPlacements;
  cellSize: number;
  categoryMap: Map<string, CargoCategory>;
  canEditData: boolean;
  selectedCargoId: string | null;
  draggingCargo: Cargo | null;
  dragPosition: GridPoint | null;
  dragRotation: number;
  dragValid: boolean;
  onHover: (point: GridPoint) => void;
  onDrop: () => void;
  /** Mouse released on empty grid with nothing carried. */
  onClearSelection: () => void;
  onSelectPlacement: (placement: CargoPlacementWithCargo) => void;
  onStartMoving: (placement: CargoPlacementWithCargo) => void;
}

/** SVG polyomino grid for one bay: cells, placed cargo, and the drag preview. */
export function BayGrid({
  bay,
  cellSize,
  categoryMap,
  canEditData,
  selectedCargoId,
  draggingCargo,
  dragPosition,
  dragRotation,
  dragValid,
  onHover,
  onDrop,
  onClearSelection,
  onSelectPlacement,
  onStartMoving,
}: BayGridProps) {
  const gridWidth = bay.width;
  const gridHeight = bay.height;

  const getGridPosition = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): GridPoint => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / cellSize);
      const y = Math.floor((e.clientY - rect.top) / cellSize);
      return { x: Math.max(0, Math.min(x, gridWidth - 1)), y: Math.max(0, Math.min(y, gridHeight - 1)) };
    },
    [cellSize, gridWidth, gridHeight]
  );

  return (
    <svg
      className="cargo-bay-grid"
      width={gridWidth * cellSize}
      height={gridHeight * cellSize}
      onMouseMove={(e) => {
        if (draggingCargo) onHover(getGridPosition(e));
      }}
      onMouseUp={(e) => {
        // Keep the document-level "release outside cancels" listener from firing
        e.stopPropagation();
        if (draggingCargo) {
          onDrop();
        } else {
          onClearSelection();
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
      <rect x={0} y={0} width={gridWidth * cellSize} height={gridHeight * cellSize} className="cargo-grid-border" />

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
      {bay.placements.map((placement) => {
        const tiles = getOccupiedTiles(
          placement.x,
          placement.y,
          placement.cargo.size_class,
          placement.cargo.shape_variant,
          placement.rotation
        );
        const color = getCargoColor(placement.cargo, categoryMap);
        const isSelected = selectedCargoId === placement.cargo_id;
        const label =
          tiles.length >= 3 ? abbreviateName(placement.cargo.name, 3) : placement.cargo.name.charAt(0).toUpperCase();

        return (
          <g
            key={placement.id}
            className={`cargo-piece ${isSelected ? 'selected' : ''}`}
            style={{ '--piece-glow-color': color } as React.CSSProperties}
            onClick={(e) => {
              e.stopPropagation();
              if (draggingCargo) return;
              if (isSelected) {
                // Already selected - start move mode on second click
                if (canEditData) onStartMoving(placement);
              } else {
                onSelectPlacement(placement);
              }
            }}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent text selection
              // Only initiate drag detection if already selected
              if (canEditData && isSelected && !draggingCargo && e.button === 0) {
                e.stopPropagation();
                // Threshold detection so a click doesn't turn into a drag
                const startX = e.clientX;
                const startY = e.clientY;
                let isDragging = false;

                const handleMove = (moveE: MouseEvent) => {
                  if (!isDragging && (Math.abs(moveE.clientX - startX) > 3 || Math.abs(moveE.clientY - startY) > 3)) {
                    isDragging = true;
                    onStartMoving(placement);
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
  );
}
