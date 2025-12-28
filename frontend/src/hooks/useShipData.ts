import { useQuery } from '@tanstack/react-query';
import { shipsApi, panelsApi, systemStatesApi, eventsApi, scenariosApi, assetsApi, cargoApi, contactsApi, holomapApi } from '../services/api';

// Default ship ID for MVP (single ship)
const DEFAULT_SHIP_ID = 'constellation';

export function useShip(shipId = DEFAULT_SHIP_ID) {
  return useQuery({
    queryKey: ['ship', shipId],
    queryFn: () => shipsApi.get(shipId),
  });
}

export function useShips() {
  return useQuery({
    queryKey: ['ships'],
    queryFn: () => shipsApi.list(),
  });
}

export function usePosture(shipId = DEFAULT_SHIP_ID) {
  return useQuery({
    queryKey: ['posture', shipId],
    queryFn: () => shipsApi.getPosture(shipId),
    refetchInterval: 3000,
  });
}

export function usePanels(shipId = DEFAULT_SHIP_ID) {
  return useQuery({
    queryKey: ['panels', shipId],
    queryFn: () => panelsApi.list(shipId),
  });
}

export function usePanelsByStation(shipId = DEFAULT_SHIP_ID) {
  return useQuery({
    queryKey: ['panels-by-station', shipId],
    queryFn: () => panelsApi.listByStation(shipId),
  });
}

export function usePanel(panelId: string) {
  return useQuery({
    queryKey: ['panel', panelId],
    queryFn: () => panelsApi.get(panelId),
    enabled: !!panelId,
  });
}

export function useSystemStates(shipId = DEFAULT_SHIP_ID) {
  return useQuery({
    queryKey: ['system-states', shipId],
    queryFn: () => systemStatesApi.list(shipId),
    refetchInterval: 3000,
  });
}

export function useSystemStatesMap(shipId = DEFAULT_SHIP_ID) {
  const { data: states, ...rest } = useSystemStates(shipId);

  const statesMap = new Map(
    states?.map((s) => [s.id, s]) ?? []
  );

  return { data: statesMap, states, ...rest };
}

export function useEvents(shipId = DEFAULT_SHIP_ID, limit = 50) {
  return useQuery({
    queryKey: ['events', shipId, limit],
    queryFn: () => eventsApi.list(shipId, { limit }),
    refetchInterval: 2000,
  });
}

export function useEventFeed(shipId = DEFAULT_SHIP_ID, limit = 20) {
  return useQuery({
    queryKey: ['event-feed', shipId, limit],
    queryFn: () => eventsApi.getFeed(shipId, limit),
    refetchInterval: 2000,
  });
}

export function useScenarios(shipId = DEFAULT_SHIP_ID) {
  return useQuery({
    queryKey: ['scenarios', shipId],
    queryFn: () => scenariosApi.list(shipId),
  });
}

export function useAssets(shipId = DEFAULT_SHIP_ID, assetType?: string) {
  return useQuery({
    queryKey: ['assets', shipId, assetType],
    queryFn: () => assetsApi.list(shipId, assetType),
    refetchInterval: 5000,
  });
}

export function useAsset(assetId: string) {
  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => assetsApi.get(assetId),
    enabled: !!assetId,
  });
}

export function useCargo(shipId = DEFAULT_SHIP_ID, category?: string) {
  return useQuery({
    queryKey: ['cargo', shipId, category],
    queryFn: () => cargoApi.list(shipId, category),
    refetchInterval: 5000,
  });
}

export function useCargoItem(cargoId: string) {
  return useQuery({
    queryKey: ['cargo-item', cargoId],
    queryFn: () => cargoApi.get(cargoId),
    enabled: !!cargoId,
  });
}

export function useContacts(shipId = DEFAULT_SHIP_ID, threatLevel?: string) {
  return useQuery({
    queryKey: ['contacts', shipId, threatLevel],
    queryFn: () => contactsApi.list(shipId, threatLevel),
    refetchInterval: 5000,
  });
}

export function useContact(contactId: string) {
  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => contactsApi.get(contactId),
    enabled: !!contactId,
  });
}

// Holomap hooks
export function useHolomapLayers(shipId = DEFAULT_SHIP_ID, visibleOnly = false) {
  return useQuery({
    queryKey: ['holomap-layers', shipId, visibleOnly],
    queryFn: () => holomapApi.listLayers(shipId, visibleOnly),
    refetchInterval: 5000,
  });
}

export function useHolomapLayer(layerId: string) {
  return useQuery({
    queryKey: ['holomap-layer', layerId],
    queryFn: () => holomapApi.getLayer(layerId),
    enabled: !!layerId,
    refetchInterval: 3000,  // More frequent for marker updates
  });
}

// System states filtered by category (for EnvironmentSummaryWidget)
export function useSystemStatesByCategory(shipId = DEFAULT_SHIP_ID, category: string) {
  return useQuery({
    queryKey: ['system-states', shipId, category],
    queryFn: () => systemStatesApi.list(shipId, category),
    refetchInterval: 3000,
    enabled: !!category,
  });
}

// Transmissions for player view (only transmitted=true)
export function useTransmissions(shipId = DEFAULT_SHIP_ID, limit = 20) {
  return useQuery({
    queryKey: ['transmissions', shipId, limit, 'transmitted'],
    queryFn: () => eventsApi.list(shipId, { limit, types: 'transmission_received', transmitted: true }),
    refetchInterval: 2000,
  });
}

// All transmissions for GM view (includes drafts)
export function useAllTransmissions(shipId = DEFAULT_SHIP_ID, limit = 50) {
  return useQuery({
    queryKey: ['transmissions-all', shipId, limit],
    queryFn: () => eventsApi.list(shipId, { limit, types: 'transmission_received' }),
    refetchInterval: 3000,
  });
}
