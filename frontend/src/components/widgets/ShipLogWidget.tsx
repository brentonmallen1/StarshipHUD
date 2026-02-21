import { useState, useMemo, useRef, useEffect } from 'react';
import type { WidgetRendererProps, ShipEvent } from '../../types';
import { useShipLog } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import './ShipLogWidget.css';

interface ShipLogConfig {
  maxEvents?: number;
  showTimestamps?: boolean;
}

// Category-based filters for diegetic channel selection
const LOG_CHANNELS = [
  { value: 'all', label: 'ALL' },
  { value: 'ship', label: 'SHIP' },
  { value: 'comms', label: 'COMMS' },
  { value: 'ops', label: 'OPS' },
] as const;

type LogChannel = typeof LOG_CHANNELS[number]['value'];

// Map event types to channels
const TYPE_TO_CHANNEL: Record<string, LogChannel> = {
  status_change: 'ship',
  posture_change: 'ship',
  system_reset: 'ship',
  scenario_executed: 'ship',
  system_boot: 'ship',
  transmission_received: 'comms',
  log_entry: 'comms',
  alert: 'ops',
  task_completed: 'ops',
  task_created: 'ops',
  cascade_failure: 'ship',
};

// Icon map for event types
const getEventIcon = (event: ShipEvent): string => {
  if (event.source === 'gm' && event.type === 'log_entry') return 'LOG';
  switch (event.type) {
    case 'alert': return event.severity === 'critical' ? '!!' : '!';
    case 'transmission_received': return 'TX';
    case 'status_change': return '~';
    case 'posture_change': return '#';
    case 'scenario_executed': return '*';
    case 'system_reset': return '@';
    case 'task_completed': return 'OK';
    case 'task_created': return '+';
    case 'cascade_failure': return '!!';
    case 'log_entry': return 'LOG';
    default: return '-';
  }
};

// Format event message for narrative feel
const formatNarrativeMessage = (event: ShipEvent): string => {
  const { type, message, data } = event;

  switch (type) {
    case 'task_completed': {
      const status = data.status as string;
      const title = (data.task_id as string) ? message : message;
      if (status === 'succeeded') {
        return title.replace(/^Task succeeded:\s*/i, 'Completed: ');
      }
      return title.replace(/^Task failed:\s*/i, 'Failed: ');
    }
    case 'log_entry':
      return message;
    default:
      return message;
  }
};

export function ShipLogWidget({ instance, isEditing }: WidgetRendererProps) {
  const shipId = useCurrentShipId();
  const config = instance.config as ShipLogConfig;
  const maxEvents = config.maxEvents ?? 250;

  const { data: events, isLoading, error } = useShipLog(shipId ?? undefined, maxEvents);

  const [channel, setChannel] = useState<LogChannel>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Filter events by channel
  const filteredEvents = useMemo(() => {
    if (!events) return [];

    let filtered = [...events];

    if (channel !== 'all') {
      filtered = filtered.filter(e => (TYPE_TO_CHANNEL[e.type] || 'ship') === channel);
    }

    // Sort newest first
    return filtered.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [events, channel]);

  // Animate new entries
  useEffect(() => {
    if (filteredEvents.length > prevCountRef.current && contentRef.current) {
      const firstItem = contentRef.current.querySelector('.log-entry:first-child');
      if (firstItem) {
        firstItem.classList.add('log-entry--new');
        const timer = setTimeout(() => firstItem.classList.remove('log-entry--new'), 1500);
        return () => clearTimeout(timer);
      }
    }
    prevCountRef.current = filteredEvents.length;
  }, [filteredEvents.length]);

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const handleEntryClick = (eventId: string) => {
    if (isEditing) return;
    setExpandedEvent(expandedEvent === eventId ? null : eventId);
  };

  if (isLoading) {
    return (
      <div className="ship-log-widget">
        <div className="ship-log__header">
          <span className="ship-log__title">// SHIP LOG</span>
        </div>
        <div className="ship-log__body">
          <div className="ship-log__empty">
            <span className="loading-spinner" />
            <span>Initializing log feed...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ship-log-widget">
        <div className="ship-log__header">
          <span className="ship-log__title">// SHIP LOG</span>
        </div>
        <div className="ship-log__body">
          <div className="ship-log__empty">
            <span className="ship-log__error-icon">[ERR]</span>
            <span>Log feed unavailable</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ship-log-widget">
      <div className="ship-log__header">
        <span className="ship-log__title">// SHIP LOG</span>
        <span className="ship-log__count">{filteredEvents.length}</span>
      </div>

      <div className="ship-log__channels">
        {LOG_CHANNELS.map(ch => (
          <button
            key={ch.value}
            className={`ship-log__channel ${channel === ch.value ? 'ship-log__channel--active' : ''}`}
            onClick={() => setChannel(ch.value)}
            disabled={isEditing}
          >
            {ch.label}
          </button>
        ))}
      </div>

      <div className="ship-log__body" ref={contentRef}>
        {filteredEvents.length === 0 ? (
          <div className="ship-log__empty">
            <span className="ship-log__empty-icon">-</span>
            <span>No log entries</span>
          </div>
        ) : (
          filteredEvents.map(event => {
            const isExpanded = expandedEvent === event.id;
            const icon = getEventIcon(event);
            const isGM = event.source === 'gm';

            return (
              <div
                key={event.id}
                className={`log-entry severity-${event.severity} ${isExpanded ? 'log-entry--expanded' : ''} ${isGM ? 'log-entry--gm' : ''}`}
                onClick={() => handleEntryClick(event.id)}
              >
                <div className="log-entry__row">
                  <span className={`log-entry__icon severity-${event.severity}`}>
                    [{icon}]
                  </span>
                  <span className="log-entry__time">{formatTime(event.created_at)}</span>
                  <span className="log-entry__message">{formatNarrativeMessage(event)}</span>
                </div>

                {isExpanded && event.data && Object.keys(event.data).length > 0 && (() => {
                  const d = event.data as Record<string, unknown>;
                  const systemName = typeof d.system_name === 'string' ? d.system_name : null;
                  const location = typeof d.location === 'string' ? d.location : null;
                  const category = typeof d.category === 'string' ? d.category : null;
                  const station = typeof d.station === 'string' ? d.station : null;
                  if (!systemName && !location && !category && !station) return null;
                  return (
                    <div className="log-entry__details">
                      {systemName && (
                        <span className="log-entry__detail">System: {systemName}</span>
                      )}
                      {location && (
                        <span className="log-entry__detail">Location: {location}</span>
                      )}
                      {category && (
                        <span className="log-entry__detail">{category}</span>
                      )}
                      {station && (
                        <span className="log-entry__detail">Station: {station}</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      <div className="ship-log__scanline" />
    </div>
  );
}
