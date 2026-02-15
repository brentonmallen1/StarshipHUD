import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePanel, useSystemStatesMap } from '../hooks/useShipData';
import { useDeepLink } from '../hooks/useDeepLink';
import { useContainerDimensions } from '../hooks/useContainerDimensions';
// import { useRole } from '../contexts/RoleContext'; // Will be used in Phase 2
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { WidgetCreationModal } from '../components/widgets/WidgetCreationModal';
import { WidgetConfigModal } from '../components/widgets/WidgetConfigModal';
import { panelsApi, widgetsApi } from '../services/api';
import { getWidgetType } from '../components/widgets/widgetRegistry';
import type { WidgetInstance } from '../types';
import { GridLayout } from 'react-grid-layout/react';
// RGL/resizable base CSS is inlined in PanelView.css to control transitions
import './PanelView.css';

// RGL v2 LayoutItem type
interface RGLLayoutItem {
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

// Mutable array - RGL expects to be able to modify layout
type RGLLayout = RGLLayoutItem[];

interface PanelViewProps {
  isEditing?: boolean;
}

export function PanelView({ isEditing = false }: PanelViewProps) {
  const { panelId } = useParams<{ panelId: string }>();
  const navigate = useNavigate();
  const { data: panel, isLoading, error, refetch } = usePanel(panelId ?? '');
  const { data: systemStates } = useSystemStatesMap();
  // const { role } = useRole(); // Will be used in Phase 2 for permission checks

  // Compute canEditData: true for both players and GMs (everyone can edit data)
  // In Phase 2, we'll use role-based permissions here
  const canEditData = true; // For now, all roles can edit data

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<WidgetInstance | null>(null);
  const [layout, setLayout] = useState<RGLLayout>([]);

  // Use robust container dimensions hook with callback ref pattern
  const { width: gridWidth, containerRef, ready } = useContainerDimensions();

  // Handle deep-link navigation and focus
  useDeepLink(panelId, panel?.widgets);

  // Single consolidated effect to manage layout state from server
  // Guards prevent updates during interactions or when user has unsaved changes
  useEffect(() => {
    // Never update layout during active drag/resize
    if (isInteracting) return;

    // Don't override user's unsaved changes
    if (isDirty) return;

    // Sync layout from server data
    if (panel?.widgets) {
      const newLayout = panel.widgets.map((widget): RGLLayoutItem => {
        const widgetType = getWidgetType(widget.widget_type);
        return {
          i: widget.id,
          x: widget.x,
          y: widget.y,
          w: widget.width,
          h: widget.height,
          minW: widgetType?.minWidth ?? 1,
          minH: widgetType?.minHeight ?? 1,
          static: !isEditing,
        };
      });
      setLayout(newLayout);
    }
  }, [panel?.widgets, isDirty, isInteracting, isEditing]);

  // Drag lifecycle callbacks
  const handleDragStart = useCallback(() => {
    setIsInteracting(true);
  }, []);

  const handleDragStop = useCallback((newLayout: readonly RGLLayoutItem[]) => {
    setIsInteracting(false);
    if (isEditing) {
      setLayout([...newLayout]); // Create mutable copy
      setIsDirty(true);
    }
  }, [isEditing]);

  // Resize lifecycle callbacks
  const handleResizeStart = useCallback(() => {
    setIsInteracting(true);
  }, []);

  const handleResizeStop = useCallback((newLayout: readonly RGLLayoutItem[]) => {
    setIsInteracting(false);
    if (isEditing) {
      setLayout([...newLayout]); // Create mutable copy
      setIsDirty(true);
    }
  }, [isEditing]);

  // Generic layout change handler (for edge cases not covered by drag/resize)
  const handleLayoutChange = useCallback(
    (newLayout: readonly RGLLayoutItem[]) => {
      // Skip if this came from drag/resize (those have their own handlers)
      if (isInteracting) return;
      // Only respond in edit mode
      if (!isEditing) return;

      setLayout([...newLayout]); // Create mutable copy
      setIsDirty(true);
    },
    [isEditing, isInteracting]
  );

  // Save layout changes
  const handleSave = async () => {
    if (!panelId || !isDirty) return;

    setIsSaving(true);
    try {
      const layoutData = layout.map((item) => ({
        id: item.i,
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h,
      }));

      console.log('handleSave - Saving layout to backend:', layoutData);
      const result = await panelsApi.updateLayout(panelId, layoutData);
      console.log('handleSave - Save result:', result);

      // IMPORTANT: Refetch FIRST, then set isDirty to false
      // This ensures the useEffect gets fresh data from the server
      // before it runs (triggered by isDirty changing to false)
      await refetch();
      console.log('handleSave - Refetched panel data');
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
      alert('Failed to save layout changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Navigate back to panel list
  const handleExit = () => {
    if (isDirty && !window.confirm('You have unsaved layout changes. Exit anyway?')) {
      return;
    }
    navigate('/admin/panels');
  };

  // Create new widget
  const handleCreateWidget = async (
    widgetType: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    if (!panelId) return;

    await widgetsApi.create(panelId, {
      widget_type: widgetType,
      x,
      y,
      width,
      height,
      config: {},
      bindings: {},
    });

    // Reload the page to ensure RGL renders the new widget with correct dimensions
    // This is a workaround for a persistent race condition where RGL assigns 1x1
    // defaults to new children despite our layout having correct dimensions
    window.location.reload();
  };

  // Update widget config
  const handleUpdateWidget = async (updates: Partial<WidgetInstance>) => {
    if (!selectedWidget) return;

    await widgetsApi.update(selectedWidget.id, updates);
    await refetch();
    setSelectedWidget(null);
  };

  // Delete widget
  const handleDeleteWidget = async () => {
    if (!selectedWidget) return;

    await widgetsApi.delete(selectedWidget.id);
    await refetch();
    setSelectedWidget(null);
  };

  // Handle widget config changes (for runtime config updates like contact selection)
  const handleWidgetConfigChange = useCallback(
    async (widgetId: string, config: Record<string, unknown>) => {
      try {
        await widgetsApi.update(widgetId, { config });
        // Don't refetch the entire panel - just let the widget manage its own state
        // The next panel load will have the persisted config
      } catch (err) {
        console.error('Failed to save widget config:', err);
      }
    },
    []
  );

  if (isLoading) {
    return <div className="loading">Loading panel...</div>;
  }

  if (error || !panel) {
    return <div className="error">Failed to load panel: {error?.message}</div>;
  }

  // Prevent RGL from rendering with empty layout when widgets exist
  // This fixes the initial load race condition where RGL assigns 1x1 defaults
  // New widgets are handled by adding layout entries synchronously in handleCreateWidget
  const layoutReady = layout.length > 0 || panel.widgets.length === 0;

  return (
    <div className={`panel-view ${isEditing ? 'editing' : ''}`}>
      <div ref={containerRef as React.RefCallback<HTMLDivElement>} className="panel-grid-container">
        {ready && layoutReady && (
          <GridLayout
            className="panel-grid"
            layout={layout}
            width={gridWidth}
            // compactor={noCompactor}
            gridConfig={{
              cols: panel.grid_columns,
              rowHeight: 25,
              margin: [8, 8] as [number, number],
              containerPadding: [8, 8] as [number, number],
              maxRows: Infinity,  // Allow unlimited vertical sizing
            }}
            dragConfig={{
              enabled: isEditing,
              bounded: false,
            }}
            resizeConfig={{
              enabled: isEditing,
              handles: ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'],
            }}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            onResizeStart={handleResizeStart}
            onResizeStop={handleResizeStop}
            onLayoutChange={handleLayoutChange}
          >
            {panel.widgets.map((widget) => (
              <div
                key={widget.id}
                className="widget-container"
                onDoubleClick={
                  isEditing
                    ? (e) => {
                        e.stopPropagation();
                        setSelectedWidget(widget);
                      }
                    : undefined
                }
              >
                <WidgetRenderer
                  instance={widget}
                  systemStates={systemStates}
                  isEditing={isEditing}
                  isSelected={false}
                  canEditData={canEditData}
                  onConfigChange={(config) => handleWidgetConfigChange(widget.id, config)}
                />
                {isEditing && (
                  <button
                    className="widget-config-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWidget(widget);
                    }}
                  >
                    ⚙
                  </button>
                )}
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      {isEditing && (
        <div className="edit-toolbar">
          <span className="edit-indicator">
            EDIT MODE {isDirty && <span className="unsaved-indicator">• UNSAVED</span>}
          </span>
          <button className="btn" onClick={() => setShowWidgetModal(true)}>
            + Add Widget
          </button>
          <button className="btn" onClick={handleExit}>
            Done
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      )}

      {showWidgetModal && panel && (
        <WidgetCreationModal
          panelId={panel.id}
          gridColumns={panel.grid_columns}
          gridRows={panel.grid_rows}
          existingWidgets={panel.widgets ?? []}
          stationGroup={panel.station_group}
          onClose={() => setShowWidgetModal(false)}
          onCreate={handleCreateWidget}
        />
      )}

      {selectedWidget && (
        <WidgetConfigModal
          widget={selectedWidget}
          onClose={() => setSelectedWidget(null)}
          onSave={handleUpdateWidget}
          onDelete={handleDeleteWidget}
        />
      )}
    </div>
  );
}
