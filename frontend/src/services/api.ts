// API client for Starship HUD backend

const API_BASE = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Ships
export const shipsApi = {
  list: () => request<Ship[]>('/ships'),
  get: (id: string) => request<Ship>(`/ships/${id}`),
  update: (id: string, data: ShipUpdate) =>
    request<Ship>(`/ships/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getPosture: (id: string) => request<PostureState>(`/ships/${id}/posture`),
  updatePosture: (id: string, posture: string, reason?: string) =>
    request<PostureState>(`/ships/${id}/posture?posture=${posture}${reason ? `&reason=${reason}` : ''}`, {
      method: 'PATCH',
    }),
};

// Panels
export const panelsApi = {
  list: (shipId?: string) =>
    request<Panel[]>(`/panels${shipId ? `?ship_id=${shipId}` : ''}`),
  listByStation: (shipId: string) =>
    request<Record<string, Panel[]>>(`/panels/by-station?ship_id=${shipId}`),
  get: (id: string) => request<PanelWithWidgets>(`/panels/${id}`),
  create: (data: Partial<Panel>) =>
    request<Panel>('/panels', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Panel>) =>
    request<Panel>(`/panels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/panels/${id}`, { method: 'DELETE' }),
  updateLayout: (id: string, widgets: { id: string; x: number; y: number; width: number; height: number }[]) =>
    request<{ updated: number }>(`/panels/${id}/layout`, {
      method: 'POST',
      body: JSON.stringify(widgets),
    }),
};

// Widgets
export const widgetsApi = {
  create: (panelId: string, data: Partial<WidgetInstance>) =>
    request<WidgetInstance>(`/panels/${panelId}/widgets`, {
      method: 'POST',
      body: JSON.stringify({ ...data, panel_id: panelId }),
    }),
  update: (id: string, data: Partial<WidgetInstance>) =>
    request<WidgetInstance>(`/panels/widgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/panels/widgets/${id}`, { method: 'DELETE' }),
};

// System States
export const systemStatesApi = {
  list: (shipId?: string) =>
    request<SystemState[]>(`/system-states${shipId ? `?ship_id=${shipId}` : ''}`),
  get: (id: string) => request<SystemState>(`/system-states/${id}`),
  update: (id: string, data: Partial<SystemState>) =>
    request<SystemState>(`/system-states/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Events
export const eventsApi = {
  list: (shipId: string, options?: { limit?: number; types?: string }) =>
    request<ShipEvent[]>(
      `/events?ship_id=${shipId}${options?.limit ? `&limit=${options.limit}` : ''}${options?.types ? `&types=${options.types}` : ''}`
    ),
  getFeed: (shipId: string, limit = 20) =>
    request<ShipEvent[]>(`/events/feed/${shipId}?limit=${limit}`),
  create: (data: { ship_id: string; type: string; severity: string; message: string; data?: Record<string, unknown> }) =>
    request<ShipEvent>('/events', { method: 'POST', body: JSON.stringify(data) }),
};

// Scenarios
export const scenariosApi = {
  list: (shipId?: string) =>
    request<Scenario[]>(`/scenarios${shipId ? `?ship_id=${shipId}` : ''}`),
  get: (id: string) => request<Scenario>(`/scenarios/${id}`),
  create: (data: Partial<Scenario>) =>
    request<Scenario>('/scenarios', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Scenario>) =>
    request<Scenario>(`/scenarios/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/scenarios/${id}`, { method: 'DELETE' }),
  execute: (id: string) =>
    request<{ scenario_id: string; success: boolean; actions_executed: number; events_emitted: string[]; errors: string[] }>(
      `/scenarios/${id}/execute`,
      { method: 'POST' }
    ),
};

// Assets
export const assetsApi = {
  list: (shipId?: string, assetType?: string) =>
    request<Asset[]>(
      `/assets${shipId ? `?ship_id=${shipId}` : ''}${assetType ? `${shipId ? '&' : '?'}asset_type=${assetType}` : ''}`
    ),
  get: (id: string) => request<Asset>(`/assets/${id}`),
  create: (data: Partial<Asset> & { ship_id: string }) =>
    request<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Asset>) =>
    request<Asset>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/assets/${id}`, { method: 'DELETE' }),
};

// Cargo
export const cargoApi = {
  list: (shipId?: string, category?: string) =>
    request<Cargo[]>(
      `/cargo${shipId ? `?ship_id=${shipId}` : ''}${category ? `${shipId ? '&' : '?'}category=${category}` : ''}`
    ),
  get: (id: string) => request<Cargo>(`/cargo/${id}`),
  create: (data: Partial<Cargo> & { ship_id: string }) =>
    request<Cargo>('/cargo', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Cargo>) =>
    request<Cargo>(`/cargo/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/cargo/${id}`, { method: 'DELETE' }),
};

// Contacts
export const contactsApi = {
  list: (shipId?: string, threatLevel?: string) =>
    request<Contact[]>(
      `/contacts${shipId ? `?ship_id=${shipId}` : ''}${threatLevel ? `${shipId ? '&' : '?'}threat_level=${threatLevel}` : ''}`
    ),
  get: (id: string) => request<Contact>(`/contacts/${id}`),
  create: (data: Partial<Contact> & { ship_id: string }) =>
    request<Contact>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Contact>) =>
    request<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/contacts/${id}`, { method: 'DELETE' }),
};

// Type imports for the functions above
import type {
  Ship,
  ShipUpdate,
  Panel,
  PanelWithWidgets,
  WidgetInstance,
  SystemState,
  ShipEvent,
  Scenario,
  PostureState,
  Asset,
  Cargo,
  Contact,
} from '../types';
