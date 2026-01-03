import { useState, useMemo } from 'react';
import type { WidgetRendererProps, ShipEvent } from '../../types';
import { useEvents } from '../../hooks/useShipData';
import './ShipLogWidget.css';

interface ShipLogConfig {
  maxEvents?: number;
  showTimestamps?: boolean;
  eventTypes?: string[];
}

// Known event types for filtering
const EVENT_TYPES = [
  { value: 'all', label: 'All Events' },
  { value: 'alert', label: 'Alerts' },
  { value: 'status_change', label: 'Status Changes' },
  { value: 'transmission_received', label: 'Transmissions' },
  { value: 'scenario_executed', label: 'Scenarios' },
  { value: 'posture_change', label: 'Posture' },
  { value: 'system_reset', label: 'System Reset' },
];

export function ShipLogWidget({ instance, isEditing }: WidgetRendererProps) {
  const config = instance.config as ShipLogConfig;
  const maxEvents = config.maxEvents ?? 100;

  const { data: events, isLoading, error } = useEvents('constellation', maxEvents);

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Filter and search events
  const filteredEvents = useMemo(() => {
    if (!events) return [];

    let filtered = [...events];

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(e => e.type === typeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.message.toLowerCase().includes(query) ||
        e.type.toLowerCase().includes(query)
      );
    }

    // Sort by created_at descending (newest first)
    return filtered.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [events, typeFilter, searchQuery]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { date: string; events: ShipEvent[] }[] = [];
    let currentDate = '';

    for (const event of filteredEvents) {
      const eventDate = new Date(event.created_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      if (eventDate !== currentDate) {
        currentDate = eventDate;
        groups.push({ date: eventDate, events: [] });
      }

      groups[groups.length - 1].events.push(event);
    }

    return groups;
  }, [filteredEvents]);

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getEventIcon = (type: string, severity: string): string => {
    switch (type) {
      case 'alert':
        return severity === 'critical' ? '!!' : severity === 'warning' ? '!' : 'i';
      case 'transmission_received':
        return '>';
      case 'status_change':
        return '~';
      case 'scenario_executed':
        return '*';
      case 'posture_change':
        return '#';
      case 'system_reset':
        return '@';
      default:
        return '-';
    }
  };

  const getEventTypeLabel = (type: string): string => {
    const found = EVENT_TYPES.find(t => t.value === type);
    return found ? found.label : type.replace(/_/g, ' ').toUpperCase();
  };

  const handleEventClick = (eventId: string) => {
    if (isEditing) return;
    setExpandedEvent(expandedEvent === eventId ? null : eventId);
  };

  if (isLoading) {
    return (
      <div className="ship-log-widget">
        <div className="ship-log-loading">
          <span className="loading-spinner" />
          <span>Loading ship log...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ship-log-widget">
        <div className="ship-log-error">
          <span className="error-icon">!</span>
          <span>Failed to load events</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ship-log-widget">
      <div className="ship-log-header">
        <h3 className="ship-log-title">Ship Log</h3>
        <span className="ship-log-count">{filteredEvents.length}</span>
      </div>

      <div className="ship-log-controls">
        <select
          className="type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          disabled={isEditing}
        >
          {EVENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          className="search-input"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isEditing}
        />
      </div>

      <div className="ship-log-content">
        {filteredEvents.length === 0 ? (
          <div className="ship-log-empty">
            <span className="empty-icon">-</span>
            <span>No events found</span>
          </div>
        ) : (
          groupedEvents.map(group => (
            <div key={group.date} className="event-group">
              <div className="event-group-header">
                <span className="group-date">{group.date}</span>
                <span className="group-count">{group.events.length}</span>
              </div>

              {group.events.map(event => {
                const isExpanded = expandedEvent === event.id;

                return (
                  <div
                    key={event.id}
                    className={`event-item severity-${event.severity} ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => handleEventClick(event.id)}
                  >
                    <div className="event-row">
                      <span className={`event-icon severity-${event.severity}`}>
                        [{getEventIcon(event.type, event.severity)}]
                      </span>
                      <span className="event-time">{formatTime(event.created_at)}</span>
                      <span className="event-message">{event.message}</span>
                    </div>

                    {isExpanded && (
                      <div className="event-details">
                        <div className="detail-row">
                          <span className="detail-label">TYPE</span>
                          <span className="detail-value">{getEventTypeLabel(event.type)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">SEVERITY</span>
                          <span className={`detail-value severity-${event.severity}`}>
                            {event.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">ID</span>
                          <span className="detail-value event-id">{event.id}</span>
                        </div>
                        {event.data && Object.keys(event.data).length > 0 && (
                          <div className="detail-row">
                            <span className="detail-label">DATA</span>
                            <pre className="detail-data">
                              {JSON.stringify(event.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
