import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePanels, usePanel, useSystemStatesMap } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import { WidgetRenderer } from '../../components/widgets/WidgetRenderer';
import { PanelCreationModal } from '../../components/PanelCreationModal';
import { panelsApi, widgetsApi } from '../../services/api';
import { getWidgetType } from '../../components/widgets/widgetRegistry';
import { GridLayout } from 'react-grid-layout/react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import type { Role, StationGroup } from '../../types';
// RGL/resizable base CSS is inlined in PanelView.css to control transitions
import './GMDashboard.css';

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

export function GMDashboard() {
  const shipId = useCurrentShipId();
  const { data: panels, isLoading: panelsLoading, refetch: refetchPanels } = usePanels();
  const { data: systemStates } = useSystemStatesMap();
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter for GM-only dashboard panels
  const gmDashboards = useMemo(() => {
    if (!panels) return [];
    return panels.filter(
      (p) => p.role_visibility.includes('gm') && !p.role_visibility.includes('player')
    );
  }, [panels]);

  // Auto-select first tab or fix stale selection
  useEffect(() => {
    if (gmDashboards.length === 0) {
      setActiveTabId(null);
      return;
    }
    if (!activeTabId || !gmDashboards.find((d) => d.id === activeTabId)) {
      setActiveTabId(gmDashboards[0].id);
    }
  }, [gmDashboards, activeTabId]);

  // Fetch active panel with widgets
  const {
    data: panelWithWidgets,
    isLoading: panelLoading,
    error: panelError,
  } = usePanel(activeTabId ?? '');

  const { width: gridWidth, containerRef, ready } = useContainerDimensions();

  // Handle widget config changes
  const handleWidgetConfigChange = useCallback(
    async (widgetId: string, config: Record<string, unknown>) => {
      try {
        await widgetsApi.update(widgetId, { config });
      } catch (err) {
        console.error('Failed to save widget config:', err);
      }
    },
    []
  );

  // Handle creating a new dashboard
  const handleCreateDashboard = async (data: {
    name: string;
    station_group: StationGroup;
    description?: string;
    grid_columns: number;
    grid_rows: number;
    role_visibility: Role[];
  }) => {
    const newPanel = await panelsApi.create({ ...data, ship_id: shipId ?? '' });
    await refetchPanels();
    setActiveTabId(newPanel.id);
    setShowCreateModal(false);
  };

  // Build layout from widgets
  const layout = useMemo(() => {
    if (!panelWithWidgets?.widgets) return [];
    return panelWithWidgets.widgets.map((widget): RGLLayoutItem => {
      const widgetType = getWidgetType(widget.widget_type);
      return {
        i: widget.id,
        x: widget.x,
        y: widget.y,
        w: widget.width,
        h: widget.height,
        minW: widgetType?.minWidth ?? 1,
        minH: widgetType?.minHeight ?? 1,
        static: true,
      };
    });
  }, [panelWithWidgets?.widgets]);

  if (panelsLoading) {
    return (
      <div className="gm-dashboards">
        <div className="gm-dashboards-tabbar">
          <div className="gm-dashboards-tabs" />
        </div>
        <LoadingSpinner message="Loading dashboards" />
      </div>
    );
  }

  const panel = panelWithWidgets;
  const layoutReady = panel && (layout.length > 0 || panel.widgets.length === 0);

  return (
    <div className="gm-dashboards">
      {/* Tab bar */}
      <div className="gm-dashboards-tabbar">
        <div className="gm-dashboards-tabs">
          {gmDashboards.length === 0 ? (
            <span className="gm-dashboards-empty-label">No dashboards configured</span>
          ) : (
            gmDashboards.map((dash) => (
              <button
                key={dash.id}
                className={`gm-dashboards-tab ${dash.id === activeTabId ? 'active' : ''}`}
                onClick={() => setActiveTabId(dash.id)}
              >
                {dash.name}
              </button>
            ))
          )}
        </div>
        <div className="gm-dashboards-actions">
          {activeTabId && (
            <Link to={`/admin/panels/${activeTabId}`} className="gm-dashboards-customize">
              Customize
            </Link>
          )}
          <button
            className="gm-dashboards-add"
            onClick={() => setShowCreateModal(true)}
            title="Create new dashboard"
          >
            +
          </button>
        </div>
      </div>

      {/* Content area */}
      {gmDashboards.length === 0 ? (
        <div className="gm-dashboards-content gm-dashboards-content--empty">
          <p>Create a GM-only panel to build your first dashboard.</p>
          <p className="empty-hint">
            Dashboards are panels with GM-only visibility. Add widgets to track ship state,
            scenarios, and more.
          </p>
        </div>
      ) : panelLoading ? (
        <LoadingSpinner message="Loading dashboard" />
      ) : panelError || !panel ? (
        <div className="gm-dashboards-error">
          Failed to load dashboard: {panelError?.message}
        </div>
      ) : (
        <div
          ref={containerRef as React.RefCallback<HTMLDivElement>}
          className="gm-dashboards-content"
        >
          {ready && layoutReady && (
            <GridLayout
              className="gm-dashboards-grid"
              layout={layout}
              width={gridWidth}
              gridConfig={{
                cols: panel.grid_columns,
                rowHeight: 25,
                margin: [8, 8] as [number, number],
                containerPadding: [8, 8] as [number, number],
                maxRows: Infinity,
              }}
              dragConfig={{
                enabled: false,
                bounded: false,
              }}
              resizeConfig={{
                enabled: false,
                handles: [],
              }}
            >
              {panel.widgets.map((widget) => (
                <div key={widget.id} className="widget-container">
                  <WidgetRenderer
                    instance={widget}
                    systemStates={systemStates}
                    isEditing={false}
                    isSelected={false}
                    canEditData={true}
                    onConfigChange={(config) =>
                      handleWidgetConfigChange(widget.id, config)
                    }
                  />
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      )}

      {showCreateModal && (
        <PanelCreationModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateDashboard}
          defaultRoleVisibility={['gm']}
        />
      )}
    </div>
  );
}
