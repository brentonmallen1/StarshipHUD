import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shipsApi } from '../../services/api';
import type { Ship, ShipCreate, ShipUpdate } from '../../types';

export function useCreateShip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ShipCreate) => shipsApi.create(data),
    onSuccess: (newShip) => {
      queryClient.setQueriesData<Ship[]>(
        { queryKey: ['ships'] },
        (oldData) => oldData ? [...oldData, newShip] : [newShip]
      );
      queryClient.invalidateQueries({ queryKey: ['ships'] });
    },
  });
}

export function useUpdateShip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ShipUpdate }) =>
      shipsApi.update(id, data),
    onSuccess: (updatedShip) => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      queryClient.invalidateQueries({ queryKey: ['ship'] });
      // Update the ship in any cached data
      queryClient.setQueriesData<Ship[]>(
        { queryKey: ['ships'] },
        (oldData) => oldData?.map(s => s.id === updatedShip.id ? updatedShip : s)
      );
    },
  });
}

export function useDeleteShip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shipsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueriesData<Ship[]>(
        { queryKey: ['ships'] },
        (oldData) => oldData?.filter(s => s.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      // Clear ship-specific caches since data is deleted
      queryClient.invalidateQueries({ queryKey: ['ship'] });
    },
  });
}

export function useUpdatePosture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shipId, posture, reason }: { shipId: string; posture: string; reason?: string }) =>
      shipsApi.updatePosture(shipId, posture, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posture'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
