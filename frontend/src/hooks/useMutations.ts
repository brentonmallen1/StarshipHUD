import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi, cargoApi, contactsApi, eventsApi, holomapApi, scenariosApi, sensorContactsApi, shipsApi, systemStatesApi, tasksApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type {
  Asset,
  BulkResetRequest,
  Cargo,
  Contact,
  HolomapLayer,
  HolomapMarker,
  Scenario,
  ScenarioCreate,
  ScenarioUpdate,
  SensorContact,
  SensorContactCreate,
  SensorContactUpdate,
  Ship,
  ShipEvent,
  ShipUpdate,
  SystemState,
  Task,
  TransmissionChannel,
} from '../types';

// ============================================================================
// SHIP MUTATIONS
// ============================================================================

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

// ============================================================================
// SCENARIO MUTATIONS
// ============================================================================

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

// ============================================================================
// BULK RESET MUTATIONS
// ============================================================================

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

// ============================================================================
// ASSET MUTATIONS
// ============================================================================

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Asset> }) =>
      assetsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset'] });
    },
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Asset> & { ship_id: string }) =>
      assetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

// ============================================================================
// CARGO MUTATIONS
// ============================================================================

export function useUpdateCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Cargo> }) =>
      cargoApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
  });
}

export function useCreateCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Cargo> & { ship_id: string }) =>
      cargoApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
  });
}

export function useDeleteCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cargoApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
  });
}

// ============================================================================
// CONTACT MUTATIONS
// ============================================================================

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contact> }) =>
      contactsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact'] });
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Contact> & { ship_id: string }) =>
      contactsApi.create(data),
    onSuccess: (newContact) => {
      // Add the new contact to the cache immediately for instant UI feedback
      queryClient.setQueriesData<Contact[]>(
        { queryKey: ['contacts'] },
        (oldData) => oldData ? [...oldData, newContact] : [newContact]
      );
      // Also invalidate to ensure consistency with server
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// ============================================================================
// SENSOR CONTACT MUTATIONS (Radar/Sensor Display)
// ============================================================================

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

// ============================================================================
// SYSTEM STATE MUTATIONS
// ============================================================================

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

// ============================================================================
// HOLOMAP MUTATIONS
// ============================================================================

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

// ============================================================================
// TRANSMISSION MUTATIONS
// ============================================================================

interface TransmissionCreateData {
  ship_id: string;
  sender_name: string;
  channel: TransmissionChannel;
  encrypted: boolean;
  signal_strength: number;
  frequency?: string;
  text: string;
  transmitted?: boolean;
  // Minigame fields
  difficulty?: 'easy' | 'medium' | 'hard';
  minigame_seed?: number;
}

export function useCreateTransmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TransmissionCreateData) =>
      eventsApi.create({
        ship_id: data.ship_id,
        type: 'transmission_received',
        severity: data.channel === 'distress' ? 'critical' : 'info',
        message: `Incoming transmission from ${data.sender_name}`,
        data: {
          sender_name: data.sender_name,
          channel: data.channel,
          encrypted: data.encrypted,
          signal_strength: data.signal_strength,
          frequency: data.frequency,
          text: data.text,
          // Minigame fields (only if encrypted)
          ...(data.encrypted && {
            difficulty: data.difficulty,
            minigame_seed: data.minigame_seed,
            decrypted: false,
            decryption_attempts: 0,
            decryption_locked: false,
          }),
        },
        transmitted: data.transmitted ?? false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmissions'] });
      queryClient.invalidateQueries({ queryKey: ['transmissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateTransmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ShipEvent> }) =>
      eventsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmissions'] });
      queryClient.invalidateQueries({ queryKey: ['transmissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useTransmitTransmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.update(id, { transmitted: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmissions'] });
      queryClient.invalidateQueries({ queryKey: ['transmissions-all'] });
    },
  });
}

export function useUntransmitTransmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.update(id, { transmitted: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmissions'] });
      queryClient.invalidateQueries({ queryKey: ['transmissions-all'] });
    },
  });
}

export function useDeleteTransmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmissions'] });
      queryClient.invalidateQueries({ queryKey: ['transmissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// ============================================================================
// DECRYPTION MUTATIONS
// ============================================================================

interface DecryptionAttemptData {
  id: string;
  success: boolean;
  cooldownSeconds?: number;
  maxRetries?: number;
}

export function useAttemptDecryption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, success, cooldownSeconds = 30, maxRetries = 3 }: DecryptionAttemptData) => {
      // Get the current event by ID
      const event = await eventsApi.get(id);
      if (!event) throw new Error('Transmission not found');

      const data = event.data as Record<string, unknown>;
      const currentAttempts = (data.decryption_attempts as number) || 0;
      const newAttempts = currentAttempts + 1;

      if (success) {
        // Successful decryption
        return eventsApi.update(id, {
          data: {
            ...data,
            decrypted: true,
          },
        });
      } else {
        // Failed attempt
        const isLocked = newAttempts >= maxRetries;
        const cooldownUntil = isLocked
          ? undefined
          : new Date(Date.now() + cooldownSeconds * 1000).toISOString();

        return eventsApi.update(id, {
          data: {
            ...data,
            decryption_attempts: newAttempts,
            decryption_locked: isLocked,
            decryption_cooldown_until: cooldownUntil,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmissions'] });
      queryClient.invalidateQueries({ queryKey: ['transmissions-all'] });
    },
  });
}

export function useResetDecryption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Get the current event by ID
      const event = await eventsApi.get(id);
      if (!event) throw new Error('Transmission not found');

      const data = event.data as Record<string, unknown>;

      return eventsApi.update(id, {
        data: {
          ...data,
          decrypted: false,
          decryption_attempts: 0,
          decryption_locked: false,
          decryption_cooldown_until: undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmissions'] });
      queryClient.invalidateQueries({ queryKey: ['transmissions-all'] });
    },
  });
}

// ============================================================================
// ALERT MUTATIONS
// ============================================================================

interface AlertCreateData {
  ship_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: {
    category?: string;
    location?: string;
    acknowledged: boolean;
  };
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AlertCreateData) =>
      eventsApi.create({
        ship_id: data.ship_id,
        type: 'alert',
        severity: data.severity,
        message: data.message,
        data: data.data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
    },
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Get the current event by ID
      const event = await eventsApi.get(id);
      if (!event) throw new Error('Alert not found');

      const data = event.data as Record<string, unknown>;

      return eventsApi.update(id, {
        data: {
          ...data,
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
    },
  });
}

export function useClearAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
    },
  });
}

// ============================================================================
// TASK MUTATIONS
// ============================================================================

export function useClaimTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, claimedBy }: { taskId: string; claimedBy: string }) =>
      tasksApi.claim(taskId, claimedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: 'succeeded' | 'failed' }) =>
      tasksApi.complete(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Task> & { ship_id: string; title: string; station: string }) =>
      tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
