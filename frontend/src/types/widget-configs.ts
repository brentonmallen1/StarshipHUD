/**
 * Per-widget config type definitions.
 *
 * Each widget reads its config from `instance.config`. These interfaces
 * document the expected shape and provide type safety when accessed via
 * the `getConfig<T>()` helper.
 */

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
}

export interface ArcGaugeConfig {
  sweep?: 180 | 270;
  show_ticks?: boolean;
  title?: string;
  unit?: string;
}

export interface WaveformConfig {
  wave_type?: 'sine' | 'sawtooth' | 'square' | 'pulse';
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
}

export interface ContactTrackerConfig {
  pinnedContactIds?: string[];
}

export interface CrewStatusConfig {
  showNpcOnly?: boolean;
  showPcOnly?: boolean;
  compactMode?: boolean;
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
}

export interface SystemDependenciesConfig {
  show_legend?: boolean;
  highlight_capped?: boolean;
  category_filter?: string;
}

/**
 * Helper to cast a widget's config to a specific type.
 * All properties should be accessed with optional chaining or defaults
 * since config values come from user input and may be missing.
 */
export function getConfig<T>(config: Record<string, unknown>): T {
  return config as T;
}
