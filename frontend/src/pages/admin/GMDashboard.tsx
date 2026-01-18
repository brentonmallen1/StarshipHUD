import { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePanels, usePanel, useSystemStatesMap } from '../../hooks/useShipData';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import { WidgetRenderer } from '../../components/widgets/WidgetRenderer';
import { widgetsApi } from '../../services/api';
import { getWidgetType } from '../../components/widgets/widgetRegistry';
import { GridLayout } from 'react-grid-layout/react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
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
  const { data: panels, isLoading: panelsLoading } = usePanels();
  const { data: systemStates } = useSystemStatesMap();

  // Find the admin panel
  const adminPanel = useMemo(() => {
    return panels?.find((p) => p.station_group === 'admin');
  }, [panels]);

  // Fetch the full panel with widgets if we have an admin panel
  const {
    data: panelWithWidgets,
    isLoading: panelLoading,
    error: panelError,
  } = usePanel(adminPanel?.id ?? '');

  // Use robust container dimensions hook
  const { width: gridWidth, containerRef, ready } = useContainerDimensions();

  // Handle widget config changes (for runtime config updates)
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
        static: true, // Not editable in view mode
      };
    });
  }, [panelWithWidgets?.widgets]);

  const isLoading = panelsLoading || (adminPanel && panelLoading);

  if (isLoading) {
    return (
      <div className="gm-dashboard">
        <div className="gm-dashboard-header">
          <h2 className="gm-dashboard-title">GM Dashboard</h2>
        </div>
        <div className="gm-dashboard-loading">Loading dashboard...</div>
      </div>
    );
  }

  // No admin panel exists yet
  if (!adminPanel) {
    return (
      <div className="gm-dashboard">
        <div className="gm-dashboard-header">
          <h2 className="gm-dashboard-title">GM Dashboard</h2>
        </div>
        <div className="gm-dashboard-empty">
          <p>No dashboard panel configured yet.</p>
          <p className="empty-hint">
            Create an "admin" station panel in the{' '}
            <Link to="/admin/panels">Panels</Link> section, or re-seed the ship
            data to get the default GM dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Error loading panel
  if (panelError || !panelWithWidgets) {
    return (
      <div className="gm-dashboard">
        <div className="gm-dashboard-header">
          <h2 className="gm-dashboard-title">GM Dashboard</h2>
        </div>
        <div className="gm-dashboard-error">
          Failed to load dashboard: {panelError?.message}
        </div>
      </div>
    );
  }

  const panel = panelWithWidgets;
  const layoutReady = layout.length > 0 || panel.widgets.length === 0;

  return (
    <div className="gm-dashboard">
      <div className="gm-dashboard-header">
        <h2 className="gm-dashboard-title">GM Dashboard</h2>
        <Link to={`/admin/panels/${panel.id}`} className="customize-link">
          Customize
        </Link>
      </div>

      <div
        ref={containerRef as React.RefCallback<HTMLDivElement>}
        className="gm-dashboard-grid-container"
      >
        {ready && layoutReady && (
          <GridLayout
            className="gm-dashboard-grid"
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
    </div>
  );
}
