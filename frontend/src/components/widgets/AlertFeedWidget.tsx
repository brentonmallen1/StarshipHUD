import { useState } from 'react';
import type { WidgetRendererProps } from '../../types';
import './AlertFeedWidget.css';

interface Alert {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  location?: string;
  acknowledged?: boolean;
}

export function AlertFeedWidget({ isEditing }: WidgetRendererProps) {
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      severity: 'critical',
      category: 'Engineering',
      message: 'Reactor coolant pressure exceeding safe limits',
      location: 'Reactor B',
      acknowledged: false,
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      severity: 'warning',
      category: 'Sensors',
      message: 'Unknown contact detected at bearing 045',
      location: 'Long-range sensors',
      acknowledged: false,
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      severity: 'info',
      category: 'Navigation',
      message: 'Course correction complete',
      acknowledged: true,
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      severity: 'warning',
      category: 'Life Support',
      message: 'O2 levels at 85% in cargo bay 3',
      location: 'Cargo Bay 3',
      acknowledged: true,
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      severity: 'info',
      category: 'Communications',
      message: 'Incoming transmission from Station Epsilon',
      acknowledged: true,
    },
  ]);

  const [filter, setFilter] = useState<'all' | 'unacknowledged'>('all');

  const handleAcknowledge = (alertId: string) => {
    if (isEditing) return;

    setAlerts(alerts.map(alert =>
      alert.id === alertId
        ? { ...alert, acknowledged: true }
        : alert
    ));
    // TODO: API call to acknowledge alert
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
      case 'critical': return '⚠';
      case 'warning': return '⚡';
      case 'info': return 'ℹ';
      default: return '•';
    }
  };

  const filteredAlerts = filter === 'unacknowledged'
    ? alerts.filter(a => !a.acknowledged)
    : alerts;

  // Show all alerts with scrolling
  const visibleAlerts = filteredAlerts;
  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

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
        {visibleAlerts.length === 0 && (
          <div className="alert-empty">
            <div className="empty-icon">✓</div>
            <p className="empty-message">No active alerts</p>
          </div>
        )}

        {visibleAlerts.map(alert => (
          <div
            key={alert.id}
            className={`alert-item severity-${alert.severity} ${alert.acknowledged ? 'acknowledged' : ''}`}
          >
            <div className="alert-item-header">
              <div className="alert-severity">
                <span className="severity-icon">{getSeverityIcon(alert.severity)}</span>
                <span className="severity-label">{alert.severity.toUpperCase()}</span>
              </div>
              <span className="alert-time">{getTimeAgo(alert.timestamp)}</span>
            </div>

            <div className="alert-category">{alert.category}</div>
            <p className="alert-message">{alert.message}</p>

            {alert.location && (
              <div className="alert-location">
                <span className="location-icon">📍</span>
                {alert.location}
              </div>
            )}

            {!alert.acknowledged && !isEditing && (
              <button
                className="acknowledge-btn"
                onClick={() => handleAcknowledge(alert.id)}
              >
                Acknowledge
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
