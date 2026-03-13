import type { WidgetTypeDefinition } from '../../types';
import { TitleWidget } from './TitleWidget';
import { HealthBarWidget } from './HealthBarWidget';
import { StatusDisplayWidget } from './StatusDisplayWidget';
import { TaskQueueWidget } from './TaskQueueWidget';
import { PostureDisplayWidget } from './PostureDisplayWidget';
import { AlertFeedWidget } from './AlertFeedWidget';
import { SpacerWidget } from './SpacerWidget';
import { DividerWidget } from './DividerWidget';

import { TransmissionConsoleWidget } from './TransmissionConsoleWidget';
import { AssetDisplayWidget } from './AssetDisplayWidget';
import { DataTableWidget } from './DataTableWidget';
import { HolomapWidget } from './HolomapWidget';
import { ShipLogWidget } from './ShipLogWidget';
import { ContactTrackerWidget } from './ContactTrackerWidget';
import { CrewStatusWidget } from './CrewStatusWidget';
import { SystemDependenciesWidget } from './SystemDependenciesWidget';
import { RadarWidget } from './RadarWidget';
import { CargoBayWidget } from './CargoBayWidget';
import { ShipOverviewWidget } from './ShipOverviewWidget';
import { SystemStatusOverviewWidget } from './SystemStatusOverviewWidget';
import { QuickScenariosWidget } from './QuickScenariosWidget';
import { ScanLineWidget } from './ScanLineWidget';
import { WaveformWidget } from './WaveformWidget';
import { ArcGaugeWidget } from './ArcGaugeWidget';
import { GifDisplayWidget } from './GifDisplayWidget';
import { RadarPingWidget } from './RadarPingWidget';
import { PulseWidget } from './PulseWidget';
import { ShieldDisplayWidget } from './ShieldDisplayWidget';
import { CountdownTimerWidget } from './CountdownTimerWidget';
import { NumberDisplayWidget } from './NumberDisplayWidget';
import { TicksWidget } from './TicksWidget';
import { SceneClocksWidget } from './SceneClocksWidget';
import { NotesWidget } from './NotesWidget';

/**
 * Widget Registry
 *
 * Central registry of all available widget types with their metadata.
 * Used for widget creation, validation, and rendering.
 */

/**
 * Widget category metadata for display in the widget picker
 */
export interface WidgetCategory {
  id: string;
  name: string;
  description: string;
}

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  { id: 'layout', name: 'Layout & Decoration', description: 'Structural and decorative elements' },
  { id: 'display', name: 'Data Displays', description: 'Read-only system information' },
  { id: 'interactive', name: 'Interactive', description: 'User-interactive controls' },
  { id: 'specialized', name: 'Specialized', description: 'Complex feature widgets' },
  { id: 'gm', name: 'GM Tools', description: 'Game Master controls' },
];

