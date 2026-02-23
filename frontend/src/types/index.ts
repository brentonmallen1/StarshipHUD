// Core types for the Starship HUD

export * from './widget-configs';

export type SystemStatus =
  | 'optimal'
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

export interface ShipCreate {
  name: string;
  ship_class?: string;
  registry?: string;
  description?: string;
  attributes?: Record<string, string | number | boolean>;
  seed_type?: 'blank' | 'full';
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
  compact_type: 'vertical' | 'none';
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

// Limiting Parent (for cascaded status effects)
export interface LimitingParent {
  id: string;
  name: string;
  effective_status: string;
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
  depends_on: string[];
  effective_status?: SystemStatus;  // Computed: status capped by parent dependencies
  limiting_parent?: LimitingParent;  // Parent system causing the status cap (if any)
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
  // Dependencies (system state IDs this asset depends on)
  depends_on: string[];
  effective_status?: SystemStatus;  // Computed: status capped by parent systems
  limiting_parent?: LimitingParent;  // System causing the status cap (if any)
  created_at: string;
  updated_at: string;
}

// Cargo size classes for polyomino system
export type CargoSizeClass = 'tiny' | 'x_small' | 'small' | 'medium' | 'large' | 'x_large' | 'huge';

// Cargo bay sizes
export type CargoBaySize = 'small' | 'medium' | 'large' | 'custom';

// Cargo Category
export interface CargoCategory {
  id: string;
  ship_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// Cargo
export interface Cargo {
  id: string;
  ship_id: string;
  name: string;
  category_id?: string;
  notes?: string;
  color?: string; // Custom color (overrides category color)
  size_class: CargoSizeClass;
  shape_variant: number;
  created_at: string;
  updated_at: string;
  // Deprecated fields (kept for backward compatibility during migration)
  category?: string;
  quantity?: number;
  unit?: string;
  description?: string;
  value?: number;
  location?: string;
}

// Cargo Bay (polyomino grid container)
export interface CargoBay {
  id: string;
  ship_id: string;
  name: string;
  bay_size: CargoBaySize;
  width: number;
  height: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Cargo Placement (position of cargo in a bay)
export interface CargoPlacement {
  id: string;
  cargo_id: string;
  bay_id: string;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
  created_at: string;
  updated_at: string;
}

// Cargo placement with embedded cargo details
export interface CargoPlacementWithCargo extends CargoPlacement {
  cargo: {
    id: string;
    name: string;
    category_id?: string;
    category_name?: string;
    category_color?: string;
    notes?: string;
    color?: string;
    size_class: CargoSizeClass;
    shape_variant: number;
    // Deprecated fields
    category?: string;
    quantity?: number;
    unit?: string;
    description?: string;
    value?: number;
    location?: string;
  };
}

// Cargo bay with all placements
export interface CargoBayWithPlacements extends CargoBay {
  placements: CargoPlacementWithCargo[];
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

// Crew Status type (duty-focused)
export type CrewStatus =
  | 'fit_for_duty'
  | 'light_duty'
  | 'incapacitated'
  | 'critical'
  | 'deceased'
  | 'on_leave'
  | 'missing';

// Crew Member
export interface Crew {
  id: string;
  ship_id: string;
  name: string;
  role?: string;
  status: CrewStatus;
  player_name?: string;
  is_npc: boolean;
  notes?: string;
  condition_tags: string[];
  created_at: string;
  updated_at: string;
}

// Sensor Contact (radar/sensor display)
// Uses ThreatLevel from contacts for consistency
export interface SensorContact {
  id: string;
  ship_id: string;
  label: string;
  contact_id?: string;
  confidence: number;
  threat_level: ThreatLevel;
  bearing_deg?: number;
  range_km?: number;
  vector?: string;
  signal_strength?: number;
  notes?: string;
  visible: boolean;
  first_detected_at: string;
  last_updated_at: string;
  lost_contact_at?: string;
}

export interface SensorContactWithDossier extends SensorContact {
  dossier?: Contact;
}

export interface SensorContactCreate {
  id?: string;
  ship_id: string;
  label: string;
  contact_id?: string;
  confidence?: number;
  threat_level?: ThreatLevel;
  bearing_deg?: number;
  range_km?: number;
  vector?: string;
  signal_strength?: number;
  notes?: string;
  visible?: boolean;
}

export interface SensorContactUpdate {
  label?: string;
  contact_id?: string;
  confidence?: number;
  threat_level?: ThreatLevel;
  bearing_deg?: number;
  range_km?: number;
  vector?: string;
  signal_strength?: number;
  notes?: string;
  visible?: boolean;
}

// Event
export interface ShipEvent {
  id: string;
  ship_id: string;
  type: string;
  severity: EventSeverity;
  message: string;
  data: Record<string, unknown>;
  transmitted: boolean;
  source: string;
  created_at: string;
}

// Transmission types
export type TransmissionChannel = 'distress' | 'hail' | 'internal' | 'broadcast' | 'encrypted' | 'unknown';

export type DecryptionDifficulty = 'easy' | 'medium' | 'hard';

export interface TransmissionData {
  sender_id?: string;
  sender_name: string;
  channel: TransmissionChannel;
  encrypted: boolean;
  signal_strength: number;
  frequency?: string;
  text: string;
  // Minigame fields (only relevant when encrypted=true)
  difficulty?: DecryptionDifficulty;
  decrypted?: boolean;
  decryption_attempts?: number;
  decryption_locked?: boolean;
  decryption_cooldown_until?: string;
  minigame_seed?: number;
}

// Decryption minigame result
export interface DecryptionResult {
  success: boolean;
  progress: number;           // 0.0 to 1.0
  revealed_chunks: string[];  // Partial text reveals during gameplay
  mistakes: number;
  time_ms: number;
  detection_risk: number;     // 0.0 to 1.0
  score: number;
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
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ScenarioCreate {
  ship_id: string;
  name: string;
  description?: string;
  actions: ScenarioAction[];
}

export interface ScenarioUpdate {
  name?: string;
  description?: string;
  actions?: ScenarioAction[];
}

export interface ScenarioExecuteResult {
  scenario_id: string;
  success: boolean;
  actions_executed: number;
  events_emitted: string[];
  errors: string[];
}

// Scenario Rehearsal Types
export interface SystemStatePreview {
  system_id: string;
  system_name: string;
  before_status: string;
  before_value: number;
  after_status: string;
  after_value: number;
  max_value: number;
}

export interface PosturePreview {
  before_posture: string;
  after_posture: string;
}

export interface EventPreview {
  type: string;
  severity: string;
  message: string;
}

export interface ScenarioRehearsalResult {
  scenario_id: string;
  scenario_name: string;
  can_execute: boolean;
  system_changes: SystemStatePreview[];
  posture_change?: PosturePreview;
  events_preview: EventPreview[];
  errors: string[];
  warnings: string[];
}

// Bulk Reset Types
export interface SystemResetSpec {
  system_id: string;
  target_status?: string;
  target_value?: number;
}

export interface BulkResetRequest {
  ship_id: string;
  reset_all?: boolean;
  systems?: SystemResetSpec[];
  emit_event?: boolean;
}

export interface BulkResetResult {
  systems_reset: number;
  event_id?: string;
  errors: string[];
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

// Holomap Types
export type MarkerType = 'breach' | 'fire' | 'hazard' | 'crew' | 'objective' | 'damage' | 'other';

export interface HolomapLayer {
  id: string;
  ship_id: string;
  name: string;
  image_url: string;
  deck_level?: string;
  sort_order: number;
  visible: boolean;
  image_scale: number;
  image_offset_x: number;
  image_offset_y: number;
  created_at: string;
  updated_at: string;
}

export interface HolomapImageUploadResponse {
  image_url: string;
  filename: string;
  width: number;
  height: number;
  aspect_ratio: number;
}

export interface HolomapMarker {
  id: string;
  layer_id: string;
  type: MarkerType;
  x: number;  // 0-1 normalized
  y: number;  // 0-1 normalized
  severity?: EventSeverity;
  label?: string;
  description?: string;
  linked_incident_id?: string;
  linked_task_id?: string;
  visible: boolean;  // Whether marker is visible to players
  created_at: string;
  updated_at: string;
}

export interface HolomapLayerWithMarkers extends HolomapLayer {
  markers: HolomapMarker[];
}

// Task Types
export type TaskStatus = 'pending' | 'active' | 'succeeded' | 'failed' | 'expired';

export interface Task {
  id: string;
  ship_id: string;
  incident_id?: string;
  title: string;
  description?: string;
  station: string;
  status: TaskStatus;
  time_limit?: number;
  expires_at?: string;
  claimed_by?: string;
  started_at?: string;
  completed_at?: string;
  on_success: Record<string, unknown>[];
  on_failure: Record<string, unknown>[];
  on_expire: Record<string, unknown>[];
  visible: boolean;
  created_at: string;
}

// Sector Map
export type SpriteCategory = 'celestial' | 'station' | 'ship' | 'hazard' | 'other';
export type VisibilityState = 'visible' | 'hidden' | 'anomaly';

export interface SectorMap {
  id: string;
  ship_id: string;
  name: string;
  description?: string;
  hex_size: number;
  grid_width: number;
  grid_height: number;
  grid_radius: number;
  background_color: string;
  background_image_url?: string | null;
  bg_scale: number;
  bg_rotation: number;
  bg_offset_x: number;
  bg_offset_y: number;
  bg_opacity: number;
  grid_visible: boolean;
  grid_color: string;
  grid_opacity: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SectorSprite {
  id: string;
  ship_id: string;
  name: string;
  category: SpriteCategory;
  image_url: string;
  default_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectorMapObject {
  id: string;
  map_id: string;
  sprite_id?: string;
  hex_q: number;
  hex_r: number;
  label?: string;
  description?: string;
  scale: number;
  rotation: number;
  visibility_state: VisibilityState;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectorWaypoint {
  id: string;
  map_id: string;
  hex_q: number;
  hex_r: number;
  label?: string;
  color: string;
  created_by: 'gm' | 'player';
  created_at: string;
  updated_at: string;
}

export interface SectorMapWithObjects extends SectorMap {
  objects: SectorMapObject[];
  sprites: SectorSprite[];
  waypoints: SectorWaypoint[];
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
  category: 'display' | 'interactive' | 'layout' | 'specialized' | 'gm';
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  Renderer: React.ComponentType<WidgetRendererProps>;
}
