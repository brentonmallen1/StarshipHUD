import { useState, useCallback, useRef, useEffect } from 'react';
import type { WidgetInstance } from '../types';

type EditorMode = 'move' | 'resize';

interface DragState {
  mode: EditorMode;
  widgetId: string;
  startMouseX: number;
  startMouseY: number;
  currentMouseX: number;
  currentMouseY: number;
  startWidgetX: number;
  startWidgetY: number;
  startWidth: number;
  startHeight: number;
  previewX?: number;
  previewY?: number;
  previewWidth?: number;
  previewHeight?: number;
}

export function usePanelEditor(
  widgets: WidgetInstance[],
  gridColumns: number,
  gridRows: number,
  onWidgetMove?: (widgetId: string, x: number, y: number) => void,
  onWidgetResize?: (widgetId: string, width: number, height: number) => void
) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [localWidgets, setLocalWidgets] = useState<WidgetInstance[]>(widgets);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync local widgets when source widgets change
  useEffect(() => {
    setLocalWidgets(widgets);
  }, [widgets]);

  // Start dragging/moving a widget
  const handleMouseDown = useCallback(
    (widgetId: string, event: React.MouseEvent, mode: EditorMode = 'move') => {
      event.preventDefault();
      event.stopPropagation();

      const widget = localWidgets.find((w) => w.id === widgetId);
      if (!widget) return;

      setDragState({
        mode,
        widgetId,
        startMouseX: event.clientX,
        startMouseY: event.clientY,
        currentMouseX: event.clientX,
        currentMouseY: event.clientY,
        startWidgetX: widget.x,
        startWidgetY: widget.y,
        startWidth: widget.width,
        startHeight: widget.height,
      });
    },
    [localWidgets]
  );

  // Update drag position or resize
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!dragState || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const cellWidth = rect.width / gridColumns;

      // Use a fixed cell height based on grid design
      // This prevents cell height from changing as container grows
      // Assume roughly 100px per grid row as a reasonable cell size
      const cellHeight = 100;

      const deltaX = event.clientX - dragState.startMouseX;
      const deltaY = event.clientY - dragState.startMouseY;

      if (dragState.mode === 'move') {
        // Calculate preview position (snapped to grid)
        const gridDeltaX = Math.round(deltaX / cellWidth);
        const gridDeltaY = Math.round(deltaY / cellHeight);

        const previewX = Math.max(0, Math.min(dragState.startWidgetX + gridDeltaX, gridColumns - dragState.startWidth));
        const previewY = Math.max(0, dragState.startWidgetY + gridDeltaY);

        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentMouseX: event.clientX,
                currentMouseY: event.clientY,
                previewX,
                previewY,
              }
            : null
        );
      } else if (dragState.mode === 'resize') {
        // Calculate preview size (snapped to grid)
        const gridDeltaX = Math.round(deltaX / cellWidth);
        const gridDeltaY = Math.round(deltaY / cellHeight);

        const previewWidth = Math.max(1, Math.min(dragState.startWidth + gridDeltaX, gridColumns - dragState.startWidgetX));
        const previewHeight = Math.max(1, dragState.startHeight + gridDeltaY);

        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentMouseX: event.clientX,
                currentMouseY: event.clientY,
                previewWidth,
                previewHeight,
              }
            : null
        );
      }
    },
    [dragState, gridColumns, gridRows]
  );

  // Finish dragging or resizing
  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    const widget = localWidgets.find((w) => w.id === dragState.widgetId);
    if (!widget) {
      setDragState(null);
      return;
    }

    if (dragState.mode === 'move') {
      const finalX = dragState.previewX ?? dragState.startWidgetX;
      const finalY = dragState.previewY ?? dragState.startWidgetY;

      // Only update if position actually changed
      if (finalX !== dragState.startWidgetX || finalY !== dragState.startWidgetY) {
        // Update local widgets immediately for smooth UX
        setLocalWidgets((prev) =>
          prev.map((w) =>
            w.id === dragState.widgetId ? { ...w, x: finalX, y: finalY } : w
          )
        );

        // Notify parent
        if (onWidgetMove) {
          onWidgetMove(dragState.widgetId, finalX, finalY);
        }
      }
    } else if (dragState.mode === 'resize') {
      const finalWidth = dragState.previewWidth ?? dragState.startWidth;
      const finalHeight = dragState.previewHeight ?? dragState.startHeight;

      // Only update if size actually changed
      if (finalWidth !== dragState.startWidth || finalHeight !== dragState.startHeight) {
        // Update local widgets immediately for smooth UX
        setLocalWidgets((prev) =>
          prev.map((w) =>
            w.id === dragState.widgetId
              ? { ...w, width: finalWidth, height: finalHeight }
              : w
          )
        );

        // Notify parent
        if (onWidgetResize) {
          onWidgetResize(dragState.widgetId, finalWidth, finalHeight);
        }
      }
    }

    setDragState(null);
  }, [dragState, localWidgets, onWidgetMove, onWidgetResize]);

  // Set up global mouse listeners when dragging
  const startDrag = useCallback(
    (widgetId: string, event: React.MouseEvent, mode: EditorMode = 'move') => {
      handleMouseDown(widgetId, event, mode);

      const onMove = (e: MouseEvent) => handleMouseMove(e);
      const onUp = () => {
        handleMouseUp();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [handleMouseDown, handleMouseMove, handleMouseUp]
  );

  // Convenience methods for move and resize
  const startMove = useCallback(
    (widgetId: string, event: React.MouseEvent) => {
      startDrag(widgetId, event, 'move');
    },
    [startDrag]
  );

  const startResize = useCallback(
    (widgetId: string, event: React.MouseEvent) => {
      startDrag(widgetId, event, 'resize');
    },
    [startDrag]
  );

  // Get transform for a widget during drag
  const getWidgetTransform = useCallback(
    (widgetId: string): string | undefined => {
      if (!dragState || dragState.widgetId !== widgetId || dragState.mode !== 'move') {
        return undefined;
      }

      if (!containerRef.current) return undefined;

      const deltaX = dragState.currentMouseX - dragState.startMouseX;
      const deltaY = dragState.currentMouseY - dragState.startMouseY;

      return `translate(${deltaX}px, ${deltaY}px)`;
    },
    [dragState]
  );

  // Get preview position/size for a widget
  const getWidgetPreview = useCallback(
    (widgetId: string) => {
      if (!dragState || dragState.widgetId !== widgetId) {
        return null;
      }

      if (dragState.mode === 'move') {
        return {
          x: dragState.previewX ?? dragState.startWidgetX,
          y: dragState.previewY ?? dragState.startWidgetY,
          width: dragState.startWidth,
          height: dragState.startHeight,
        };
      } else {
        return {
          x: dragState.startWidgetX,
          y: dragState.startWidgetY,
          width: dragState.previewWidth ?? dragState.startWidth,
          height: dragState.previewHeight ?? dragState.startHeight,
        };
      }
    },
    [dragState]
  );

  return {
    containerRef,
    widgets: localWidgets,
    dragState,
    isDragging: dragState !== null,
    isResizing: dragState?.mode === 'resize',
    startMove,
    startResize,
    getWidgetTransform,
    getWidgetPreview,
  };
}
