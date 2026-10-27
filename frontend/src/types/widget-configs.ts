/**
 * Per-widget config type definitions and defaults.
 *
 * Each widget reads its config from `instance.config`. These interfaces
 * document the expected shape and provide type safety when accessed via
 * the `getConfig<T>()` helper.
 *
 * `*_DEFAULTS` objects are the single source of default values: the widget
 * renderer falls back to them, the config editor displays them, the registry
 * exposes them as `defaultConfig`, and new widgets are created with them.
 */

import type { AssetType } from './index';

/** Theme-following accent colour used as the default for decorative widgets. */
export const ACCENT_COLOR = 'var(--color-accent-cyan, #00d4ff)';

export type FxGlow = 'low' | 'medium' | 'high';
export type FxThickness = 'thin' | 'normal' | 'thick';
export type FxEffect = 'none' | 'flicker' | 'jitter' | 'pulse' | 'strobe';

// ─── Layout Widgets ──────────────────────────────────────────────

export interface TitleConfig {
  text?: string;
}

export const TITLE_DEFAULTS = {
  text: '',
} as const satisfies TitleConfig;

export interface ScanLineConfig {
  speed?: number;
  color?: string;
  direction?: 'down' | 'up' | 'left' | 'right';
  glow?: FxGlow;
  thickness?: FxThickness;
  effect?: FxEffect;
  show_grid?: boolean;
  hide_border?: boolean;
  duration_variance?: number;  // 0-0.5, percentage variance on speed
  delay_variance?: number;     // 0-1, random initial delay as fraction of speed
}

export const SCAN_LINE_DEFAULTS = {
  speed: 4,
  color: ACCENT_COLOR,
  direction: 'down',
  glow: 'medium',
  thickness: 'normal',
  effect: 'none',
  show_grid: true,
  hide_border: false,
  duration_variance: 0,
  delay_variance: 0,
} as const satisfies ScanLineConfig;

export interface PhaseBarsConfig {
  bar_count?: number;      // 1-10, default 4
  bar_width?: number;      // 5-50 (% of widget), default 15
  speed?: number;          // 1-10 seconds, default 3
  orientation?: 'horizontal' | 'vertical';
  color?: string;          // hex color (e.g., #00d4ff)
  base_opacity?: number;   // 0-1, multiplier for bar opacities
  glow?: FxGlow;
  thickness?: number;      // 10-100 (% of perpendicular dimension), default 100
  show_grid?: boolean;
  hide_border?: boolean;
  duration_variance?: number;  // 0-0.5, percentage variance on speed per bar
  delay_variance?: number;     // 0-1, random initial delay per bar
}

export const PHASE_BARS_DEFAULTS = {
  bar_count: 4,
  bar_width: 15,
  speed: 3,
  orientation: 'horizontal',
  color: ACCENT_COLOR,
  base_opacity: 1,
  glow: 'medium',
  thickness: 100,
  show_grid: false,
  hide_border: false,
  duration_variance: 0.2,
  delay_variance: 0,
} as const satisfies PhaseBarsConfig;

export interface RadarPingConfig {
  mode?: 'sweep' | 'pulse' | 'both';
  speed?: number;
  color?: string;
  direction?: 'cw' | 'ccw';
  glow?: FxGlow;
  thickness?: FxThickness;
  effect?: FxEffect;
  show_grid?: boolean;
  ping_frequency?: number;
  hide_border?: boolean;
  duration_variance?: number;  // 0-0.5, percentage variance on sweep/ping timing
  delay_variance?: number;     // 0-1, random initial delay as fraction of speed
}

export const RADAR_PING_DEFAULTS = {
  mode: 'both',
  speed: 4,
  color: ACCENT_COLOR,
  direction: 'cw',
  glow: 'medium',
  thickness: 'normal',
  effect: 'none',
  show_grid: true,
  ping_frequency: 2,
  hide_border: false,
  duration_variance: 0,
  delay_variance: 0,
} as const satisfies RadarPingConfig;

export type PulseOrigin =
  | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PulseConfig {
  origin?: PulseOrigin;
  color?: string;
  ping_frequency?: number;
  glow?: FxGlow;
  thickness?: FxThickness;
  effect?: FxEffect;
  show_grid?: boolean;
  hide_border?: boolean;
  frequency_variance?: number;  // 0-0.5, percentage variance on ping frequency
}

export const PULSE_DEFAULTS = {
  origin: 'bottom-left',
  color: ACCENT_COLOR,
  ping_frequency: 2,
  glow: 'medium',
  thickness: 'normal',
  effect: 'none',
  show_grid: false,
  hide_border: false,
  frequency_variance: 0,
} as const satisfies PulseConfig;

// ─── Display Widgets ─────────────────────────────────────────────

export interface StatusDisplayConfig {
  orientation?: 'horizontal' | 'vertical';
  showLabel?: boolean;
  title?: string;
}

export const STATUS_DISPLAY_DEFAULTS = {
  orientation: 'horizontal',
  showLabel: false,
} as const satisfies StatusDisplayConfig;

