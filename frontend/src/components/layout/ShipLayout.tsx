import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shipsApi } from '../../services/api';
import { ShipContext } from '../../contexts/ShipContext';
import './Layout.css';

/**
 * Layout wrapper that provides ship context from URL params.
 * All ship-scoped routes are children of this layout.
 */
export function ShipLayout() {
  const { shipId } = useParams<{ shipId: string }>();

  const {
    data: ship,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['ship', shipId],
    queryFn: () => shipsApi.get(shipId!),
    enabled: !!shipId,
    retry: false,
  });

  // Invalid or missing ship ID
  if (!shipId || isError) {
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
      <Outlet />
    </ShipContext.Provider>
  );
}
