import type { WidgetTypeDefinition } from '../../types';
import { TitleWidget } from './TitleWidget';
import { HealthBarWidget } from './HealthBarWidget';
import { StatusDisplayWidget } from './StatusDisplayWidget';
import { TaskQueueWidget } from './TaskQueueWidget';
import { PostureDisplayWidget } from './PostureDisplayWidget';
import { AlertFeedWidget } from './AlertFeedWidget';
import { SpacerWidget } from './SpacerWidget';
import { DividerWidget } from './DividerWidget';
import { EnvironmentSummaryWidget } from './EnvironmentSummaryWidget';
import { TransmissionConsoleWidget } from './TransmissionConsoleWidget';
import { AssetDisplayWidget } from './AssetDisplayWidget';
import { DataTableWidget } from './DataTableWidget';
import { ContactDisplayWidget } from './ContactDisplayWidget';
import { HolomapWidget } from './HolomapWidget';
import { FallbackWidget } from './FallbackWidget';

/**
 * Widget Registry
 *
 * Central registry of all available widget types with their metadata.
 * Used for widget creation, validation, and rendering.
 */

export const WIDGET_TYPES: Record<string, WidgetTypeDefinition> = {
  // Layout Widgets
  title: {
    type: 'title',
    name: 'Title',
    description: 'Panel title with optional subtitle',
    category: 'layout',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 6,
    defaultHeight: 2,
    Renderer: TitleWidget,
  },

  divider: {
    type: 'divider',
    name: 'Divider',
    description: 'Horizontal or vertical separator line',
    category: 'layout',
    minWidth: 1,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 2,
    Renderer: DividerWidget,
  },

  spacer: {
    type: 'spacer',
    name: 'Spacer',
    description: 'Empty space for layout control',
    category: 'layout',
    minWidth: 1,
    minHeight: 1,
    defaultWidth: 2,
    defaultHeight: 2,
    Renderer: SpacerWidget,
  },

  // Display Widgets
  status_display: {
    type: 'status_display',
    name: 'Status Display',
    description: 'Shows single system status value',
    category: 'display',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 3,
    defaultHeight: 2,
    Renderer: StatusDisplayWidget,
  },

  health_bar: {
    type: 'health_bar',
    name: 'Health Bar',
    description: 'Visual health/capacity bar for a system',
    category: 'display',
    minWidth: 3,
    minHeight: 1,
    defaultWidth: 4,
    defaultHeight: 2,
    Renderer: HealthBarWidget,
  },

  posture_display: {
    type: 'posture_display',
    name: 'Posture & ROE',
    description: 'Shows ship threat posture and rules of engagement',
    category: 'display',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 4,
    defaultHeight: 6,
    Renderer: PostureDisplayWidget,
  },

  asset_display: {
    type: 'asset_display',
    name: 'Asset Display',
    description: 'Individual weapon, drone, or probe with ammo and stats',
    category: 'display',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 3,
    defaultHeight: 4,
    Renderer: AssetDisplayWidget,
  },

  contact_display: {
    type: 'contact_display',
    name: 'Contact Display',
    description: 'Individual contact dossier with selectable contact',
    category: 'display',
    minWidth: 3,
    minHeight: 5,
    defaultWidth: 4,
    defaultHeight: 6,
    Renderer: ContactDisplayWidget,
  },

  system_dependencies: {
    type: 'system_dependencies',
    name: 'System Dependencies',
    description: 'Graph showing system dependency relationships',
    category: 'display',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 6,
    defaultHeight: 8,
    Renderer: FallbackWidget, // TODO: implement
  },

  data_table: {
    type: 'data_table',
    name: 'Data Table',
    description: 'Tabular data display from a dataset',
    category: 'display',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 6,
    defaultHeight: 8,
    Renderer: DataTableWidget,
  },

  // Interactive Widgets
  alert_feed: {
    type: 'alert_feed',
    name: 'Alert Feed',
    description: 'Scrolling list of recent alerts and events',
    category: 'interactive',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 6,
    defaultHeight: 10,
    Renderer: AlertFeedWidget,
  },

  task_queue: {
    type: 'task_queue',
    name: 'Task Queue',
    description: 'List of active tasks with claim/complete actions',
    category: 'interactive',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 6,
    defaultHeight: 10,
    Renderer: TaskQueueWidget,
  },

  contact_tracker: {
    type: 'contact_tracker',
    name: 'Contact Tracker',
    description: 'List of known contacts and sensor readings',
    category: 'interactive',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 5,
    defaultHeight: 8,
    Renderer: FallbackWidget, // TODO: implement
  },

  transmission_console: {
    type: 'transmission_console',
    name: 'Transmission Console',
    description: 'Incoming transmissions and messages',
    category: 'interactive',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 6,
    defaultHeight: 8,
    Renderer: TransmissionConsoleWidget,
  },

  // Specialized Widgets
  holomap: {
    type: 'holomap',
    name: 'Holomap',
    description: 'Ship deck plan with real-time markers',
    category: 'specialized',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 6,
    defaultHeight: 8,
    Renderer: HolomapWidget,
  },

  ship_log: {
    type: 'ship_log',
    name: 'Ship Log',
    description: 'Timeline of events with bookmarks',
    category: 'specialized',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 6,
    defaultHeight: 10,
    Renderer: FallbackWidget, // TODO: implement
  },

  environment_summary: {
    type: 'environment_summary',
    name: 'Environment Summary',
    description: 'Atmospheric, gravity, and habitat conditions',
    category: 'specialized',
    minWidth: 3,
    minHeight: 4,
    defaultWidth: 4,
    defaultHeight: 6,
    Renderer: EnvironmentSummaryWidget,
  },

  mini_game: {
    type: 'mini_game',
    name: 'Mini-Game',
    description: 'Interactive mini-game launcher',
    category: 'specialized',
    minWidth: 3,
    minHeight: 6,
    defaultWidth: 5,
    defaultHeight: 8,
    Renderer: FallbackWidget, // TODO: implement
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
 * Get widget types by category
 */
export function getWidgetTypesByCategory(category: string): WidgetTypeDefinition[] {
  return Object.values(WIDGET_TYPES).filter((w) => w.category === category);
}

/**
 * Get all unique categories
 */
export function getWidgetCategories(): string[] {
  const categories = new Set(Object.values(WIDGET_TYPES).map((w) => w.category));
  return Array.from(categories).sort();
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
