import type { WidgetRendererProps } from '../../types';
import { useSystemStatesByCategory, useSystemStates } from '../../hooks/useShipData';
import './EnvironmentSummaryWidget.css';

// System icons based on common life support system names
const SYSTEM_ICONS: Record<string, string> = {
  atmosphere: '🌬️',
  gravity: '⚛️',
  hull: '🛡️',
  life_support: '💚',
  oxygen: 'O₂',
  pressure: '◉',
  temperature: '🌡️',
  radiation: '☢️',
  water: '💧',
  power: '⚡',
};

function getSystemIcon(systemName: string): string {
  const normalizedName = systemName.toLowerCase();
  for (const [key, icon] of Object.entries(SYSTEM_ICONS)) {
    if (normalizedName.includes(key)) {
      return icon;
    }
  }
  return '◆';
}

function getStatusClass(status: string): string {
  const statusMap: Record<string, string> = {
    fully_operational: 'operational',
    operational: 'operational',
    degraded: 'degraded',
    compromised: 'compromised',
    critical: 'critical',
    destroyed: 'destroyed',
    offline: 'offline',
  };
  return statusMap[status] || 'unknown';
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').toUpperCase();
}

/**
 * Environment Summary Widget
 *
 * Displays environmental/habitat conditions by querying life support systems.
 * Shows atmosphere, gravity, and other critical systems with visual indicators.
 *
 * Config options:
 * - show_values: boolean - Show percentage values (default: true)
 * - show_status: boolean - Show status text (default: true)
 * - compact: boolean - Compact layout mode (default: false)
 * - category: string - Override category filter (default: 'life_support')
 *
 * Bindings:
 * - system_ids: string[] - Optional array of specific system IDs to display
 */
export function EnvironmentSummaryWidget({ instance }: WidgetRendererProps) {
  const showValues = (instance.config?.show_values as boolean) ?? true;
  const showStatus = (instance.config?.show_status as boolean) ?? true;
  const compact = (instance.config?.compact as boolean) ?? false;
  const category = (instance.config?.category as string) ?? 'life_support';
  const systemIds = instance.bindings?.system_ids as string[] | undefined;

  // Optional ship ID override from bindings (otherwise uses context)
  const shipIdOverride = instance.bindings?.ship_id as string | undefined;

  // Query by category (default behavior)
  const { data: categoryStates, isLoading: categoryLoading } = useSystemStatesByCategory(
    systemIds ? '' : category, // Skip category query if we have specific system IDs
    shipIdOverride
  );

  // If specific system IDs are bound, query all states and filter
  const { data: allStates, isLoading: allLoading } = useSystemStates(shipIdOverride);

  const isLoading = systemIds ? allLoading : categoryLoading;

  // Determine which systems to display
  const systems = systemIds
    ? (allStates?.filter((s) => systemIds.includes(s.id)) ?? [])
    : (categoryStates ?? []);

  if (isLoading) {
    return (
      <div className={`environment-summary-widget ${compact ? 'compact' : ''}`}>
        <div className="environment-header">
          <span className="environment-title">ENVIRONMENTAL STATUS</span>
        </div>
        <div className="environment-loading">
          <span className="loading-text">SCANNING...</span>
        </div>
      </div>
    );
  }

  if (systems.length === 0) {
    return (
      <div className={`environment-summary-widget ${compact ? 'compact' : ''}`}>
        <div className="environment-header">
          <span className="environment-title">ENVIRONMENTAL STATUS</span>
        </div>
        <div className="environment-empty">
          <span className="empty-text">NO SYSTEMS CONFIGURED</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`environment-summary-widget ${compact ? 'compact' : ''}`}>
      <div className="environment-header">
        <span className="environment-title">ENVIRONMENTAL STATUS</span>
      </div>
      <div className="environment-systems">
        {systems.map((system) => {
          const percentage = system.max_value > 0
            ? Math.round((system.value / system.max_value) * 100)
            : 0;
          const statusClass = getStatusClass(system.status);
          const icon = getSystemIcon(system.name);

          return (
            <div key={system.id} className={`environment-system status-${statusClass}`}>
              <div className="system-header">
                <span className="system-icon">{icon}</span>
                <span className="system-name">{system.name.toUpperCase()}</span>
                {showValues && (
                  <span className="system-value">{percentage}%</span>
                )}
              </div>
              <div className="system-bar-container">
                <div
                  className="system-bar-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {showStatus && (
                <div className="system-status">
                  <span className="status-text">{formatStatus(system.status)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
