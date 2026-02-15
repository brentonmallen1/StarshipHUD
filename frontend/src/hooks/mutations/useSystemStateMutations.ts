import { useMutation, useQueryClient } from '@tanstack/react-query';
import { systemStatesApi } from '../../services/api';
import type { BulkResetRequest, SystemState } from '../../types';

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

// Note: System state create/delete not currently exposed in API
// If needed in the future, add:
// export function useCreateSystemState() { ... }
// export function useDeleteSystemState() { ... }
