import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Shared connection state so polling hooks can back off while the stream is up
let connected = false;
const listeners = new Set<() => void>();

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  listeners.forEach((listener) => listener());
}

export function isLiveConnected(): boolean {
  return connected;
}

export function useLiveConnected(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => connected
  );
}

/**
 * Subscribe to the ship's server-sent change stream and refetch active
 * queries whenever the backend reports a mutation, so GM actions show up on
 * player screens immediately. Polling stays on as a fallback.
 */
export function useLiveUpdates(shipId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!shipId || typeof EventSource === 'undefined') return;

    const source = new EventSource(`/api/live/${shipId}`);
    let hadError = false;

    source.onopen = () => {
      setConnected(true);
      // Catch up on anything missed while disconnected
      if (hadError) queryClient.invalidateQueries();
      hadError = false;
    };
    source.onerror = () => {
      hadError = true;
      setConnected(false);
    };
    source.addEventListener('change', () => {
      queryClient.invalidateQueries();
    });

    return () => {
      source.close();
      setConnected(false);
    };
  }, [shipId, queryClient]);
}
