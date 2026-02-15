import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scenariosApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import type { Scenario, ScenarioCreate, ScenarioUpdate } from '../../types';

export function useCreateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ScenarioCreate) => scenariosApi.create(data),
    onSuccess: (newScenario) => {
      queryClient.setQueriesData<Scenario[]>(
        { queryKey: ['scenarios'] },
        (oldData) => oldData ? [...oldData, newScenario] : [newScenario]
      );
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
    },
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScenarioUpdate }) =>
      scenariosApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['scenario'] });
    },
  });
}

export function useDeleteScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => scenariosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
    },
  });
}

export function useExecuteScenario() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: (id: string) => scenariosApi.execute(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['posture'] });
      if (result.success) {
        addToast({
          type: 'success',
          message: `Scenario executed: ${result.actions_executed} action${result.actions_executed !== 1 ? 's' : ''} applied`,
        });
      } else {
        addToast({
          type: 'warning',
          message: `Scenario completed with errors: ${result.errors.join(', ')}`,
          duration: 6000,
        });
      }
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: `Scenario execution failed: ${error.message}`,
        duration: 6000,
      });
    },
  });
}

export function useRehearsalScenario() {
  // This doesn't mutate anything, just fetches preview data
  // But we use useMutation since it's triggered by user action
  return useMutation({
    mutationFn: (id: string) => scenariosApi.rehearse(id),
  });
}

export function useReorderScenarios() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shipId, scenarioIds }: { shipId: string; scenarioIds: string[] }) =>
      scenariosApi.reorder(shipId, scenarioIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
    },
  });
}

export function useDuplicateScenario() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: (id: string) => scenariosApi.duplicate(id),
    onSuccess: (newScenario) => {
      queryClient.setQueriesData<Scenario[]>(
        { queryKey: ['scenarios'] },
        (oldData) => oldData ? [...oldData, newScenario] : [newScenario]
      );
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      addToast({
        type: 'success',
        message: `Scenario duplicated: ${newScenario.name}`,
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: `Failed to duplicate: ${error.message}`,
      });
    },
  });
}
