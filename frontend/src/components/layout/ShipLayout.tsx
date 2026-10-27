import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shipsApi, isApiError } from '../../services/api';
import { ShipContext } from '../../contexts/ShipContext';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import './Layout.css';

/**
 * Layout wrapper that provides ship context from URL params.
 * All ship-scoped routes are children of this layout.
 */
export function ShipLayout() {
  const { shipId } = useParams<{ shipId: string }>();
  useLiveUpdates(shipId);

  const {
    data: ship,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ship', shipId],
    queryFn: () => shipsApi.get(shipId!),
    enabled: !!shipId,
    // Doubles as a connectivity heartbeat; ship metadata itself rarely changes
    refetchInterval: 10000,
    retry: (failureCount, err) => !isApiError(err, 404) && failureCount < 2,
  });

  // Invalid/deleted ship, or never managed to load it. A failed background
  // refetch keeps the cached ship and shows the signal-lost banner instead,
  // so a backend restart mid-scene doesn't eject every player.
  if (!shipId || isApiError(error, 404) || (error && !ship)) {
    return <Navigate to="/ships" replace />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="app-container loading-layout">
        <div className="loading-ship">
          <div className="loading-spinner" />
          <span>Connecting to ship systems...</span>
        </div>
      </div>
    );
  }

  return (
    <ShipContext.Provider value={{ shipId, ship: ship ?? null, isLoading: false }}>
      {error && (
        <div className="signal-lost-banner" role="status" aria-live="polite">
          <span className="signal-lost-banner__icon" aria-hidden="true">&#x26A0;</span>
          <span>SIGNAL LOST &mdash; RE-ESTABLISHING LINK</span>
        </div>
      )}
      <Outlet />
    </ShipContext.Provider>
  );
}
