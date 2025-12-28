import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi, cargoApi, contactsApi, eventsApi, holomapApi, scenariosApi, shipsApi, systemStatesApi } from '../services/api';
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
  Ship,
  ShipEvent,
  ShipUpdate,
  SystemState,
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
  return useMutation({
    mutationFn: (id: string) => scenariosApi.execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-states'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['posture'] });
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
