import { useState } from 'react';
import { useSystemStates, useEventFeed } from '../hooks/useShipData';
import { useAcknowledgeAlert } from '../hooks/useMutations';
import type { SystemState, ShipEvent } from '../types';
import './AlertTicker.css';

interface AlertData {
  ship_wide?: boolean;
  acknowledged?: boolean;
  category?: string;
  location?: string;
}

type TickerItem =
  | { type: 'system'; data: SystemState }
  | { type: 'event'; data: ShipEvent };

export function AlertTicker() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: systems } = useSystemStates();
  const { data: events } = useEventFeed();
  const acknowledgeAlert = useAcknowledgeAlert();

  // Filter to systems with compromised or worse status
  const systemAlerts = systems?.filter(
    (s) => s.status === 'compromised' || s.status === 'critical' || s.status === 'destroyed'
  ) ?? [];

  // Filter to ship-wide alerts that are not acknowledged
  const shipWideAlerts = events?.filter((e) => {
    if (e.type !== 'alert') return false;
    const data = e.data as AlertData;
    return data.ship_wide === true && !data.acknowledged;
  }) ?? [];

  // Combine both types of alerts, with ship-wide alerts first
  const allItems: TickerItem[] = [
    ...shipWideAlerts.map((e): TickerItem => ({ type: 'event', data: e })),
    ...systemAlerts.map((s): TickerItem => ({ type: 'system', data: s })),
  ];

  if (allItems.length === 0) {
    return null;
  }

  const handleAcknowledge = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    acknowledgeAlert.mutate(eventId);
  };

  // Helper function to get severity class
  const getItemSeverity = (item: TickerItem): 'critical' | 'warning' => {
    if (item.type === 'system') {
      const status = item.data.status;
      return status === 'destroyed' || status === 'critical' ? 'critical' : 'warning';
    } else {
      return item.data.severity === 'critical' ? 'critical' : 'warning';
    }
  };

  // Helper function to format message
  const getItemMessage = (item: TickerItem): string => {
    if (item.type === 'system') {
      const system = item.data;
      const percentage = system.max_value > 0 ? (system.value / system.max_value) * 100 : 0;
      return `${system.name}: ${system.status.replace('_', ' ').toUpperCase()} (${Math.round(percentage)}%)`;
    } else {
      return item.data.message;
    }
  };

  // Helper function to get timestamp
  const getItemTime = (item: TickerItem): string => {
    if (item.type === 'system') {
      return new Date(item.data.updated_at).toLocaleTimeString();
    } else {
      return new Date(item.data.created_at).toLocaleTimeString();
    }
  };

  // Helper function to get item ID
  const getItemId = (item: TickerItem): string => {
    return item.data.id;
  };

  // Determine worst severity across all items
  const hasCritical = allItems.some((item) => getItemSeverity(item) === 'critical');
  const worstSeverity = hasCritical ? 'critical' : 'warning';

  return (
    <div className={`alert-ticker ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Collapsed View - Alert Count Summary */}
      <button
        className="alert-ticker-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? 'Collapse alerts' : 'Expand to see all alerts'}
      >
        <div className={`alert-ticker-summary alert-${worstSeverity}`}>
          <span className="alert-ticker-icon">
            {worstSeverity === 'critical' ? '⚠' : '●'}
          </span>
          <span className="alert-ticker-count">{allItems.length}</span>
          <span className="alert-ticker-count-label">
            Alert{allItems.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="alert-ticker-hint">
          {isExpanded ? 'Click to collapse' : 'Expand to view details'}
        </span>
        <span className="alert-ticker-toggle">
          {isExpanded ? '▼' : '▲'}
        </span>
      </button>

      {/* Expanded View - All Alerts */}
      {isExpanded && (
        <div className="alert-ticker-list">
          {allItems.map((item) => {
            const severity = getItemSeverity(item);
            return (
              <div key={getItemId(item)} className={`alert-ticker-item alert-${severity} ${item.type === 'event' ? 'ship-wide' : ''}`}>
                <span className="alert-ticker-icon">
                  {item.type === 'event' ? '!!' : (severity === 'critical' ? '⚠' : '●')}
                </span>
                <span className="alert-ticker-message">{getItemMessage(item)}</span>
                <span className="alert-ticker-time">{getItemTime(item)}</span>
                {item.type === 'event' && (
                  <button
                    className="alert-ticker-ack"
                    onClick={(e) => handleAcknowledge(item.data.id, e)}
                    disabled={acknowledgeAlert.isPending}
                    title="Acknowledge"
                  >
                    ACK
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
