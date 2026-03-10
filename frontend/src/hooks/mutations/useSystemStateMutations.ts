import { useMutation, useQueryClient } from '@tanstack/react-query';
import { systemStatesApi } from '../../services/api';
import type { BulkResetRequest, SystemState, SystemStateCreate } from '../../types';

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
