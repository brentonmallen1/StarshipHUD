import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { shipsApi, panelsApi, systemStatesApi, eventsApi, scenariosApi, assetsApi, cargoApi, cargoBaysApi, cargoCategoriesApi, cargoPlacementsApi, contactsApi, crewApi, sensorContactsApi, holomapApi, tasksApi } from '../services/api';
import { useShipContext } from '../contexts/ShipContext';
import type { ThreatLevel, CrewStatus } from '../types';

/**
 * Hook to get the effective ship ID, using context or override.
 * Returns null if no ship is selected.
 */
function useEffectiveShipId(shipIdOverride?: string): string | null {
  const { shipId: contextShipId } = useShipContext();
  return shipIdOverride ?? contextShipId;
}

export function useShip(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['ship', shipId],
    queryFn: () => shipsApi.get(shipId!),
    enabled: !!shipId,
  });
}

export function useShips() {
  return useQuery({
    queryKey: ['ships'],
    queryFn: () => shipsApi.list(),
  });
}

export function usePosture(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['posture', shipId],
    queryFn: () => shipsApi.getPosture(shipId!),
    refetchInterval: 3000,
    enabled: !!shipId,
  });
}

export function usePanels(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['panels', shipId],
    queryFn: () => panelsApi.list(shipId!),
    enabled: !!shipId,
  });
}

export function usePanelsByStation(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['panels-by-station', shipId],
    queryFn: () => panelsApi.listByStation(shipId!),
    enabled: !!shipId,
  });
}

export function usePanel(panelId: string) {
  return useQuery({
    queryKey: ['panel', panelId],
    queryFn: () => panelsApi.get(panelId),
    enabled: !!panelId,
  });
}

export function useSystemStates(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['system-states', shipId],
    queryFn: () => systemStatesApi.list(shipId!),
    refetchInterval: 3000,
    enabled: !!shipId,
  });
}

export function useSystemStatesMap(shipIdOverride?: string) {
  const { data: states, ...rest } = useSystemStates(shipIdOverride);

  const statesMap = useMemo(
    () => new Map(states?.map((s) => [s.id, s]) ?? []),
    [states]
  );

  return { data: statesMap, states, ...rest };
}

export function useEvents(shipIdOverride?: string, limit = 50) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['events', shipId, limit],
    queryFn: () => eventsApi.list(shipId!, { limit }),
    refetchInterval: 2000,
    enabled: !!shipId,
  });
}

export function useEventFeed(shipIdOverride?: string, limit = 20) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['event-feed', shipId, limit],
    queryFn: () => eventsApi.getFeed(shipId!, limit),
    refetchInterval: 2000,
    enabled: !!shipId,
  });
}

export function useScenarios(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['scenarios', shipId],
    queryFn: () => scenariosApi.list(shipId!),
    enabled: !!shipId,
  });
}

export function useAssets(shipIdOverride?: string, assetType?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['assets', shipId, assetType],
    queryFn: () => assetsApi.list(shipId!, assetType),
    refetchInterval: 5000,
    enabled: !!shipId,
  });
}

export function useAsset(assetId: string) {
  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => assetsApi.get(assetId),
    enabled: !!assetId,
  });
}

export function useCargo(shipIdOverride?: string, category?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['cargo', shipId, category],
    queryFn: () => cargoApi.list(shipId!, category),
    refetchInterval: 5000,
    enabled: !!shipId,
  });
}

export function useCargoItem(cargoId: string) {
  return useQuery({
    queryKey: ['cargo-item', cargoId],
    queryFn: () => cargoApi.get(cargoId),
    enabled: !!cargoId,
  });
}

export function useUnplacedCargo(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['cargo', shipId, null, true], // category=null, unplaced=true
    queryFn: () => cargoApi.list(shipId!, undefined, true),
    refetchInterval: 5000,
    enabled: !!shipId,
  });
}

export function useCargoBays(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['cargo-bays', shipId],
    queryFn: () => cargoBaysApi.list(shipId!),
    refetchInterval: 5000,
    enabled: !!shipId,
  });
}

export function useCargoBay(bayId: string) {
  return useQuery({
    queryKey: ['cargo-bay', bayId],
    queryFn: () => cargoBaysApi.get(bayId),
    enabled: !!bayId,
  });
}

export function useCargoBayWithPlacements(bayId: string) {
  return useQuery({
    queryKey: ['cargo-bay-placements', bayId],
    queryFn: () => cargoBaysApi.getWithPlacements(bayId),
    refetchInterval: 3000, // Faster refresh for real-time collaboration
    enabled: !!bayId,
  });
}

export function useCargoPlacementsForBay(bayId: string) {
  return useQuery({
    queryKey: ['cargo-placements', bayId],
    queryFn: () => cargoPlacementsApi.list(bayId),
    refetchInterval: 3000,
    enabled: !!bayId,
  });
}

