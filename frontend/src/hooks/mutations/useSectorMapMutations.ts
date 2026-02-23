import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sectorMapApi } from '../../services/api';
import type { SectorMap, SectorSprite, SectorMapObject, SectorWaypoint } from '../../types';

// Map mutations
export function useCreateSectorMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SectorMap> & { ship_id: string }) =>
      sectorMapApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-maps'] });
    },
  });
}

export function useUpdateSectorMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SectorMap> }) =>
      sectorMapApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-maps'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
    },
  });
}

export function useDeleteSectorMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sectorMapApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-maps'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map-active'] });
    },
  });
}

export function useSetActiveSectorMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sectorMapApi.setActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-maps'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map-active'] });
    },
  });
}

export function useDeactivateSectorMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sectorMapApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-maps'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map-active'] });
    },
  });
}

// Sprite mutations
export function useCreateSectorSprite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SectorSprite> & { ship_id: string; image_url: string }) =>
      sectorMapApi.createSprite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-sprites'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
    },
  });
}

export function useUpdateSectorSprite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SectorSprite> }) =>
      sectorMapApi.updateSprite(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-sprites'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
    },
  });
}

export function useDeleteSectorSprite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sectorMapApi.deleteSprite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-sprites'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
    },
  });
}

// Map object mutations
export function useCreateMapObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      mapId,
      data,
    }: {
      mapId: string;
      data: Partial<SectorMapObject> & { hex_q: number; hex_r: number };
    }) => sectorMapApi.createObject(mapId, data),
    onSuccess: (_result, { mapId }) => {
      queryClient.invalidateQueries({ queryKey: ['sector-map', mapId] });
    },
  });
}

export function useUpdateMapObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SectorMapObject> }) =>
      sectorMapApi.updateObject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
    },
  });
}

export function useDeleteMapObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sectorMapApi.deleteObject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
    },
  });
}

// Waypoint mutations
export function useCreateWaypoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mapId, data }: { mapId: string; data: Partial<SectorWaypoint> }) =>
      sectorMapApi.createWaypoint(mapId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map-active'] });
    },
  });
}

export function useUpdateWaypoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SectorWaypoint> }) =>
      sectorMapApi.updateWaypoint(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map-active'] });
    },
  });
}

export function useDeleteWaypoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sectorMapApi.deleteWaypoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sector-map'] });
      queryClient.invalidateQueries({ queryKey: ['sector-map-active'] });
    },
  });
}
