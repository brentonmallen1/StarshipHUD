/**
 * Polyomino shape definitions and utilities for the cargo bay system.
 */

import type { CargoSizeClass } from '../types';

export interface PolyominoShape {
  tiles: [number, number][]; // Array of [dx, dy] offsets from anchor point (0,0)
  name: string;
}

/**
 * Shape definitions for each cargo size class.
 * Index 0 is always a straight line option.
 */
export const CARGO_SHAPES: Record<CargoSizeClass, PolyominoShape[]> = {
  tiny: [{ tiles: [[0, 0]], name: 'Single' }],
  x_small: [
    { tiles: [[0, 0], [1, 0]], name: 'Horizontal' },
    { tiles: [[0, 0], [0, 1]], name: 'Vertical' },
  ],
  small: [
    { tiles: [[0, 0], [1, 0], [2, 0]], name: 'Line' },
    { tiles: [[0, 0], [1, 0], [1, 1]], name: 'L-Shape' },
    { tiles: [[0, 0], [1, 0], [0, 1]], name: 'Corner' },
  ],
  medium: [
    { tiles: [[0, 0], [1, 0], [2, 0], [3, 0]], name: 'Line' },
    { tiles: [[0, 0], [1, 0], [2, 0], [2, 1]], name: 'L-Shape' },
    { tiles: [[0, 0], [1, 0], [2, 0], [1, 1]], name: 'T-Shape' },
    { tiles: [[0, 0], [1, 0], [0, 1], [1, 1]], name: 'Square' },
  ],
  large: [
    { tiles: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], name: 'Line' },
    { tiles: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], name: 'L-Shape' },
    { tiles: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]], name: 'T-Shape' },
    { tiles: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]], name: 'S-Shape' },
  ],
  x_large: [
    { tiles: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], name: 'Line' },
    { tiles: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]], name: 'L-Shape' },
    { tiles: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]], name: 'T-Shape' },
    { tiles: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2], [3, 2]], name: 'S-Shape' },
  ],
  huge: [
    { tiles: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]], name: 'Line' },
    { tiles: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]], name: 'L-Shape' },
    { tiles: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1], [2, 2]], name: 'Cross' },
    { tiles: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [3, 2], [4, 2]], name: 'Z-Shape' },
  ],
};

/**
 * Get the tile count for a cargo size class.
 */
export const CARGO_SIZE_TILE_COUNT: Record<CargoSizeClass, number> = {
  tiny: 1,
  x_small: 2,
  small: 3,
  medium: 4,
  large: 5,
  x_large: 6,
  huge: 7,
};

/**
 * Display names for cargo size classes.
 */
export const CARGO_SIZE_LABELS: Record<CargoSizeClass, string> = {
  tiny: 'Tiny (1)',
  x_small: 'X-Small (2)',
  small: 'Small (3)',
  medium: 'Medium (4)',
  large: 'Large (5)',
  x_large: 'X-Large (6)',
  huge: 'Huge (7)',
};

/**
 * Category color mapping for cargo visualization.
 */
export const CARGO_CATEGORY_COLORS: Record<string, string> = {
  'Fuel & Energy': 'var(--color-degraded)', // Amber - hazardous
  'Life Support': 'var(--color-operational)', // Green - essential
  Maintenance: 'var(--color-accent-blue, #58a6ff)', // Blue - utility
  Medical: 'var(--color-critical)', // Red - emergency
  Ordnance: 'var(--color-compromised)', // Orange - dangerous
  Trade: 'var(--color-accent-purple, #a371f7)', // Purple - valuable
  Unknown: 'var(--color-text-muted)', // Gray - unidentified
};

/**
 * Get the color for a cargo category.
 */
export function getCategoryColor(category: string | undefined): string {
  if (!category) return CARGO_CATEGORY_COLORS['Unknown'];
  return CARGO_CATEGORY_COLORS[category] ?? CARGO_CATEGORY_COLORS['Unknown'];
}

