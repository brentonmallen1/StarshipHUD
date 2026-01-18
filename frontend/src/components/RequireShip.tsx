import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useShipContext } from '../contexts/ShipContext';

interface RequireShipProps {
  children: ReactNode;
}

export function RequireShip({ children }: RequireShipProps) {
  const { shipId, isLoading } = useShipContext();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Establishing connection...</span>
      </div>
    );
  }

  if (!shipId) {
    return <Navigate to="/ships" replace />;
  }

  return <>{children}</>;
}
