import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePanelBySlug, useSystemStatesMap } from '../hooks/useShipData';
import { useShipContext } from '../contexts/ShipContext';
import { useDeepLink } from '../hooks/useDeepLink';
import { useContainerDimensions } from '../hooks/useContainerDimensions';
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { WidgetCreationModal } from '../components/widgets/WidgetCreationModal';
import { WidgetConfigModal } from '../components/widgets/WidgetConfigModal';
import { EditViewToggle } from '../components/EditViewToggle';
import { panelsApi, widgetsApi } from '../services/api';
import { getWidgetType } from '../components/widgets/widgetRegistry';
import { D20Loader } from '../components/ui/D20Loader';
import { EmptyState } from '../components/ui/EmptyState';
import type { WidgetInstance } from '../types';
import { GridLayout, noCompactor } from 'react-grid-layout/react';
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
  const { panelSlug } = useParams<{ panelSlug: string }>();
  const { shipId } = useShipContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: panel, isLoading, error, refetch } = usePanelBySlug(panelSlug ?? '');
  const { data: systemStates } = useSystemStatesMap();

  // Get return context from navigation state for smart "Done" button behavior
  const returnTo = (location.state as { returnTo?: string })?.returnTo;

  // Compute canEditData: true for both players and GMs (everyone can edit data)
  const canEditData = true; // For now, all roles can edit data

  // Determine if this is a GM-only panel (for smart View button navigation)
  const isGmOnlyPanel = useMemo(() => {
    if (!panel?.role_visibility) return false;
    return panel.role_visibility.includes('gm') && !panel.role_visibility.includes('player');
  }, [panel?.role_visibility]);

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<WidgetInstance | null>(null);
  const [layout, setLayout] = useState<RGLLayout>([]);

  // Use robust container dimensions hook with callback ref pattern
  const { width: gridWidth, containerRef, ready } = useContainerDimensions();

  // Handle deep-link navigation and focus
  useDeepLink(panel?.id, panel?.widgets);

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

  // Auto-save layout after a delay when dirty
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only auto-save in edit mode when there are unsaved changes
    if (!isDirty || !isEditing || !panel?.id || isSaving) return;

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (1.5 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (!panel?.id || !isDirty) return;

      setIsSaving(true);
      try {
        const layoutData = layout.map((item) => ({
          id: item.i,
          x: item.x,
          y: item.y,
          width: item.w,
          height: item.h,
        }));

        await panelsApi.updateLayout(panel.id, layoutData);
        await refetch();
        setIsDirty(false);
      } catch (err) {
        console.error('Failed to auto-save layout:', err);
      } finally {
        setIsSaving(false);
      }
    }, 1500);

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [isDirty, isEditing, panel?.id, layout, isSaving, refetch]);

  // Save layout changes - returns true if successful (or no changes to save)
  const saveLayout = async (): Promise<boolean> => {
    if (!panel?.id || !isDirty) return true; // No changes = success

    setIsSaving(true);
    try {
      const layoutData = layout.map((item) => ({
        id: item.i,
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h,
      }));

      await panelsApi.updateLayout(panel.id, layoutData);
      await refetch();
      setIsDirty(false);
      return true;
    } catch (err) {
      console.error('Failed to save layout:', err);
      alert('Failed to save layout changes');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Manual save button handler
  const handleSave = () => saveLayout();

  // Navigate back based on where user came from
  const handleExit = () => {
    if (isDirty && !window.confirm('You have unsaved layout changes. Exit anyway?')) {
      return;
    }
    // Smart return: go back to origin context
    if (returnTo === 'view') {
      navigate(`/${shipId}/panel/${panelSlug}`);
    } else if (returnTo === 'dashboard') {
      navigate(`/${shipId}/admin`);
    } else {
      // Default: AdminPanels page (existing behavior)
      navigate(`/${shipId}/admin/panels`);
    }
  };

  // Create new widget
  const handleCreateWidget = async (
    widgetType: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    if (!panel?.id) return;

    await widgetsApi.create(panel.id, {
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
    return (
      <div className="loading-screen">
        <D20Loader size={120} speed={6.8} />
        <span className="loading-screen__text">Loading panel...</span>
      </div>
    );
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
        {ready && layoutReady && panel.widgets.length === 0 && !isEditing && (
          <EmptyState
            icon="◇"
            title="No widgets configured"
            description="This panel has no widgets yet"
          />
        )}
        {ready && layoutReady && (panel.widgets.length > 0 || isEditing) && (
          <GridLayout
            className="panel-grid"
            layout={layout}
            width={gridWidth}
            compactor={panel.compact_type === 'none' ? noCompactor : undefined}
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
            EDIT MODE{' '}
            {isSaving ? (
              <span className="saving-indicator">• Saving...</span>
            ) : isDirty ? (
              <span className="unsaved-indicator">• UNSAVED</span>
            ) : null}
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
          {/* Inline View button - saves and switches to view mode */}
          {panelSlug && (
            <EditViewToggle
              panelSlug={panelSlug}
              isEditing={isEditing}
              onBeforeSwitch={saveLayout}
              returnTo={returnTo}
              isGmOnlyPanel={isGmOnlyPanel}
              panelId={panel?.id}
            />
          )}
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

      {/* Floating edit toggle for GMs (view mode only - edit mode has inline button) */}
      {!isEditing && panelSlug && (
        <EditViewToggle panelSlug={panelSlug} isEditing={false} />
      )}
    </div>
  );
}
