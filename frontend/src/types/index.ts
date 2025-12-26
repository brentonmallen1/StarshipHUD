// Core types for the Starship HUD

export type SystemStatus =
  | 'fully_operational'
  | 'operational'
  | 'degraded'
  | 'compromised'
  | 'critical'
  | 'destroyed'
  | 'offline';

export type StationGroup =
  | 'command'
  | 'engineering'
  | 'sensors'
  | 'tactical'
  | 'life_support'
  | 'communications'
  | 'operations'
  | 'admin';

export type Role = 'player' | 'gm';

export type Posture = 'green' | 'yellow' | 'red' | 'silent_running' | 'general_quarters';

export type EventSeverity = 'info' | 'warning' | 'critical';

// Ship
export interface Ship {
  id: string;
  name: string;
  ship_class?: string;
  registry?: string;
  description?: string;
  attributes?: Record<string, string | number | boolean>;
  created_at: string;
  updated_at: string;
}

export interface ShipUpdate {
  name?: string;
  ship_class?: string;
  registry?: string;
  description?: string;
  attributes?: Record<string, string | number | boolean>;
}

// Panel
export interface Panel {
  id: string;
  ship_id: string;
  name: string;
  station_group: StationGroup;
  role_visibility: Role[];
  sort_order: number;
  icon_id?: string;
  description?: string;
  grid_columns: number;
  grid_rows: number;
  created_at: string;
  updated_at: string;
}

export interface PanelWithWidgets extends Panel {
  widgets: WidgetInstance[];
}

// Widget Instance
export interface WidgetInstance {
  id: string;
  panel_id: string;
  widget_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: Record<string, unknown>;
  bindings: WidgetBindings;
  label?: string;
  created_at: string;
  updated_at: string;
}

export interface WidgetBindings {
  system_state_id?: string;
  system_state_ids?: string[];
  dataset_id?: string;
  asset_id?: string;
  [key: string]: unknown;
}

// System State
export interface SystemState {
  id: string;
  ship_id: string;
  name: string;
  status: SystemStatus;
  value: number;
  max_value: number;
  unit: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

// Asset (weapons, drones, probes)
export type AssetType =
  | 'energy_weapon'
  | 'torpedo'
  | 'missile'
  | 'railgun'
  | 'laser'
  | 'particle_beam'
  | 'drone'
  | 'probe';

export type FireMode = 'single' | 'burst' | 'sustained' | 'auto';

export type MountLocation = 'port' | 'starboard' | 'dorsal' | 'ventral' | 'fore' | 'aft';

export interface Asset {
  id: string;
  ship_id: string;
  name: string;
  asset_type: AssetType;
  status: SystemStatus;
  // Ammo/Resources
  ammo_current: number;
  ammo_max: number;
  ammo_type?: string;
  // Combat Stats
  range: number;
  range_unit: string;
  damage?: number;
  accuracy?: number;
  // Timing
  charge_time?: number;
  cooldown?: number;
  // Weapon Mode
  fire_mode?: FireMode;
  // State
  is_armed: boolean;
  is_ready: boolean;
  current_target?: string;
  // Mount/Location
  mount_location?: MountLocation;
  created_at: string;
  updated_at: string;
}

// Cargo
export interface Cargo {
  id: string;
  ship_id: string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  description?: string;
  value?: number;
  location?: string;
  created_at: string;
  updated_at: string;
}

// Contact threat level type
export type ThreatLevel = 'friendly' | 'neutral' | 'suspicious' | 'hostile' | 'unknown';

// Contact (NPC dossier)
export interface Contact {
  id: string;
  ship_id: string;
  name: string;
  affiliation?: string;
  threat_level: ThreatLevel;
  role?: string;
  notes?: string;
  image_url?: string;
  tags: string[];
  last_contacted_at?: string;
  created_at: string;
  updated_at: string;
}

// Event
export interface ShipEvent {
  id: string;
  ship_id: string;
  type: string;
  severity: EventSeverity;
  message: string;
  data: Record<string, unknown>;
  created_at: string;
}

// Scenario
export interface ScenarioAction {
  type: string;
  target?: string;
  value?: unknown;
  data?: Record<string, unknown>;
}

export interface Scenario {
  id: string;
  ship_id: string;
  name: string;
  description?: string;
  actions: ScenarioAction[];
  created_at: string;
  updated_at: string;
}

// Posture State
export interface PostureState {
  ship_id: string;
  posture: Posture;
  posture_set_at: string;
  posture_set_by: string;
  roe: RulesOfEngagement;
  notes?: string;
  updated_at: string;
}

export interface RulesOfEngagement {
  weapons_safeties: 'on' | 'off';
  comms_broadcast: 'open' | 'encrypted' | 'silent';
  transponder: 'active' | 'masked' | 'off';
  sensor_emissions: 'standard' | 'reduced' | 'passive_only';
}

// Widget Registry Types
export interface WidgetRendererProps {
  instance: WidgetInstance;
  systemStates: Map<string, SystemState>;
  isEditing: boolean;
  isSelected: boolean;
  canEditData: boolean;
  onConfigChange?: (config: Record<string, unknown>) => void;
}

export interface WidgetTypeDefinition {
  type: string;
  name: string;
  description: string;
  category: 'display' | 'interactive' | 'layout' | 'specialized';
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  Renderer: React.ComponentType<WidgetRendererProps>;
}