export const WIDGET_TYPES: Record<string, WidgetTypeDefinition> = {
  // Layout Widgets (scaled for 24-col grid, 25px rowHeight)
  title: {
    type: 'title',
    name: 'Title',
    description: 'Panel title with optional subtitle',
    category: 'layout',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 12,
    defaultHeight: 6,
    Renderer: TitleWidget,
  },

  spacer: {
    type: 'spacer',
    name: 'Spacer',
    description: 'Invisible spacer for layout gaps',
    category: 'layout',
    minWidth: 1,
    minHeight: 2,
    defaultWidth: 4,
    defaultHeight: 6,
    Renderer: SpacerWidget,
  },

  divider: {
    type: 'divider',
    name: 'Divider',
    description: 'Visible horizontal separator line',
    category: 'layout',
    minWidth: 1,
    minHeight: 2,
    defaultWidth: 24,
    defaultHeight: 4,
    Renderer: DividerWidget,
  },

  scan_line: {
    type: 'scan_line',
    name: 'Scan Line',
    description: 'Animated scan line sweep for ambient decoration',
    category: 'layout',
    minWidth: 1,
    minHeight: 2,
    defaultWidth: 24,
    defaultHeight: 8,
    Renderer: ScanLineWidget,
  },

  radar_ping: {
    type: 'radar_ping',
    name: 'Radar Ping',
    description: 'Animated radial sweep with expanding ping rings',
    category: 'layout',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 8,
    defaultHeight: 12,
    Renderer: RadarPingWidget,
  },

  pulse: {
    type: 'pulse',
    name: 'Pulse',
    description: 'Expanding pulse rings from an edge or corner',
    category: 'layout',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 8,
    defaultHeight: 8,
    Renderer: PulseWidget,
  },

  // Display Widgets
  status_display: {
    type: 'status_display',
    name: 'Status Display',
    description: 'Shows single system status value',
    category: 'display',
    minWidth: 1,
    minHeight: 2,
    defaultWidth: 6,
    defaultHeight: 6,
    Renderer: StatusDisplayWidget,
  },

  health_bar: {
    type: 'health_bar',
    name: 'Health Bar',
    description: 'Visual health/capacity bar for a system',
    category: 'display',
    minWidth: 1,
    minHeight: 2,
    defaultWidth: 8,
    defaultHeight: 6,
    Renderer: HealthBarWidget,
  },

  arc_gauge: {
    type: 'arc_gauge',
    name: 'Arc Gauge',
    description: 'Semicircular speedometer gauge for a single system',
    category: 'display',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 5,
    defaultHeight: 7,
    Renderer: ArcGaugeWidget,
  },

  number_display: {
    type: 'number_display',
    name: 'Number Display',
    description: 'Large numeric display for a single system value',
    category: 'display',
    minWidth: 2,
    minHeight: 3,
    defaultWidth: 4,
    defaultHeight: 5,
    Renderer: NumberDisplayWidget,
  },

  waveform: {
    type: 'waveform',
    name: 'Waveform',
    description: 'Animated oscilloscope wave reflecting system health',
    category: 'display',
    minWidth: 4,
    minHeight: 2,
    defaultWidth: 24,
    defaultHeight: 3,
    Renderer: WaveformWidget,
  },

  gif_display: {
    type: 'gif_display',
    name: 'GIF Display',
    description: 'Display an uploaded image or animated GIF',
    category: 'display',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 6,
    defaultHeight: 8,
    Renderer: GifDisplayWidget,
  },

  posture_display: {
    type: 'posture_display',
    name: 'Posture & ROE',
    description: 'Interactive ship threat posture with click-to-change controls',
    category: 'interactive',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 8,
    defaultHeight: 18,
    Renderer: PostureDisplayWidget,
  },

  asset_display: {
    type: 'asset_display',
    name: 'Asset Display',
    description: 'Individual weapon, drone, or probe with ammo and stats',
    category: 'display',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 6,
    defaultHeight: 12,
    Renderer: AssetDisplayWidget,
  },

  system_dependencies: {
    type: 'system_dependencies',
    name: 'System Dependencies',
    description: 'Graph showing system dependency relationships with status cascade',
    category: 'display',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 12,
    defaultHeight: 24,
    Renderer: SystemDependenciesWidget,
  },

  data_table: {
    type: 'data_table',
    name: 'Data Table',
    description: 'Tabular data display from a dataset',
    category: 'display',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 12,
    defaultHeight: 24,
    Renderer: DataTableWidget,
  },

  // Interactive Widgets
  alert_feed: {
    type: 'alert_feed',
    name: 'Alert Feed',
    description: 'Scrolling list of recent alerts and events',
    category: 'interactive',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 12,
    defaultHeight: 30,
    Renderer: AlertFeedWidget,
  },

  task_queue: {
    type: 'task_queue',
    name: 'Task Queue',
    description: 'List of active tasks with claim/complete actions',
    category: 'interactive',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 12,
    defaultHeight: 30,
    Renderer: TaskQueueWidget,
  },

  contact_tracker: {
    type: 'contact_tracker',
    name: 'Contact Tracker',
    description: 'Contact list with threat indicators, pinning, and expandable dossiers',
    category: 'interactive',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 10,
    defaultHeight: 24,
    Renderer: ContactTrackerWidget,
  },

  crew_status: {
    type: 'crew_status',
    name: 'Crew Status',
    description: 'Crew health and status display with conditions, for medical/command panels',
    category: 'interactive',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 10,
    defaultHeight: 24,
    Renderer: CrewStatusWidget,
  },

  ticks: {
    type: 'ticks',
    name: 'Ticks',
    description: 'Toggleable progress tracker with parallelogram ticks',
    category: 'interactive',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 6,
    defaultHeight: 4,
    Renderer: TicksWidget,
  },

  transmission_console: {
    type: 'transmission_console',
    name: 'Transmission Console',
    description: 'Incoming transmissions and messages',
    category: 'interactive',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 12,
    defaultHeight: 24,
    Renderer: TransmissionConsoleWidget,
  },

  notes: {
    type: 'notes',
    name: 'Notes',
    description: 'Custom notes with markdown support',
    category: 'interactive',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 8,
    defaultHeight: 8,
    Renderer: NotesWidget,
  },

  // Specialized Widgets
  holomap: {
    type: 'holomap',
    name: 'Holomap',
    description: 'Ship deck plan with real-time markers',
    category: 'specialized',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 12,
    defaultHeight: 24,
    Renderer: HolomapWidget,
  },

  ship_log: {
    type: 'ship_log',
    name: 'Ship Log',
    description: 'Timeline of events with filtering and search',
    category: 'specialized',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 12,
    defaultHeight: 30,
    Renderer: ShipLogWidget,
  },

  radar: {
    type: 'radar',
    name: 'Radar',
    description: 'Polar radar display with sensor contacts',
    category: 'specialized',
    minWidth: 4,
    minHeight: 8,
    defaultWidth: 12,
    defaultHeight: 24,
    Renderer: RadarWidget,
  },

  cargo_bay: {
    type: 'cargo_bay',
    name: 'Cargo Bay',
    description: 'Interactive polyomino cargo bay management',
    category: 'specialized',
    minWidth: 8,
    minHeight: 14,
    defaultWidth: 14,
    defaultHeight: 20,
    Renderer: CargoBayWidget,
  },

  // Display Widgets (new)
  ship_overview: {
    type: 'ship_overview',
    name: 'Ship Overview',
    description: 'Ship information display with optional edit capability',
    category: 'display',
    minWidth: 4,
    minHeight: 8,
    defaultWidth: 12,
    defaultHeight: 14,
    Renderer: ShipOverviewWidget,
  },

  // Interactive Widgets (new)
  system_status_overview: {
    type: 'system_status_overview',
    name: 'System Status Overview',
    description: 'Interactive status summary with drill-down and bulk reset',
    category: 'interactive',
    minWidth: 4,
    minHeight: 8,
    defaultWidth: 12,
    defaultHeight: 14,
    Renderer: SystemStatusOverviewWidget,
  },

  shield_display: {
    type: 'shield_display',
    name: 'Shield Display',
    description: 'Radial arc display showing hull/shield status per quadrant',
    category: 'display',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 8,
    defaultHeight: 12,
    Renderer: ShieldDisplayWidget,
  },

  // GM Widgets
  quick_scenarios: {
    type: 'quick_scenarios',
    name: 'Quick Scenarios',
    description: 'Execute scenarios with one click (GM only)',
    category: 'gm',
    minWidth: 4,
    minHeight: 8,
    defaultWidth: 12,
    defaultHeight: 14,
    Renderer: QuickScenariosWidget,
  },

  scene_clocks: {
    type: 'scene_clocks',
    name: 'Scene Clocks',
    description: 'Multiple progress clocks for tracking narrative elements',
    category: 'gm',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 8,
    defaultHeight: 10,
    Renderer: SceneClocksWidget,
  },

  // Display Widgets - Countdown
  countdown_timer: {
    type: 'countdown_timer',
    name: 'Countdown Timer',
    description: 'Dramatic countdown display for narrative tension',
    category: 'display',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 8,
    defaultHeight: 6,
    Renderer: CountdownTimerWidget,
  },
};

