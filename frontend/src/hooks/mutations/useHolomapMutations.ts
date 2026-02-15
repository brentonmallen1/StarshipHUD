import { useMutation, useQueryClient } from '@tanstack/react-query';
import { holomapApi } from '../../services/api';
import type { HolomapLayer, HolomapMarker } from '../../types';

export function useCreateHolomapLayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HolomapLayer> & { ship_id: string }) =>
      holomapApi.createLayer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holomap-layers'] });
    },
  });
}

export function useUpdateHolomapLayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HolomapLayer> }) =>
      holomapApi.updateLayer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holomap-layers'] });
      queryClient.invalidateQueries({ queryKey: ['holomap-layer'] });
    },
  });
}

export function useDeleteHolomapLayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => holomapApi.deleteLayer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holomap-layers'] });
    },
  });
}

export function useCreateHolomapMarker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ layerId, data }: { layerId: string; data: Partial<HolomapMarker> }) =>
      holomapApi.createMarker(layerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holomap-layer'] });
    },
  });
}

export function useUpdateHolomapMarker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HolomapMarker> }) =>
      holomapApi.updateMarker(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holomap-layer'] });
    },
  });
}

export function useDeleteHolomapMarker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => holomapApi.deleteMarker(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holomap-layer'] });
    },
  });
}
