/**
 * Per-widget config type definitions.
 *
 * Each widget reads its config from `instance.config`. These interfaces
 * document the expected shape and provide type safety when accessed via
 * the `getConfig<T>()` helper.
 */

import type { AssetType } from './index';

// ─── Layout Widgets ──────────────────────────────────────────────

export interface TitleConfig {
  text?: string;
}

export interface ScanLineConfig {
  speed?: number;
  color?: string;
  direction?: 'down' | 'up' | 'left' | 'right';
  glow?: 'low' | 'medium' | 'high';
  thickness?: 'thin' | 'normal' | 'thick';
  effect?: 'none' | 'flicker' | 'jitter' | 'pulse' | 'strobe';
  show_grid?: boolean;
  duration_variance?: number;  // 0-0.5, percentage variance on speed
  delay_variance?: number;     // 0-1, random initial delay as fraction of speed
}

export interface PhaseBarsConfig {
  bar_count?: number;      // 1-10, default 4
  bar_width?: number;      // 5-50 (% of widget), default 15
  speed?: number;          // 1-10 seconds, default 3
  orientation?: 'horizontal' | 'vertical';
  color?: string;          // hex color (e.g., #00d4ff)
  base_opacity?: number;   // 0-1, multiplier for bar opacities
  glow?: 'low' | 'medium' | 'high';
  thickness?: number;      // 10-100 (% of perpendicular dimension), default 100
  show_grid?: boolean;
  hide_border?: boolean;
  duration_variance?: number;  // 0-0.5, percentage variance on speed per bar
  delay_variance?: number;     // 0-1, random initial delay per bar
}

export interface RadarPingConfig {
  mode?: 'sweep' | 'pulse' | 'both';
  speed?: number;
  color?: string;
  direction?: 'cw' | 'ccw';
  glow?: 'low' | 'medium' | 'high';
  thickness?: 'thin' | 'normal' | 'thick';
  effect?: 'none' | 'flicker' | 'jitter' | 'pulse' | 'strobe';
  show_grid?: boolean;
  ping_frequency?: number;
  hide_border?: boolean;
  duration_variance?: number;  // 0-0.5, percentage variance on sweep/ping timing
  delay_variance?: number;     // 0-1, random initial delay as fraction of speed
}

export interface PulseConfig {
  origin?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color?: string;
  ping_frequency?: number;
  glow?: 'low' | 'medium' | 'high';
  thickness?: 'thin' | 'normal' | 'thick';
  effect?: 'none' | 'flicker' | 'jitter' | 'pulse' | 'strobe';
  show_grid?: boolean;
  hide_border?: boolean;
  frequency_variance?: number;  // 0-0.5, percentage variance on ping frequency
}

// ─── Display Widgets ─────────────────────────────────────────────

export interface StatusDisplayConfig {
  orientation?: 'horizontal' | 'vertical';
  showLabel?: boolean;
  title?: string;
}

export interface HealthBarConfig {
  orientation?: 'horizontal' | 'vertical';
  title?: string;
  segmented?: boolean;       // Show discrete segments instead of smooth fill
  segment_count?: number;    // Number of segments (4-20), default 10
}

export interface ArcGaugeConfig {
  sweep?: 180 | 270;
  show_ticks?: boolean;
  title?: string;
  unit?: string;
}

export interface NumberDisplayConfig {
  title?: string;
  show_max?: boolean;
  show_unit?: boolean;
  show_status?: boolean;
  show_title?: boolean;
  size?: 'compact' | 'normal';
}

export interface WaveformConfig {
  wave_type?: 'sine' | 'sawtooth' | 'square' | 'pulse' | 'heartbeat';
  show_name?: boolean;
}

export interface GifDisplayConfig {
  image_url?: string;
  object_fit?: 'contain' | 'cover' | 'fill';
  opacity?: number;
  status_dim?: boolean;
  hide_border?: boolean;
}

// ─── Interactive Widgets ─────────────────────────────────────────

export interface TransmissionConsoleConfig {
  max_messages?: number;
  show_timestamps?: boolean;
  channel_filter?: string[];
  auto_scroll?: boolean;
}