/**
 * Get a widget type definition by type ID
 */
export function getWidgetType(type: string): WidgetTypeDefinition | undefined {
  return WIDGET_TYPES[type];
}

/**
 * Get all widget types as an array
 */
export function getAllWidgetTypes(): WidgetTypeDefinition[] {
  return Object.values(WIDGET_TYPES);
}

/**
 * Get widget types by category, sorted alphabetically by name
 */
export function getWidgetTypesByCategory(category: string): WidgetTypeDefinition[] {
  return Object.values(WIDGET_TYPES)
    .filter((w) => w.category === category)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all category IDs in display order
 */
export function getWidgetCategories(): string[] {
  return WIDGET_CATEGORIES.map((c) => c.id);
}

/**
 * Get category metadata by ID
 */
export function getWidgetCategoryInfo(categoryId: string): WidgetCategory | undefined {
  return WIDGET_CATEGORIES.find((c) => c.id === categoryId);
}

/**
 * Validate widget dimensions against type constraints
 */
export function validateWidgetDimensions(
  type: string,
  width: number,
  height: number
): { valid: boolean; error?: string } {
  const widgetType = getWidgetType(type);

  if (!widgetType) {
    return { valid: false, error: `Unknown widget type: ${type}` };
  }

  if (width < widgetType.minWidth) {
    return {
      valid: false,
      error: `Width ${width} is below minimum ${widgetType.minWidth}`,
    };
  }

  if (height < widgetType.minHeight) {
    return {
      valid: false,
      error: `Height ${height} is below minimum ${widgetType.minHeight}`,
    };
  }

  return { valid: true };
}
