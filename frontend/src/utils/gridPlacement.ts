import type { WidgetInstance } from '../types';

/**
 * Find the next available position on the grid for a new widget.
 * Scans the grid row by row, left to right, looking for the first spot
 * where the widget can fit without overlapping existing widgets.
 * Grid extends infinitely in the Y direction.
 */
export function findNextAvailablePosition(
  existingWidgets: WidgetInstance[],
  gridColumns: number,
  gridRows: number,
  widgetWidth: number,
  widgetHeight: number
): { x: number; y: number } {
  // Find the maximum Y position we need to search
  // Use at least gridRows, but extend if widgets go beyond
  const maxY = Math.max(
    gridRows,
    ...existingWidgets.map((w) => w.y + w.height),
    0
  );

  // Scan positions to find first available spot
  // We'll check up to maxY + widgetHeight to allow placing below existing widgets
  for (let y = 0; y <= maxY + widgetHeight; y++) {
    for (let x = 0; x <= gridColumns - widgetWidth; x++) {
      // Check if this position overlaps with any existing widget
      const overlaps = checkOverlap(x, y, widgetWidth, widgetHeight, existingWidgets);

      if (!overlaps) {
        return { x, y };
      }
    }
  }

  // Fallback: place at bottom of existing content
  return {
    x: 0,
    y: maxY,
  };
}

/**
 * Check if a widget at a given position overlaps with any existing widgets.
 */
export function checkOverlap(
  x: number,
  y: number,
  width: number,
  height: number,
  existingWidgets: WidgetInstance[],
  excludeWidgetId?: string
): boolean {
  return existingWidgets.some((widget) => {
    if (excludeWidgetId && widget.id === excludeWidgetId) {
      return false;
    }

    // Check if rectangles overlap
    return !(
      x >= widget.x + widget.width ||
      x + width <= widget.x ||
      y >= widget.y + widget.height ||
      y + height <= widget.y
    );
  });
}
