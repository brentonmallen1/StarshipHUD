import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useShipContext } from '../contexts/ShipContext';
import { D20Loader } from './ui/D20Loader';
import './RequireShip.css';

interface RequireShipProps {
  children: ReactNode;
}

export function RequireShip({ children }: RequireShipProps) {
  const { shipId, isLoading } = useShipContext();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <D20Loader size={120} speed={3.4} />
        <span className="loading-screen__text">Establishing connection...</span>
      </div>
    );
  }

  if (!shipId) {
    return <Navigate to="/ships" replace />;
  }

  return <>{children}</>;
}
