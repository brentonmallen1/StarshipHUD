import type { SystemState, SystemStatus, WidgetInstance } from '../types';
import { getEffectiveStatus } from '../utils/status';

export interface BoundSystem {
  /** The `bindings.system_state_id` of the widget, if any. */
  systemId: string | undefined;
  /** The bound system, or null when unbound / not (yet) loaded. */
  system: SystemState | null;
  /** Effective status of the bound system (`fallback` when there is none). */
  status: SystemStatus;
}

/**
 * Resolve the system a widget is bound to via `bindings.system_state_id`.
 * Pure lookup (no fetching) — the panel already supplies `systemStates`.
 */
export function useBoundSystem(
  instance: Pick<WidgetInstance, 'bindings'>,
  systemStates: Map<string, SystemState>,
  fallback: SystemStatus = 'offline',
): BoundSystem {
  const raw = instance.bindings?.system_state_id;
  const systemId = typeof raw === 'string' && raw ? raw : undefined;
  const system = systemId ? (systemStates.get(systemId) ?? null) : null;
  return { systemId, system, status: getEffectiveStatus(system, fallback) };
}
