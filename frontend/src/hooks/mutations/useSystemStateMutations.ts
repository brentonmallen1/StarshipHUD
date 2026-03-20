import { useMutation, useQueryClient } from '@tanstack/react-query';
import { systemStatesApi, systemCategoriesApi } from '../../services/api';
import type { BulkResetRequest, SystemState, SystemStateCreate, SystemCategory } from '../../types';

export function useBulkResetSystems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkResetRequest) => systemStatesApi.bulkReset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useCreateSystemState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SystemStateCreate) => systemStatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
    },
  });
}

export function useUpdateSystemState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SystemState> }) =>
      systemStatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
      queryClient.invalidateQueries({ queryKey: ['system-state'] });
    },
  });
}

export function useDeleteSystemState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => systemStatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
    },
  });
}

// ============================================================================
// SYSTEM CATEGORY MUTATIONS
// ============================================================================

export function useCreateSystemCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SystemCategory> & { ship_id: string; name: string; color: string }) =>
      systemCategoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-categories'] });
    },
  });
}

export function useUpdateSystemCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SystemCategory> }) =>
      systemCategoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-categories'] });
      // Also refresh system states since they may show category info
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
    },
  });
}

export function useDeleteSystemCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => systemCategoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-categories'] });
      // System states will have their category_id set to null
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
    },
  });
}
