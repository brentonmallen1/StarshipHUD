import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { shipsApi, sessionApi } from '../services/api';
import type { Ship } from '../types';

interface ShipContextType {
  shipId: string | null;
  ship: Ship | null;
  isLoading: boolean;
  setShipId: (id: string) => void;
  clearShip: () => void;
}

const COOKIE_NAME = 'starship_hud_ship_id';

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

export const ShipContext = createContext<ShipContextType>({
  shipId: null,
  ship: null,
  isLoading: true,
  setShipId: () => {},
  clearShip: () => {},
});

export function ShipProvider({ children }: { children: ReactNode }) {
  // Initialize from cookie
  const [shipId, setShipIdState] = useState<string | null>(() => {
    return getCookie(COOKIE_NAME);
  });
  const queryClient = useQueryClient();

  // Fetch ship data when shipId is set
  const { data: ship, isLoading: shipLoading } = useQuery({
    queryKey: ['ship', shipId],
    queryFn: () => shipsApi.get(shipId!),
    enabled: !!shipId,
  });

  // Sync with cookie on mount (in case cookie changed externally)
  useEffect(() => {
    const cookieShipId = getCookie(COOKIE_NAME);
    if (cookieShipId !== shipId) {
      setShipIdState(cookieShipId);
    }
  }, []);

  const invalidateShipData = useCallback(() => {
    // Invalidate all ship-scoped queries without touching global caches (e.g. ships list)
    const shipQueryKeys = [
      'ship', 'panels', 'panel', 'system-states', 'system-state',
      'events', 'event-feed', 'scenarios', 'scenario',
      'contacts', 'contact', 'crew', 'crew-member',
      'sensor-contacts', 'sensor-contacts-all', 'sensor-contacts-dossiers', 'sensor-contacts-all-dossiers',
      'assets', 'asset', 'tasks', 'task',
      'cargo', 'cargo-bays', 'cargo-bay', 'cargo-categories', 'cargo-category',
      'cargo-placements', 'cargo-bay-placements',
      'holomap-layers', 'holomap-layer',
      'transmissions', 'transmissions-all',
      'posture', 'incidents',
    ];
    for (const key of shipQueryKeys) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);

  const setShipId = useCallback(async (id: string) => {
    try {
      // Set cookie via API
      await sessionApi.setShip(id);
      setShipIdState(id);
      // Invalidate ship-scoped queries to refetch with new ship
      invalidateShipData();
    } catch (error) {
      console.error('Failed to set ship:', error);
    }
  }, [queryClient, invalidateShipData]);

  const clearShip = useCallback(async () => {
    try {
      await sessionApi.clearShip();
      setShipIdState(null);
      invalidateShipData();
    } catch (error) {
      console.error('Failed to clear ship:', error);
    }
  }, [queryClient, invalidateShipData]);

  const isLoading = shipId ? shipLoading : false;

  return (
    <ShipContext.Provider value={{ shipId, ship: ship ?? null, isLoading, setShipId, clearShip }}>
      {children}
    </ShipContext.Provider>
  );
}

export function useShipContext() {
  const context = useContext(ShipContext);
  if (!context) {
    throw new Error('useShipContext must be used within a ShipProvider');
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
