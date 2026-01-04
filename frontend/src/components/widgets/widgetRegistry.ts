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
import { HolomapWidget } from './HolomapWidget';
import { ShipLogWidget } from './ShipLogWidget';
import { ContactTrackerWidget } from './ContactTrackerWidget';
import { SystemDependenciesWidget } from './SystemDependenciesWidget';
import { FallbackWidget } from './FallbackWidget';

/**
 * Widget Registry
 *
 * Central registry of all available widget types with their metadata.
 * Used for widget creation, validation, and rendering.
 */

export const WIDGET_TYPES: Record<string, WidgetTypeDefinition> = {
  // Layout Widgets (scaled for 24-col grid, 20px rowHeight)
  title: {
    type: 'title',
    name: 'Title',
    description: 'Panel title with optional subtitle',
    category: 'layout',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 3,
    Renderer: TitleWidget,
  },

  divider: {
    type: 'divider',
    name: 'Divider',
    description: 'Horizontal or vertical separator line',
    category: 'layout',
    minWidth: 1,
    minHeight: 1,
    defaultWidth: 24,
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
    defaultWidth: 4,
    defaultHeight: 3,
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
    defaultWidth: 6,
    defaultHeight: 3,
    Renderer: StatusDisplayWidget,
  },

  health_bar: {
    type: 'health_bar',
    name: 'Health Bar',
    description: 'Visual health/capacity bar for a system',
    category: 'display',
    minWidth: 3,
    minHeight: 1,
    defaultWidth: 8,
    defaultHeight: 3,
    Renderer: HealthBarWidget,
  },

  posture_display: {
    type: 'posture_display',
    name: 'Posture & ROE',
    description: 'Shows ship threat posture and rules of engagement',
    category: 'display',
    minWidth: 3,
    minHeight: 2,
    defaultWidth: 8,
    defaultHeight: 9,
    Renderer: PostureDisplayWidget,
  },

  asset_display: {
    type: 'asset_display',
    name: 'Asset Display',
    description: 'Individual weapon, drone, or probe with ammo and stats',
    category: 'display',
    minWidth: 3,
    minHeight: 2,
    defaultWidth: 6,
    defaultHeight: 6,
    Renderer: AssetDisplayWidget,
  },

  system_dependencies: {
    type: 'system_dependencies',
    name: 'System Dependencies',
    description: 'Graph showing system dependency relationships with status cascade',
    category: 'display',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 12,
    Renderer: SystemDependenciesWidget,
  },

  data_table: {
    type: 'data_table',
    name: 'Data Table',
    description: 'Tabular data display from a dataset',
    category: 'display',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 12,
    Renderer: DataTableWidget,
  },

  // Interactive Widgets
  alert_feed: {
    type: 'alert_feed',
    name: 'Alert Feed',
    description: 'Scrolling list of recent alerts and events',
    category: 'interactive',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 15,
    Renderer: AlertFeedWidget,
  },

  task_queue: {
    type: 'task_queue',
    name: 'Task Queue',
    description: 'List of active tasks with claim/complete actions',
    category: 'interactive',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 15,
    Renderer: TaskQueueWidget,
  },

  contact_tracker: {
    type: 'contact_tracker',
    name: 'Contact Tracker',
    description: 'Contact list with threat indicators, pinning, and expandable dossiers',
    category: 'interactive',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 10,
    defaultHeight: 12,
    Renderer: ContactTrackerWidget,
  },

  transmission_console: {
    type: 'transmission_console',
    name: 'Transmission Console',
    description: 'Incoming transmissions and messages',
    category: 'interactive',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 12,
    Renderer: TransmissionConsoleWidget,
  },

  // Specialized Widgets
  holomap: {
    type: 'holomap',
    name: 'Holomap',
    description: 'Ship deck plan with real-time markers',
    category: 'specialized',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 12,
    Renderer: HolomapWidget,
  },

  ship_log: {
    type: 'ship_log',
    name: 'Ship Log',
    description: 'Timeline of events with filtering and search',
    category: 'specialized',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 12,
    defaultHeight: 15,
    Renderer: ShipLogWidget,
  },

  environment_summary: {
    type: 'environment_summary',
    name: 'Environment Summary',
    description: 'Atmospheric, gravity, and habitat conditions',
    category: 'specialized',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 8,
    defaultHeight: 9,
    Renderer: EnvironmentSummaryWidget,
  },

  mini_game: {
    type: 'mini_game',
    name: 'Mini-Game',
    description: 'Interactive mini-game launcher',
    category: 'specialized',
    minWidth: 2,
    minHeight: 1,
    defaultWidth: 10,
    defaultHeight: 12,
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
