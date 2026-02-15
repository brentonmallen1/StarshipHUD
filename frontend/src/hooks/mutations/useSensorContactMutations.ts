import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sensorContactsApi } from '../../services/api';
import type { SensorContact, SensorContactCreate, SensorContactUpdate } from '../../types';

export function useCreateSensorContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SensorContactCreate) =>
      sensorContactsApi.create(data),
    onSuccess: (newContact) => {
      // Optimistically add to cache
      queryClient.setQueriesData<SensorContact[]>(
        { queryKey: ['sensor-contacts-all'] },
        (oldData) => oldData ? [...oldData, newContact] : [newContact]
      );
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all-dossiers'] });
    },
  });
}

export function useUpdateSensorContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SensorContactUpdate }) =>
      sensorContactsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contact'] });
    },
  });
}

export function useDeleteSensorContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sensorContactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all-dossiers'] });
    },
  });
}

export function useRevealSensorContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sensorContactsApi.reveal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all-dossiers'] });
    },
  });
}

export function useHideSensorContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sensorContactsApi.hide(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-contacts-all-dossiers'] });
    },
  });
}
