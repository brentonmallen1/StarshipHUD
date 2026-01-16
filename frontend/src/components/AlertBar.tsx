import { useEventFeed } from '../hooks/useShipData';
import { useAcknowledgeAlert, useClearAlert } from '../hooks/useMutations';
import type { ShipEvent } from '../types';
import './AlertBar.css';

interface AlertData {
  ship_wide?: boolean;
  acknowledged?: boolean;
  category?: string;
  location?: string;
}

export function AlertBar() {
  const { data: events } = useEventFeed();
  const acknowledgeAlert = useAcknowledgeAlert();
  const clearAlert = useClearAlert();

  // Filter to ship-wide alerts that are not acknowledged
  const shipWideAlerts = events?.filter((e) => {
    if (e.type !== 'alert') return false;
    const data = e.data as AlertData;
    return data.ship_wide === true && !data.acknowledged;
  }).slice(0, 5) ?? [];

  if (shipWideAlerts.length === 0) {
    return null;
  }

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert.mutate(id);
  };

  const handleClear = (id: string) => {
    clearAlert.mutate(id);
  };

  return (
    <div className="alert-bar">
      {shipWideAlerts.map((alert) => (
        <AlertItem
          key={alert.id}
          event={alert}
          onAcknowledge={() => handleAcknowledge(alert.id)}
          onClear={() => handleClear(alert.id)}
          isProcessing={acknowledgeAlert.isPending || clearAlert.isPending}
        />
      ))}
    </div>
  );
}

interface AlertItemProps {
  event: ShipEvent;
  onAcknowledge: () => void;
  onClear: () => void;
  isProcessing: boolean;
}

function AlertItem({ event, onAcknowledge, onClear, isProcessing }: AlertItemProps) {
  return (
    <div className={`alert-item alert-${event.severity}`}>
      <span className="alert-icon">
        {event.severity === 'critical' ? '!!' : event.severity === 'warning' ? '!' : 'i'}
      </span>
      <span className="alert-message">{event.message}</span>
      <div className="alert-actions">
        <button
          className="alert-btn alert-btn-ack"
          onClick={onAcknowledge}
          disabled={isProcessing}
          title="Acknowledge"
        >
          ACK
        </button>
        <button
          className="alert-btn alert-btn-clear"
          onClick={onClear}
          disabled={isProcessing}
          title="Clear"
        >
          ×
        </button>
      </div>
    </div>
  );
}
