import { createContext, useContext } from 'react';
import type { Ship } from '../types';

interface ShipContextType {
  shipId: string | null;
  ship: Ship | null;
  isLoading: boolean;
}

/**
 * Ship context - provided by ShipLayout based on URL params.
 * No more cookie-based persistence; ship ID comes from URL.
 */
export const ShipContext = createContext<ShipContextType>({
  shipId: null,
  ship: null,
  isLoading: true,
});

export function useShipContext() {
  const context = useContext(ShipContext);
  if (!context) {
    throw new Error('useShipContext must be used within ShipLayout');
  }
  return context;
}

export function useCurrentShipId() {
  const { shipId } = useShipContext();
  return shipId;
}

export function useCurrentShip() {
  const { ship, isLoading } = useShipContext();
  return { ship, isLoading };
}
