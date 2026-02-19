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

// Session (ship selection)
export const sessionApi = {
  setShip: (shipId: string) =>
    request<{ ship_id: string }>('/session/ship', {
      method: 'POST',
      body: JSON.stringify({ ship_id: shipId }),
      credentials: 'include',
    }),
  getShip: () =>
    request<{ ship_id: string | null }>('/session/ship', {
      credentials: 'include',
    }),
  clearShip: () =>
    request<{ ship_id: null }>('/session/ship', {
      method: 'DELETE',
      credentials: 'include',
    }),
};

// Ships
export const shipsApi = {
  list: () => request<Ship[]>('/ships'),
  get: (id: string) => request<Ship>(`/ships/${id}`),
  create: (data: ShipCreate) =>
    request<Ship>('/ships', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: ShipUpdate) =>
    request<Ship>(`/ships/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/ships/${id}`, { method: 'DELETE' }),
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
  list: (shipId?: string, category?: string) => {
    const params = new URLSearchParams();
    if (shipId) params.append('ship_id', shipId);
    if (category) params.append('category', category);
    const queryString = params.toString();
    return request<SystemState[]>(`/system-states${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => request<SystemState>(`/system-states/${id}`),
  update: (id: string, data: Partial<SystemState>) =>
    request<SystemState>(`/system-states/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  bulkReset: (data: BulkResetRequest) =>
    request<BulkResetResult>('/system-states/bulk-reset', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Events
export const eventsApi = {
  list: (shipId: string, options?: { limit?: number; types?: string; transmitted?: boolean }) => {
    const params = new URLSearchParams();
    params.append('ship_id', shipId);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.types) params.append('types', options.types);
    if (options?.transmitted !== undefined) params.append('transmitted', String(options.transmitted));
    return request<ShipEvent[]>(`/events?${params.toString()}`);
  },
  getFeed: (shipId: string, limit = 20, transmitted?: boolean) => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (transmitted !== undefined) params.append('transmitted', String(transmitted));
    return request<ShipEvent[]>(`/events/feed/${shipId}?${params.toString()}`);
  },
  get: (id: string) => request<ShipEvent>(`/events/${id}`),
  create: (data: { ship_id: string; type: string; severity: string; message: string; data?: Record<string, unknown>; transmitted?: boolean }) =>
    request<ShipEvent>('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ShipEvent>) =>
    request<ShipEvent>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/events/${id}`, { method: 'DELETE' }),
};

// Scenarios
export const scenariosApi = {
  list: (shipId?: string) =>
    request<Scenario[]>(`/scenarios${shipId ? `?ship_id=${shipId}` : ''}`),
  get: (id: string) => request<Scenario>(`/scenarios/${id}`),
  create: (data: ScenarioCreate) =>
    request<Scenario>('/scenarios', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: ScenarioUpdate) =>
    request<Scenario>(`/scenarios/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/scenarios/${id}`, { method: 'DELETE' }),
  execute: (id: string) =>
    request<ScenarioExecuteResult>(`/scenarios/${id}/execute`, { method: 'POST' }),
  rehearse: (id: string) =>
    request<ScenarioRehearsalResult>(`/scenarios/${id}/rehearse`, { method: 'POST' }),
  reorder: (shipId: string, scenarioIds: string[]) =>
    request<Scenario[]>(`/scenarios/reorder?ship_id=${shipId}`, {
      method: 'POST',
      body: JSON.stringify(scenarioIds),
    }),
  duplicate: (id: string) =>
    request<Scenario>(`/scenarios/${id}/duplicate`, { method: 'POST' }),
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
  fire: (id: string) =>
    request<Asset>(`/assets/${id}/fire`, { method: 'POST' }),
};

// Cargo
export const cargoApi = {
  list: (shipId?: string, category?: string, unplaced?: boolean) => {
    const params = new URLSearchParams();
    if (shipId) params.append('ship_id', shipId);
    if (category) params.append('category', category);
    if (unplaced !== undefined) params.append('unplaced', String(unplaced));
    const query = params.toString();
    return request<Cargo[]>(`/cargo${query ? `?${query}` : ''}`);
  },
  get: (id: string) => request<Cargo>(`/cargo/${id}`),
  create: (data: Partial<Cargo> & { ship_id: string }) =>
    request<Cargo>('/cargo', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Cargo>) =>
    request<Cargo>(`/cargo/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/cargo/${id}`, { method: 'DELETE' }),
};

// Cargo Bays
export const cargoBaysApi = {
  list: (shipId?: string) =>
    request<CargoBay[]>(`/cargo-bays${shipId ? `?ship_id=${shipId}` : ''}`),
  get: (id: string) => request<CargoBay>(`/cargo-bays/${id}`),
  getWithPlacements: (id: string) =>
    request<CargoBayWithPlacements>(`/cargo-bays/${id}/with-placements`),
  create: (data: Partial<CargoBay> & { ship_id: string }) =>
    request<CargoBay>('/cargo-bays', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CargoBay>) =>
    request<CargoBay>(`/cargo-bays/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/cargo-bays/${id}`, { method: 'DELETE' }),
};

// Cargo Categories
export const cargoCategoriesApi = {
  list: (shipId?: string) =>
    request<CargoCategory[]>(`/cargo-categories${shipId ? `?ship_id=${shipId}` : ''}`),
  get: (id: string) => request<CargoCategory>(`/cargo-categories/${id}`),
  create: (data: Partial<CargoCategory> & { ship_id: string }) =>
    request<CargoCategory>('/cargo-categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CargoCategory>) =>
    request<CargoCategory>(`/cargo-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/cargo-categories/${id}`, { method: 'DELETE' }),
};

// Cargo Placements
export const cargoPlacementsApi = {
  list: (bayId?: string, cargoId?: string) => {
    const params = new URLSearchParams();
    if (bayId) params.append('bay_id', bayId);
    if (cargoId) params.append('cargo_id', cargoId);
    const query = params.toString();
    return request<CargoPlacement[]>(`/cargo-placements${query ? `?${query}` : ''}`);
  },
  get: (id: string) => request<CargoPlacement>(`/cargo-placements/${id}`),
  validate: (data: { cargo_id: string; bay_id: string; x: number; y: number; rotation?: number }) =>
    request<{ valid: boolean; reason?: string; occupied_tiles: [number, number][] }>(
      '/cargo-placements/validate',
      { method: 'POST', body: JSON.stringify(data) }
    ),
  create: (data: { cargo_id: string; bay_id: string; x: number; y: number; rotation?: number }) =>
    request<CargoPlacement>('/cargo-placements', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { x?: number; y?: number; rotation?: number }) =>
    request<CargoPlacement>(`/cargo-placements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/cargo-placements/${id}`, { method: 'DELETE' }),
  deleteByCargo: (cargoId: string) =>
    request<{ deleted: boolean }>(`/cargo-placements/by-cargo/${cargoId}`, { method: 'DELETE' }),
  getShapes: () =>
    request<Record<string, Array<{ variant: number; tiles: [number, number][]; tile_count: number }>>>(
      '/cargo-placements/shapes/all'
    ),
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

// Crew
export const crewApi = {
  list: (shipId?: string, status?: string, isNpc?: boolean) => {
    const params = new URLSearchParams();
    if (shipId) params.append('ship_id', shipId);
    if (status) params.append('status', status);
    if (isNpc !== undefined) params.append('is_npc', String(isNpc));
    const queryString = params.toString();
    return request<Crew[]>(`/crew${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => request<Crew>(`/crew/${id}`),
  create: (data: Partial<Crew> & { ship_id: string }) =>
    request<Crew>('/crew', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Crew>) =>
    request<Crew>(`/crew/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/crew/${id}`, { method: 'DELETE' }),
};

// Sensor Contacts (radar/sensor display)
export const sensorContactsApi = {
  list: (shipId?: string, visible?: boolean, threatLevel?: ThreatLevel) => {
    const params = new URLSearchParams();
    if (shipId) params.append('ship_id', shipId);
    if (visible !== undefined) params.append('visible', String(visible));
    if (threatLevel) params.append('threat_level', threatLevel);
    const queryString = params.toString();
    return request<SensorContact[]>(`/sensor-contacts${queryString ? `?${queryString}` : ''}`);
  },
  listWithDossiers: (shipId?: string, visible?: boolean, threatLevel?: ThreatLevel) => {
    const params = new URLSearchParams();
    if (shipId) params.append('ship_id', shipId);
    if (visible !== undefined) params.append('visible', String(visible));
    if (threatLevel) params.append('threat_level', threatLevel);
    const queryString = params.toString();
    return request<SensorContactWithDossier[]>(`/sensor-contacts/with-dossiers${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => request<SensorContact>(`/sensor-contacts/${id}`),
  create: (data: SensorContactCreate) =>
    request<SensorContact>('/sensor-contacts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: SensorContactUpdate) =>
    request<SensorContact>(`/sensor-contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  reveal: (id: string) =>
    request<SensorContact>(`/sensor-contacts/${id}/reveal`, { method: 'PATCH' }),
  hide: (id: string) =>
    request<SensorContact>(`/sensor-contacts/${id}/hide`, { method: 'PATCH' }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/sensor-contacts/${id}`, { method: 'DELETE' }),
};

// Holomap
export const holomapApi = {
  // Layers
  listLayers: (shipId?: string, visibleOnly = false) =>
    request<HolomapLayer[]>(
      `/holomap/layers${shipId ? `?ship_id=${shipId}` : ''}${visibleOnly ? `${shipId ? '&' : '?'}visible=true` : ''}`
    ),
  getLayer: (id: string, visibleMarkersOnly = false) =>
    request<HolomapLayerWithMarkers>(`/holomap/layers/${id}${visibleMarkersOnly ? '?visible_markers_only=true' : ''}`),
  createLayer: (data: Partial<HolomapLayer> & { ship_id: string }) =>
    request<HolomapLayer>('/holomap/layers', { method: 'POST', body: JSON.stringify(data) }),
  updateLayer: (id: string, data: Partial<HolomapLayer>) =>
    request<HolomapLayer>(`/holomap/layers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLayer: (id: string) =>
    request<{ deleted: boolean }>(`/holomap/layers/${id}`, { method: 'DELETE' }),
  // Markers
  listMarkers: (layerId: string) =>
    request<HolomapMarker[]>(`/holomap/layers/${layerId}/markers`),
  createMarker: (layerId: string, data: Partial<HolomapMarker>) =>
    request<HolomapMarker>(`/holomap/layers/${layerId}/markers`, { method: 'POST', body: JSON.stringify(data) }),
  getMarker: (id: string) => request<HolomapMarker>(`/holomap/markers/${id}`),
  updateMarker: (id: string, data: Partial<HolomapMarker>) =>
    request<HolomapMarker>(`/holomap/markers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMarker: (id: string) =>
    request<{ deleted: boolean }>(`/holomap/markers/${id}`, { method: 'DELETE' }),
  // Image upload
  uploadLayerImage: async (layerId: string, file: File): Promise<HolomapImageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/holomap/layers/${layerId}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },
  deleteLayerImage: (layerId: string) =>
    request<{ deleted: boolean; image_url: string }>(`/holomap/layers/${layerId}/image`, { method: 'DELETE' }),
};

// Tasks
export const tasksApi = {
  list: (shipId?: string, station?: string, status?: string) => {
    const params = new URLSearchParams();
    if (shipId) params.append('ship_id', shipId);
    if (station) params.append('station', station);
    if (status) params.append('status', status);
    const queryString = params.toString();
    return request<Task[]>(`/tasks${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => request<Task>(`/tasks/${id}`),
  create: (data: Partial<Task> & { ship_id: string; title: string; station: string }) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { status?: string; claimed_by?: string; title?: string; description?: string; station?: string; time_limit?: number }) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  claim: (id: string, claimedBy: string) =>
    request<Task>(`/tasks/${id}/claim?claimed_by=${encodeURIComponent(claimedBy)}`, { method: 'POST' }),
  complete: (id: string, status: 'succeeded' | 'failed') =>
    request<Task>(`/tasks/${id}/complete?status=${status}`, { method: 'POST' }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
};

// Widget Asset Uploads
export const widgetAssetsApi = {
  upload: async (file: File): Promise<{ image_url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/uploads/widget-assets`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },
  delete: (imageUrl: string) =>
    request<{ deleted: boolean }>(
      `/uploads/widget-assets?image_url=${encodeURIComponent(imageUrl)}`,
      { method: 'DELETE' }
    ),
};

// Type imports for the functions above
import type {
  Ship,
  ShipCreate,
  ShipUpdate,
  Panel,
  PanelWithWidgets,
  WidgetInstance,
  SystemState,
  ShipEvent,
  Scenario,
  ScenarioCreate,
  ScenarioUpdate,
  ScenarioExecuteResult,
  ScenarioRehearsalResult,
  PostureState,
  Asset,
  Cargo,
  CargoBay,
  CargoBayWithPlacements,
  CargoCategory,
  CargoPlacement,
  Contact,
  Crew,
  ThreatLevel,
  SensorContact,
  SensorContactWithDossier,
  SensorContactCreate,
  SensorContactUpdate,
  BulkResetRequest,
  BulkResetResult,
  HolomapLayer,
  HolomapLayerWithMarkers,
  HolomapMarker,
  HolomapImageUploadResponse,
  Task,
} from '../types';