export interface HealthBarConfig {
  orientation?: 'horizontal' | 'vertical';
  title?: string;
  segmented?: boolean;       // Show discrete segments instead of smooth fill
  segment_count?: number;    // Number of segments (4-20), default 10
}

export const HEALTH_BAR_DEFAULTS = {
  orientation: 'horizontal',
  segmented: false,
  segment_count: 10,
} as const satisfies HealthBarConfig;

export interface ArcGaugeConfig {
  sweep?: 180 | 270;
  show_ticks?: boolean;
  title?: string;
  unit?: string;
}

export const ARC_GAUGE_DEFAULTS = {
  sweep: 270,
  show_ticks: true,
} as const satisfies ArcGaugeConfig;

export interface NumberDisplayConfig {
  title?: string;
  show_max?: boolean;
  show_unit?: boolean;
  show_status?: boolean;
  show_title?: boolean;
  size?: 'compact' | 'normal';
}

export const NUMBER_DISPLAY_DEFAULTS = {
  show_max: true,
  show_unit: true,
  show_status: true,
  show_title: true,
  size: 'normal',
} as const satisfies NumberDisplayConfig;

export type WaveType = 'sine' | 'sawtooth' | 'square' | 'pulse' | 'heartbeat';

export interface WaveformConfig {
  wave_type?: WaveType;
  show_name?: boolean;
}

export const WAVEFORM_DEFAULTS = {
  wave_type: 'sine',
  show_name: true,
} as const satisfies WaveformConfig;

export interface GifDisplayConfig {
  image_url?: string;
  object_fit?: 'contain' | 'cover' | 'fill';
  opacity?: number;
  status_dim?: boolean;
  hide_border?: boolean;
}

export const GIF_DISPLAY_DEFAULTS = {
  object_fit: 'contain',
  opacity: 1,
  status_dim: false,
  hide_border: false,
} as const satisfies GifDisplayConfig;

// ─── Interactive Widgets ─────────────────────────────────────────

export interface TransmissionConsoleConfig {
  max_messages?: number;
  show_timestamps?: boolean;
  channel_filter?: string[];
  auto_scroll?: boolean;
}

export interface AssetDisplayConfig {
  title?: string;
  asset_type?: AssetType;
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

export const DATA_TABLE_DEFAULTS = {
  dataSource: 'cargo',
} as const satisfies DataTableConfig;

export interface ContactTrackerConfig {
  pinnedContactIds?: string[];
}

export interface CrewStatusConfig {
  showNpcOnly?: boolean;
  showPcOnly?: boolean;
  compactMode?: boolean;
  showHeartbeat?: boolean;  // Show heartbeat animation per crew member
}

export const CREW_STATUS_DEFAULTS = {
  showNpcOnly: false,
  showPcOnly: false,
  compactMode: false,
  showHeartbeat: false,
} as const satisfies CrewStatusConfig;

export interface ShipLogConfig {
  maxEvents?: number;
  showTimestamps?: boolean;
  eventTypes?: string[];
}

export const SHIP_LOG_DEFAULTS = {
  maxEvents: 250,
} as const satisfies ShipLogConfig;

export interface QuickScenariosConfig {
  maxVisible?: number;
  showDescriptions?: boolean;
}

export const QUICK_SCENARIOS_DEFAULTS = {
  maxVisible: 10,
  showDescriptions: true,
} as const satisfies QuickScenariosConfig;

export interface NotesWidgetConfig {
  title?: string;       // Widget header title (default: "Notes")
  showTitle?: boolean;  // Whether to show title (default: true)
  content?: string;     // Markdown content
}

export const NOTES_DEFAULTS = {
  title: 'Notes',
  showTitle: true,
  content: '',
} as const satisfies NotesWidgetConfig;

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

export const CARGO_BAY_DEFAULTS = {
  show_inventory: true,
} as const satisfies CargoBayConfig;

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

export const TICKS_DEFAULTS = {
  tick_count: 4,
  filled_count: 0,
  tick_size: 'medium',
  color: 'secondary',
  orientation: 'horizontal',
  editable: true,
} as const satisfies TicksWidgetConfig;

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

export const SOUNDBOARD_DEFAULTS = {
  title: 'Soundboard',
} as const satisfies SoundboardWidgetConfig;

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

export const SHIELD_DISPLAY_DEFAULTS = {
  segments: [] as ShieldSegment[],
  two_segment_split: 'port_starboard' as const,
  show_labels: false,
  arc_gap_deg: 4,
} satisfies ShieldDisplayConfig;

export interface CountdownTimerConfig {
  timer_id?: string;      // Specific timer to display (legacy, single timer)
  timer_ids?: string[];   // List of timer IDs to show (if set, filters to these)
  show_label?: boolean;   // Show timer label (default: true)
  compact?: boolean;      // Smaller display mode
}

/**
 * Helper to cast a widget's config to a specific type.
 * All properties should be accessed with optional chaining or defaults
 * since config values come from user input and may be missing.
 */
export function getConfig<T>(config: Record<string, unknown>): T {
  return config as T;
}
