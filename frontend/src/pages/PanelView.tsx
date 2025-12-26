import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePanel, useSystemStatesMap } from '../hooks/useShipData';
import { useDeepLink } from '../hooks/useDeepLink';
// import { useRole } from '../contexts/RoleContext'; // Will be used in Phase 2
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { WidgetCreationModal } from '../components/widgets/WidgetCreationModal';
import { WidgetConfigModal } from '../components/widgets/WidgetConfigModal';
import { panelsApi, widgetsApi } from '../services/api';
import { getWidgetType } from '../components/widgets/widgetRegistry';
import type { WidgetInstance } from '../types';
import ReactGridLayout, { useContainerWidth, type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './PanelView.css';

// Use v2 API's LayoutItem type
type RGLLayout = LayoutItem;

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
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<WidgetInstance | null>(null);
  const [layout, setLayout] = useState<RGLLayout[]>([]);

  // Use RGL's built-in width hook instead of manual ResizeObserver
  const { width: gridWidth, containerRef, mounted } = useContainerWidth();

  // Handle deep-link navigation and focus
  useDeepLink(panelId, panel?.widgets);

  // Convert widgets to RGL layout format
  const widgetsToLayout = useCallback((widgets: WidgetInstance[], editing: boolean): RGLLayout[] => {
    console.log('widgetsToLayout - Converting widgets from DB:', widgets.map(w => ({
      id: w.id, type: w.widget_type, x: w.x, y: w.y, w: w.width, h: w.height
    })));

    return widgets.map((widget) => {
      const widgetType = getWidgetType(widget.widget_type);
      const minH = widgetType?.minHeight ?? 1;
      const minW = widgetType?.minWidth ?? 1;

      return {
        i: widget.id,
        x: widget.x,
        y: widget.y,
        w: widget.width,
        h: widget.height,
        minW: minW,
        minH: minH,
        maxH: Infinity,
        maxW: Infinity,
        static: !editing,
      };
    });
  }, []);

  // Update layout when panel changes (but not when user is actively editing)
  useEffect(() => {
    if (panel?.widgets && !isDirty) {
      const newLayout = widgetsToLayout(panel.widgets, isEditing);
      console.log('useEffect - Setting layout from panel widgets:', newLayout);
      setLayout(newLayout);
    }
  }, [panel?.widgets, widgetsToLayout, isDirty]);

  // Update static property when isEditing changes (without resetting positions)
  useEffect(() => {
    setLayout((currentLayout) =>
      currentLayout.map((item) => ({
        ...item,
        static: !isEditing,
      }))
    );
  }, [isEditing]);

  // Handle layout changes from RGL
  const handleLayoutChange = useCallback((newLayout: RGLLayout[]) => {
    // Only update layout in edit mode
    if (!isEditing) return;

    setLayout(newLayout);
    setIsDirty(true);
  }, [isEditing]);

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

      setIsDirty(false);
      await refetch();
      console.log('handleSave - Refetched panel data');
    } catch (err) {
      console.error('Failed to save layout:', err);
      alert('Failed to save layout changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Discard layout changes
  const handleDiscard = () => {
    if (!isDirty || !window.confirm('Discard unsaved changes?')) return;

    // Reset layout to original panel data
    if (panel?.widgets) {
      setLayout(widgetsToLayout(panel.widgets, isEditing));
    }
    setIsDirty(false);
  };

  // Navigate back to panel list
  const handleExit = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Exit anyway?')) {
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

  if (isLoading) {
    return <div className="loading">Loading panel...</div>;
  }

  if (error || !panel) {
    return <div className="error">Failed to load panel: {error?.message}</div>;
  }

  return (
    <div className={`panel-view ${isEditing ? 'editing' : ''}`}>
      <div ref={containerRef as any} className="panel-grid-container">
        {mounted && (
          <ReactGridLayout
            className="panel-grid"
            layout={layout}
            width={gridWidth}
            gridConfig={{
              cols: panel.grid_columns,
              rowHeight: 50,
              margin: [10, 10],
              containerPadding: [10, 10],
            }}
            dragConfig={{
              enabled: isEditing,
            }}
            resizeConfig={{
              enabled: isEditing,
              handles: ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'],
            }}
            onLayoutChange={(newLayout) => handleLayoutChange([...newLayout])}
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
          </ReactGridLayout>
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
          <button className="btn" onClick={handleDiscard} disabled={!isDirty}>
            Discard
          </button>
          <button className="btn" onClick={handleExit}>
            Exit
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {showWidgetModal && panel && (
        <WidgetCreationModal
          panelId={panel.id}
          gridColumns={panel.grid_columns}
          gridRows={panel.grid_rows}
          existingWidgets={panel.widgets ?? []}
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