export interface AssetDisplayConfig {
  title?: string;
  asset_type?: string;
  ammo_current?: number;
  ammo_max?: number;
  ammo_type?: string;
  range?: number;
  range_unit?: string;
  damage?: number;
  accuracy?: number;
  charge_time?: number;
  cooldown?: number;
  fire_mode?: string;
  status?: string;
}

export interface DataTableConfig {
  dataSource?: 'cargo' | 'assets' | 'contacts';
  columns?: string[];
  rowsPerPage?: number;
  assetTypes?: AssetType[];
  bayIds?: string[];  // Filter cargo by bay
}

export interface ContactTrackerConfig {
  pinnedContactIds?: string[];
}

export interface CrewStatusConfig {
  showNpcOnly?: boolean;
  showPcOnly?: boolean;
  compactMode?: boolean;
  showHeartbeat?: boolean;  // Show heartbeat animation per crew member
}

export interface ShipLogConfig {
  maxEvents?: number;
  showTimestamps?: boolean;
  eventTypes?: string[];
}

export interface QuickScenariosConfig {
  maxVisible?: number;
  showDescriptions?: boolean;
}

export interface NotesWidgetConfig {
  title?: string;       // Widget header title (default: "Notes")
  showTitle?: boolean;  // Whether to show title (default: true)
  content?: string;     // Markdown content
}

// ─── Specialized Widgets ─────────────────────────────────────────

export interface HolomapConfig {
  layer_id?: string;
  layer_ids?: string[];
  show_legend?: boolean;
}

export interface RadarWidgetConfig {
  range_scales?: number[];
  current_range_scale?: number;
  alert_threshold?: string;
  alert_proximity_km?: number;
  show_sweep?: boolean;
}

export interface CargoBayConfig {
  show_inventory?: boolean;
  bay_ids?: string[];  // If set, only show these bays in the selector
}

export interface SystemDependenciesConfig {
  show_legend?: boolean;
  highlight_capped?: boolean;
  category_filter?: string;
}

export interface TicksWidgetConfig {
  title?: string;             // optional title displayed above ticks
  tick_count?: number;        // 1-20, default 4
  filled_count?: number;      // 0 to tick_count, tracks current state
  tick_size?: 'small' | 'medium' | 'large';  // default 'medium'
  color?: 'primary' | 'secondary' | string;  // default 'secondary'
  orientation?: 'horizontal' | 'vertical';   // default 'horizontal'
  editable?: boolean;         // allow click to edit, default true
}

export interface SceneClock {
  id: string;                    // nanoid for stable reordering
  title: string;                 // clock name
  segments: number;              // 4-12 segments
  filled: number;                // 0 to segments
  direction: 'up' | 'down';      // fill vs drain mode
  color?: string;                // optional color (defaults to theme secondary)
}

export interface SceneClocksWidgetConfig {
  clocks?: SceneClock[];
}

export interface SoundButton {
  id: string;           // UUID for stable drag-drop
  label: string;        // Display text on button
  audioUrl: string;     // URL of uploaded audio file
  loop: boolean;        // Loop when played
}

export interface SoundboardWidgetConfig {
  title?: string;         // Widget title (default: "Soundboard")
  buttons?: SoundButton[];
}

export interface ShieldSegment {
  primary_id?: string;    // outer arc — system state ID
  secondary_id?: string;  // inner arc — system state ID (optional)
  label?: string;         // custom label override
}

export interface ShieldDisplayConfig {
  segments?: ShieldSegment[];
  two_segment_split?: 'port_starboard' | 'fore_aft';
  show_labels?: boolean;
  arc_gap_deg?: number;       // gap in degrees between segments, default 4
  ship_image_url?: string;    // uploaded image replaces default triangle
}

/**
 * Helper to cast a widget's config to a specific type.
 * All properties should be accessed with optional chaining or defaults
 * since config values come from user input and may be missing.
 */
export function getConfig<T>(config: Record<string, unknown>): T {
  return config as T;
}
