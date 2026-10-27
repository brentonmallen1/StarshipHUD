import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePanelBySlug, useSystemStatesMap } from '../hooks/useShipData';
import { useShipContext } from '../contexts/ShipContext';
import { useToast } from '../contexts/ToastContext';
import { useDeepLink } from '../hooks/useDeepLink';
import { useContainerDimensions } from '../hooks/useContainerDimensions';
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { WidgetCreationModal } from '../components/widgets/WidgetCreationModal';
import { WidgetConfigModal } from '../components/widgets/WidgetConfigModal';
import { EditViewToggle } from '../components/EditViewToggle';
import { panelsApi, widgetsApi } from '../services/api';
import { D20Loader } from '../components/ui/D20Loader';
import { EmptyState } from '../components/ui/EmptyState';
import type { WidgetInstance } from '../types';
import {
  GRID_DRAG_CANCEL,
  GRID_MARGIN,
  GRID_PADDING,
  GRID_ROW_HEIGHT,
  fitScale,
  layoutsEqual,
  widgetsToLayout,
  type RGLLayoutItem,
} from '../utils/panelGrid';
import { GridLayout, noCompactor } from 'react-grid-layout/react';
// RGL/resizable base CSS is inlined in PanelView.css to control transitions
import './PanelView.css';

const RESIZE_HANDLES = ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'] as const;
const AUTO_SAVE_DELAY_MS = 1500;

interface PanelViewProps {
  isEditing?: boolean;
}

