import { getWidgetType } from '../components/widgets/widgetRegistry';
import type { WidgetInstance } from '../types';

/**
 * Shared react-grid-layout settings for every panel renderer (player view,
 * panel editor, GM dashboards) so they always lay out identically.
 */
export const GRID_ROW_HEIGHT = 25;
export const GRID_MARGIN: [number, number] = [8, 8];
export const GRID_PADDING: [number, number] = [8, 8];

// Rows the editor offers for placement/sizing. 24 rows (~800px) fits a 1080p
// player screen at full size; taller panels are scaled down to fit.
export const GRID_EDITOR_ROWS = 48;

// Elements inside a widget that should receive clicks instead of starting a drag
export const GRID_DRAG_CANCEL = 'input, textarea, select, button, a, [contenteditable="true"], .no-drag';

// RGL v2 LayoutItem type
export interface RGLLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export function widgetsToLayout(widgets: WidgetInstance[], isStatic: boolean): RGLLayoutItem[] {
  return widgets.map((widget) => {
    const widgetType = getWidgetType(widget.widget_type);
    return {
      i: widget.id,
      x: widget.x,
      y: widget.y,
      w: widget.width,
      h: widget.height,
      minW: widgetType?.minWidth ?? 1,
      minH: widgetType?.minHeight ?? 1,
      static: isStatic,
    };
  });
}

/** Compare only position/size; RGL adds bookkeeping keys (moved, isDraggable...) */
export function layoutsEqual(a: readonly RGLLayoutItem[], b: readonly RGLLayoutItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((item) => [item.i, item]));
  return a.every((item) => {
    const other = byId.get(item.i);
    return (
      !!other && other.x === item.x && other.y === item.y && other.w === item.w && other.h === item.h
    );
  });
}

/** Pixel height of the laid-out grid, including container padding. */
export function layoutPixelHeight(layout: readonly RGLLayoutItem[]): number {
  const rows = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  if (rows === 0) return 0;
  return rows * GRID_ROW_HEIGHT + (rows - 1) * GRID_MARGIN[1] + GRID_PADDING[1] * 2;
}

/** Uniform scale (<= 1) that makes the grid fit the available height. */
export function fitScale(layout: readonly RGLLayoutItem[], availableHeight: number): number {
  const contentHeight = layoutPixelHeight(layout);
  if (contentHeight === 0 || availableHeight <= 0) return 1;
  return Math.min(1, availableHeight / contentHeight);
}
