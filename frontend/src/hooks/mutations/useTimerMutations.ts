import { useMutation, useQueryClient } from '@tanstack/react-query';
import { timersApi } from '../../services/api';
import type { TimerCreate, TimerUpdate } from '../../types';

export function useCreateTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TimerCreate) => timersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });
}

export function useUpdateTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TimerUpdate }) =>
      timersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
  });
}

export function useDeleteTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => timersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });
}

export function useTriggerTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => timersApi.trigger(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
    },
  });
}

export function usePauseTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => timersApi.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
  });
}

export function useResumeTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => timersApi.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
  });
}

export function useResetTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => timersApi.reset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
  });
}
