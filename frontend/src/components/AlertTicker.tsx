import { useState } from 'react';
import { useSystemStates } from '../hooks/useShipData';
import type { SystemState } from '../types';
import './AlertTicker.css';

export function AlertTicker() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: systems } = useSystemStates();

  // Filter to systems with compromised or worse status
  const alerts = systems?.filter(
    (s) => s.status === 'compromised' || s.status === 'critical' || s.status === 'destroyed'
  ) ?? [];

  if (alerts.length === 0) {
    return null;
  }

  // Helper function to get severity class from system status
  const getSeverityClass = (status: SystemState['status']): 'critical' | 'warning' => {
    return status === 'destroyed' || status === 'critical' ? 'critical' : 'warning';
  };

  // Helper function to format system alert message
  const formatMessage = (system: SystemState): string => {
    const percentage = system.max_value > 0 ? (system.value / system.max_value) * 100 : 0;
    return `${system.name}: ${system.status.replace('_', ' ').toUpperCase()} (${Math.round(percentage)}%)`;
  };

  const latestAlert = alerts[0];
  const remainingCount = alerts.length - 1;
  const latestSeverity = getSeverityClass(latestAlert.status);

  return (
    <div className={`alert-ticker ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Collapsed View - Latest Alert Only */}
      <button
        className="alert-ticker-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? 'Collapse alerts' : 'Expand to see all alerts'}
      >
        <div className={`alert-ticker-latest alert-${latestSeverity}`}>
          <span className="alert-ticker-icon">
            {latestSeverity === 'critical' ? '⚠' : '●'}
          </span>
          <span className="alert-ticker-message">{formatMessage(latestAlert)}</span>
          <span className="alert-ticker-time">
            {new Date(latestAlert.updated_at).toLocaleTimeString()}
          </span>
        </div>
        {remainingCount > 0 && (
          <span className="alert-ticker-badge">+{remainingCount}</span>
        )}
        <span className="alert-ticker-toggle">
          {isExpanded ? '▼' : '▲'}
        </span>
      </button>

      {/* Expanded View - All Alerts */}
      {isExpanded && alerts.length > 1 && (
        <div className="alert-ticker-list">
          {alerts.slice(1).map((system) => {
            const severity = getSeverityClass(system.status);
            return (
              <div key={system.id} className={`alert-ticker-item alert-${severity}`}>
                <span className="alert-ticker-icon">
                  {severity === 'critical' ? '⚠' : '●'}
                </span>
                <span className="alert-ticker-message">{formatMessage(system)}</span>
                <span className="alert-ticker-time">
                  {new Date(system.updated_at).toLocaleTimeString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
