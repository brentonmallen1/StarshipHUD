import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from './EmptyState';

interface ConsoleOfflineProps {
  title?: string;
  description?: string;
}

/**
 * Diegetic "not found" screen for ship routes: unknown URLs, deleted panels,
 * or panels this crew member isn't cleared for.
 */
export function ConsoleOffline({
  title = 'No such console',
  description = 'This station is offline or does not exist on this ship.',
}: ConsoleOfflineProps) {
  const navigate = useNavigate();
  const { shipId } = useParams<{ shipId: string }>();

  return (
    <EmptyState
      icon="⊘"
      title={title}
      description={description}
      action={{
        label: 'Return to console selector',
        onClick: () => navigate(shipId ? `/${shipId}/panels` : '/ships', { state: { fromApp: true } }),
      }}
    />
  );
}