export function useCargoCategories(shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['cargo-categories', shipId],
    queryFn: () => cargoCategoriesApi.list(shipId!),
    enabled: !!shipId,
  });
}

export function useContacts(shipIdOverride?: string, threatLevel?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['contacts', shipId, threatLevel],
    queryFn: () => contactsApi.list(shipId!, threatLevel),
    refetchInterval: 5000,
    enabled: !!shipId,
  });
}

export function useContact(contactId: string) {
  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => contactsApi.get(contactId),
    enabled: !!contactId,
  });
}

// Crew
export function useCrew(shipIdOverride?: string, status?: CrewStatus, isNpc?: boolean) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['crew', shipId, status, isNpc],
    queryFn: () => crewApi.list(shipId!, status, isNpc),
    refetchInterval: 5000,
    enabled: !!shipId,
  });
}

export function useCrewMember(crewId: string) {
  return useQuery({
    queryKey: ['crew-member', crewId],
    queryFn: () => crewApi.get(crewId),
    enabled: !!crewId,
  });
}

// Sensor Contacts (radar/sensor display)
// Player view: only visible=true contacts
export function useSensorContacts(shipIdOverride?: string, threatLevel?: ThreatLevel) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['sensor-contacts', shipId, true, threatLevel],
    queryFn: () => sensorContactsApi.list(shipId!, true, threatLevel),
    refetchInterval: 2000,  // Fast updates for radar
    enabled: !!shipId,
  });
}

// Player view with dossiers
export function useSensorContactsWithDossiers(shipIdOverride?: string, threatLevel?: ThreatLevel) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['sensor-contacts-dossiers', shipId, true, threatLevel],
    queryFn: () => sensorContactsApi.listWithDossiers(shipId!, true, threatLevel),
    refetchInterval: 2000,
    enabled: !!shipId,
  });
}

// GM view: all contacts (visible + hidden)
export function useAllSensorContacts(shipIdOverride?: string, threatLevel?: ThreatLevel) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['sensor-contacts-all', shipId, threatLevel],
    queryFn: () => sensorContactsApi.list(shipId!, undefined, threatLevel),
    refetchInterval: 3000,
    enabled: !!shipId,
  });
}

// GM view with dossiers
export function useAllSensorContactsWithDossiers(shipIdOverride?: string, threatLevel?: ThreatLevel) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['sensor-contacts-all-dossiers', shipId, threatLevel],
    queryFn: () => sensorContactsApi.listWithDossiers(shipId!, undefined, threatLevel),
    refetchInterval: 3000,
    enabled: !!shipId,
  });
}

export function useSensorContact(contactId: string) {
  return useQuery({
    queryKey: ['sensor-contact', contactId],
    queryFn: () => sensorContactsApi.get(contactId),
    enabled: !!contactId,
  });
}

// Holomap hooks
export function useHolomapLayers(shipIdOverride?: string, visibleOnly = false) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['holomap-layers', shipId, visibleOnly],
    queryFn: () => holomapApi.listLayers(shipId!, visibleOnly),
    refetchInterval: 5000,
    enabled: !!shipId,
  });
}

export function useHolomapLayer(layerId: string, visibleMarkersOnly = false) {
  return useQuery({
    queryKey: ['holomap-layer', layerId, visibleMarkersOnly],
    queryFn: () => holomapApi.getLayer(layerId, visibleMarkersOnly),
    enabled: !!layerId,
    refetchInterval: 3000,  // More frequent for marker updates
  });
}

// System states filtered by category (for EnvironmentSummaryWidget)
export function useSystemStatesByCategory(category: string, shipIdOverride?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['system-states', shipId, category],
    queryFn: () => systemStatesApi.list(shipId!, category),
    refetchInterval: 3000,
    enabled: !!shipId && !!category,
  });
}

// Transmissions for player view (only transmitted=true)
export function useTransmissions(shipIdOverride?: string, limit = 20) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['transmissions', shipId, limit, 'transmitted'],
    queryFn: () => eventsApi.list(shipId!, { limit, types: 'transmission_received', transmitted: true }),
    refetchInterval: 2000,
    enabled: !!shipId,
  });
}

// All transmissions for GM view (includes drafts)
export function useAllTransmissions(shipIdOverride?: string, limit = 50) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['transmissions-all', shipId, limit],
    queryFn: () => eventsApi.list(shipId!, { limit, types: 'transmission_received' }),
    refetchInterval: 3000,
    enabled: !!shipId,
  });
}

// Tasks
export function useTasks(shipIdOverride?: string, station?: string) {
  const shipId = useEffectiveShipId(shipIdOverride);
  return useQuery({
    queryKey: ['tasks', shipId, station],
    queryFn: () => tasksApi.list(shipId!, station),
    refetchInterval: 3000,
    enabled: !!shipId,
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId),
    enabled: !!taskId,
  });
}
