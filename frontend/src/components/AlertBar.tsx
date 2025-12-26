import { useEventFeed } from '../hooks/useShipData';
import type { ShipEvent } from '../types';
import './AlertBar.css';

export function AlertBar() {
  const { data: events } = useEventFeed();

  // Filter to recent critical/warning events
  const alerts = events?.filter(
    (e) => e.severity === 'critical' || e.severity === 'warning'
  ).slice(0, 3) ?? [];

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="alert-bar">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} event={alert} />
      ))}
    </div>
  );
}

function AlertItem({ event }: { event: ShipEvent }) {
  return (
    <div className={`alert-item alert-${event.severity}`}>
      <span className="alert-icon">
        {event.severity === 'critical' ? '⚠' : '●'}
      </span>
      <span className="alert-message">{event.message}</span>
      <span className="alert-time">
        {new Date(event.created_at).toLocaleTimeString()}
      </span>
    </div>
  );
}