export function PanelView({ isEditing = false }: PanelViewProps) {
  const { panelSlug } = useParams<{ panelSlug: string }>();
  const { shipId } = useShipContext();
  const { addToast } = useToast();
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

  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<WidgetInstance | null>(null);

  // Use robust container dimensions hook with callback ref pattern
  const { width: gridWidth, height: gridHeight, containerRef, ready } = useContainerDimensions();

  // Handle deep-link navigation and focus
  useDeepLink(panel?.id, panel?.widgets);

  // Layout is derived from server data in the same render as the widgets, so
  // RGL never sees a child without a layout entry (which it would size 1x1).
  const serverLayout = useMemo(
    () => (panel?.widgets ? widgetsToLayout(panel.widgets, !isEditing) : []),
    [panel?.widgets, isEditing]
  );

  // Positions the GM has changed but not saved yet; null = follow the server
  const [localLayout, setLocalLayout] = useState<RGLLayoutItem[] | null>(null);

  const layout = useMemo(() => {
    if (!localLayout) return serverLayout;
    const local = new Map(localLayout.map((item) => [item.i, item]));
    return serverLayout.map((item) => {
      const override = local.get(item.i);
      return override
        ? { ...item, x: override.x, y: override.y, w: override.w, h: override.h }
        : item;
    });
  }, [serverLayout, localLayout]);

  const isDirty = isEditing && localLayout !== null && !layoutsEqual(layout, serverLayout);

  // Refs let async saves read the latest layout instead of a stale closure
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const serverLayoutRef = useRef(serverLayout);
  serverLayoutRef.current = serverLayout;

  const applyLocalLayout = useCallback((newLayout: readonly RGLLayoutItem[]) => {
    setSaveFailed(false);
    setLocalLayout(layoutsEqual(newLayout, serverLayoutRef.current) ? null : [...newLayout]);
  }, []);

  // Drag lifecycle callbacks
  const handleDragStart = useCallback(() => {
    setIsInteracting(true);
  }, []);

  const handleDragStop = useCallback((newLayout: readonly RGLLayoutItem[]) => {
    setIsInteracting(false);
    if (isEditing) applyLocalLayout(newLayout);
  }, [isEditing, applyLocalLayout]);

  // Resize lifecycle callbacks
  const handleResizeStart = useCallback(() => {
    setIsInteracting(true);
  }, []);

  const handleResizeStop = useCallback((newLayout: readonly RGLLayoutItem[]) => {
    setIsInteracting(false);
    if (isEditing) applyLocalLayout(newLayout);
  }, [isEditing, applyLocalLayout]);

  // Generic layout change handler (compaction etc.). RGL also fires this on
  // mount with bookkeeping-only differences, which layoutsEqual ignores.
  const handleLayoutChange = useCallback(
    (newLayout: readonly RGLLayoutItem[]) => {
      if (isInteracting || !isEditing) return;
      applyLocalLayout(newLayout);
    },
    [isEditing, isInteracting, applyLocalLayout]
  );

  // Only one layout save runs at a time; later callers wait and then save
  // whatever is current, so edits made mid-save are never dropped.
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);

  const saveLayout = useCallback(async (): Promise<boolean> => {
    while (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    const snapshot = layoutRef.current;
    if (!panel?.id || layoutsEqual(snapshot, serverLayoutRef.current)) return true;
    const panelId = panel.id;

    const run = (async () => {
      setIsSaving(true);
      try {
        await panelsApi.updateLayout(
          panelId,
          snapshot.map((item) => ({ id: item.i, x: item.x, y: item.y, width: item.w, height: item.h }))
        );
        await refetch();
        // Drop local overrides only if nothing moved while we were saving
        setLocalLayout((current) => (current && layoutsEqual(current, snapshot) ? null : current));
        setSaveFailed(false);
        return true;
      } catch (err) {
        console.error('Failed to save layout:', err);
        setSaveFailed(true);
        addToast({
          message: `Failed to save layout: ${err instanceof Error ? err.message : 'unknown error'}`,
          type: 'error',
        });
        return false;
      } finally {
        setIsSaving(false);
        saveInFlightRef.current = null;
      }
    })();
    saveInFlightRef.current = run;
    return run;
  }, [panel?.id, refetch, addToast]);

  // Auto-save a moment after the last change. After a failure, wait for the
  // next edit or a manual save rather than retrying in a loop.
  useEffect(() => {
    if (!isDirty || isInteracting || saveFailed) return;
    const timeout = setTimeout(() => {
      void saveLayout();
    }, AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [isDirty, isInteracting, saveFailed, layout, saveLayout]);

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

    // Persist pending moves first so placement was computed against real positions
    if (!(await saveLayout())) return;

    await widgetsApi.create(panel.id, {
      widget_type: widgetType,
      x,
      y,
      width,
      height,
      config: {},
      bindings: {},
    });
    await refetch();
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

  const gridConfig = useMemo(
    () => ({
      cols: panel?.grid_columns ?? 24,
      rowHeight: GRID_ROW_HEIGHT,
      margin: GRID_MARGIN,
      containerPadding: GRID_PADDING,
      maxRows: Infinity, // Allow unlimited vertical sizing in the editor
    }),
    [panel?.grid_columns]
  );
  const dragConfig = useMemo(
    () => ({ enabled: isEditing, bounded: false, cancel: GRID_DRAG_CANCEL }),
    [isEditing]
  );
  const resizeConfig = useMemo(() => ({ enabled: isEditing, handles: RESIZE_HANDLES }), [isEditing]);

  // Player panels must never scroll: shrink the whole grid uniformly to fit
  const scale = isEditing ? 1 : fitScale(layout, gridHeight);

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

  return (
    <div className={`panel-view ${isEditing ? 'editing' : ''}`}>
      <div ref={containerRef as React.RefCallback<HTMLDivElement>} className="panel-grid-container">
        {ready && panel.widgets.length === 0 && !isEditing && (
          <EmptyState
            icon="◇"
            title="No widgets configured"
            description="This panel has no widgets yet"
          />
        )}
        {ready && (panel.widgets.length > 0 || isEditing) && (
          <div
            className="panel-grid-scaler"
            style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
          >
            <GridLayout
              className="panel-grid"
              layout={layout}
              width={gridWidth}
              compactor={panel.compact_type === 'none' ? noCompactor : undefined}
              gridConfig={gridConfig}
              dragConfig={dragConfig}
              resizeConfig={resizeConfig}
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
          </div>
        )}
      </div>

      {isEditing && (
        <div className="edit-toolbar">
          <span className="edit-indicator">
            EDIT MODE{' '}
            {isSaving ? (
              <span className="saving-indicator">• Saving...</span>
            ) : saveFailed ? (
              <span className="unsaved-indicator">• SAVE FAILED</span>
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
