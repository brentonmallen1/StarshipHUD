import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../../services/api';
import type { ShipEvent, TransmissionChannel } from '../../types';

// ============================================================================
// TRANSMISSION MUTATIONS
// ============================================================================

export interface TransmissionCreateData {
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

export interface DecryptionAttemptData {
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

export interface AlertCreateData {
  ship_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  transmitted?: boolean;
  data: {
    category?: string;
    location?: string;
    acknowledged: boolean;
    ship_wide?: boolean;
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
        transmitted: data.transmitted ?? true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
    },
  });
}

export function useTransmitAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.update(id, { transmitted: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
    },
  });
}

export function useUntransmitAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.update(id, { transmitted: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
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

export function useAcknowledgeAllAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertIds: string[]) => {
      // Acknowledge all alerts in parallel
      const results = await Promise.all(
        alertIds.map(async (id) => {
          const event = await eventsApi.get(id);
          if (!event) return null;
          const data = event.data as Record<string, unknown>;
          return eventsApi.update(id, {
            data: {
              ...data,
              acknowledged: true,
              acknowledged_at: new Date().toISOString(),
            },
          });
        })
      );
      return results.filter(Boolean);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
    },
  });
}

export function useClearAllAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertIds: string[]) => {
      // Clear all alerts in parallel
      await Promise.all(alertIds.map((id) => eventsApi.delete(id)));
      return { cleared: alertIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
    },
  });
}

// ============================================================================
// GM LOG ENTRY MUTATIONS
// ============================================================================

export interface LogEntryCreateData {
  ship_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  transmitted?: boolean;
}

export function useCreateLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LogEntryCreateData) =>
      eventsApi.create({
        ship_id: data.ship_id,
        type: 'log_entry',
        severity: data.severity,
        message: data.message,
        source: 'gm',
        transmitted: data.transmitted ?? false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
    },
  });
}

export function useTransmitLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.update(id, { transmitted: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
    },
  });
}

export function useUntransmitLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.update(id, { transmitted: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
    },
  });
}

export function useDeleteLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
      queryClient.invalidateQueries({ queryKey: ['event-feed'] });
    },
  });
}

export function useUpdateLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { severity?: string; message?: string } }) =>
      eventsApi.update(id, data as Partial<ShipEvent>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['ship-log'] });
    },
  });
}
