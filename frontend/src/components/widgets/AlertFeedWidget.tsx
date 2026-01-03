import { useState, useMemo } from 'react';
import type { WidgetRendererProps, ShipEvent } from '../../types';
import { useEvents } from '../../hooks/useShipData';
import { useAcknowledgeAlert } from '../../hooks/useMutations';
import './AlertFeedWidget.css';

// Event types that should appear in the alert feed
const ALERT_EVENT_TYPES = ['alert', 'status_change', 'posture_change', 'scenario_executed'];

interface AlertData {
  category?: string;
  location?: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
}

export function AlertFeedWidget({ isEditing }: WidgetRendererProps) {
  const [filter, setFilter] = useState<'all' | 'unacknowledged'>('all');

  // Fetch events from API
  const { data: events, isLoading, error } = useEvents('constellation', 50);
  const acknowledgeAlert = useAcknowledgeAlert();

  // Filter to alert-type events and transform them
  const alerts = useMemo(() => {
    if (!events) return [];

    return events
      .filter(event => ALERT_EVENT_TYPES.includes(event.type))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [events]);

  // Apply filter
  const filteredAlerts = useMemo(() => {
    if (filter === 'unacknowledged') {
      return alerts.filter(alert => {
        const data = alert.data as AlertData;
        return !data.acknowledged;
      });
    }
    return alerts;
  }, [alerts, filter]);

  const unacknowledgedCount = useMemo(() => {
    return alerts.filter(alert => {
      const data = alert.data as AlertData;
      return !data.acknowledged;
    }).length;
  }, [alerts]);

  const handleAcknowledge = (alertId: string) => {
    if (isEditing) return;
    acknowledgeAlert.mutate(alertId);
  };

  const getTimeAgo = (timestamp: string): string => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'critical': return '!!';
      case 'warning': return '!';
      case 'info': return 'i';
      default: return '-';
    }
  };

  const getCategory = (event: ShipEvent): string => {
    const data = event.data as AlertData;
    if (data.category) return data.category;

    // Infer category from event type
    switch (event.type) {
      case 'status_change': return 'Systems';
      case 'posture_change': return 'Command';
      case 'scenario_executed': return 'Operations';
      case 'alert': return 'Alert';
      default: return 'General';
    }
  };

  if (isLoading) {
    return (
      <div className="alert-feed-widget">
        <div className="alert-feed-header">
          <h3 className="alert-feed-title">Alert Feed</h3>
        </div>
        <div className="alert-list">
          <div className="alert-empty">
            <div className="empty-icon">...</div>
            <p className="empty-message">Loading alerts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-feed-widget">
        <div className="alert-feed-header">
          <h3 className="alert-feed-title">Alert Feed</h3>
        </div>
        <div className="alert-list">
          <div className="alert-empty">
            <div className="empty-icon">!</div>
            <p className="empty-message">Failed to load alerts</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="alert-feed-widget">
      <div className="alert-feed-header">
        <h3 className="alert-feed-title">Alert Feed</h3>
        {unacknowledgedCount > 0 && (
          <div className="alert-badge">{unacknowledgedCount}</div>
        )}
      </div>

      <div className="alert-filter">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          disabled={isEditing}
        >
          All ({alerts.length})
        </button>
        <button
          className={`filter-btn ${filter === 'unacknowledged' ? 'active' : ''}`}
          onClick={() => setFilter('unacknowledged')}
          disabled={isEditing}
        >
          Active ({unacknowledgedCount})
        </button>
      </div>

      <div className="alert-list">
        {filteredAlerts.length === 0 && (
          <div className="alert-empty">
            <div className="empty-icon">OK</div>
            <p className="empty-message">No active alerts</p>
          </div>
        )}

        {filteredAlerts.map(alert => {
          const data = alert.data as AlertData;
          const isAcknowledged = data.acknowledged ?? false;

          return (
            <div
              key={alert.id}
              className={`alert-item severity-${alert.severity} ${isAcknowledged ? 'acknowledged' : ''}`}
            >
              <div className="alert-item-header">
                <div className="alert-severity">
                  <span className="severity-icon">[{getSeverityIcon(alert.severity)}]</span>
                  <span className="severity-label">{alert.severity.toUpperCase()}</span>
                </div>
                <span className="alert-time">{getTimeAgo(alert.created_at)}</span>
              </div>

              <div className="alert-category">{getCategory(alert)}</div>
              <p className="alert-message">{alert.message}</p>

              {data.location && (
                <div className="alert-location">
                  <span className="location-icon">@</span>
                  {data.location}
                </div>
              )}

              {!isAcknowledged && !isEditing && (
                <button
                  className="acknowledge-btn"
                  onClick={() => handleAcknowledge(alert.id)}
                  disabled={acknowledgeAlert.isPending}
                >
                  {acknowledgeAlert.isPending ? 'Acknowledging...' : 'Acknowledge'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