/**
 * Rotate shape tiles 90 degrees clockwise, a specified number of times.
 */
export function rotateShape(
  tiles: [number, number][],
  times: number
): [number, number][] {
  let result: [number, number][] = tiles.map(([x, y]) => [x, y]);

  for (let i = 0; i < times % 4; i++) {
    // 90 degree clockwise rotation: (x, y) -> (y, -x)
    result = result.map(([x, y]) => [y, -x]);

    // Normalize to positive coordinates
    const minX = Math.min(...result.map(([x]) => x));
    const minY = Math.min(...result.map(([, y]) => y));
    result = result.map(([x, y]) => [x - minX, y - minY]);
  }

  return result;
}

/**
 * Get all tiles occupied by a cargo piece at a given position.
 */
export function getOccupiedTiles(
  x: number,
  y: number,
  sizeClass: CargoSizeClass,
  shapeVariant: number,
  rotation: number
): [number, number][] {
  const shapes = CARGO_SHAPES[sizeClass];
  const variantIdx = Math.min(shapeVariant, shapes.length - 1);
  const shape = shapes[variantIdx];

  // Apply rotation
  const rotatedTiles = rotateShape(shape.tiles, rotation / 90);

  // Apply position offset
  return rotatedTiles.map(([dx, dy]) => [x + dx, y + dy]);
}

/**
 * Get the shape for a cargo item.
 */
export function getCargoShape(
  sizeClass: CargoSizeClass,
  shapeVariant: number
): PolyominoShape {
  const shapes = CARGO_SHAPES[sizeClass];
  const variantIdx = Math.min(shapeVariant, shapes.length - 1);
  return shapes[variantIdx];
}

/**
 * Get the bounding box of rotated tiles.
 */
export function getShapeBounds(
  tiles: [number, number][]
): { width: number; height: number } {
  const maxX = Math.max(...tiles.map(([x]) => x));
  const maxY = Math.max(...tiles.map(([, y]) => y));
  return { width: maxX + 1, height: maxY + 1 };
}

/**
 * Check if a placement is valid (within bounds and no overlap).
 */
export function checkPlacementValidity(
  x: number,
  y: number,
  sizeClass: CargoSizeClass,
  shapeVariant: number,
  rotation: number,
  bayWidth: number,
  bayHeight: number,
  occupiedTiles: Set<string>
): { valid: boolean; reason?: string } {
  const newTiles = getOccupiedTiles(x, y, sizeClass, shapeVariant, rotation);

  // Check bounds
  for (const [tx, ty] of newTiles) {
    if (tx < 0 || tx >= bayWidth || ty < 0 || ty >= bayHeight) {
      return {
        valid: false,
        reason: `Out of bounds: tile (${tx}, ${ty}) outside bay dimensions`,
      };
    }
  }

  // Check overlap (if occupiedTiles doesn't already exclude this cargo)
  for (const [tx, ty] of newTiles) {
    const key = `${tx},${ty}`;
    if (occupiedTiles.has(key)) {
      return {
        valid: false,
        reason: `Overlaps with existing cargo at (${tx}, ${ty})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Build a set of occupied tile keys from placements.
 */
export function buildOccupiedTilesSet(
  placements: Array<{
    cargo_id: string;
    x: number;
    y: number;
    cargo: { size_class: CargoSizeClass; shape_variant: number };
    rotation: number;
  }>,
  excludeCargoId?: string
): Set<string> {
  const occupied = new Set<string>();

  for (const placement of placements) {
    if (excludeCargoId && placement.cargo_id === excludeCargoId) continue;

    const tiles = getOccupiedTiles(
      placement.x,
      placement.y,
      placement.cargo.size_class,
      placement.cargo.shape_variant,
      placement.rotation
    );

    for (const [tx, ty] of tiles) {
      occupied.add(`${tx},${ty}`);
    }
  }

  return occupied;
}
