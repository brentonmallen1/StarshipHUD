# Widget Contract Specification (Task 0.3)

This document defines the **widget system architecture** — how widgets are registered, configured, rendered, and extended.

---

## Core Principles

1. **Registry-Based**: All widgets are registered by type; adding a new widget doesn't touch layout code
2. **Config + Bindings**: Each widget has static config and dynamic data bindings
3. **Read + Act**: Widgets render state and expose a narrow set of actions
4. **No Direct Coupling**: Widgets don't communicate directly; they coordinate through state/events

---

## Widget Type Definition

Each widget type provides:

```typescript
interface WidgetTypeDefinition {
  // Identity
  type: string;                    // Unique key (e.g., "health_bar")
  name: string;                    // Display name
  description: string;             // Brief description
  category: WidgetCategory;        // For catalog organization
  icon?: string;                   // Icon reference

  // Size constraints
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  maxWidth?: number;
  maxHeight?: number;

  // Schema
  configSchema: JSONSchema;        // Static configuration schema
  bindingsSchema: JSONSchema;      // Data binding schema

  // Components
  Renderer: React.FC<WidgetRendererProps>;    // Runtime view
  ConfigEditor: React.FC<WidgetConfigProps>;  // Config modal

  // Optional
  defaultConfig: Record<string, unknown>;
  defaultBindings: Record<string, unknown>;
  roleRestriction?: Role[];        // Restrict to specific roles
}

type WidgetCategory =
  | 'display'      // Read-only status/info
  | 'interactive'  // Has user actions
  | 'layout'       // Decorative/structural
  | 'specialized'; // System-specific widgets
```

---

## Widget Instance Runtime

### Renderer Props

```typescript
interface WidgetRendererProps {
  instance: WidgetInstance;

  // Resolved data from bindings
  data: ResolvedBindings;

  // State
  isLoading: boolean;
  error?: Error;

  // Actions (if widget supports them)
  onAction?: (action: WidgetAction) => void;

  // Edit mode
  isEditing: boolean;
  isSelected: boolean;
}

interface WidgetAction {
  type: string;
  payload: Record<string, unknown>;
}
```

### Config Editor Props

```typescript
interface WidgetConfigProps {
  config: Record<string, unknown>;
  bindings: Record<string, unknown>;
  onChange: (updates: { config?: Partial<unknown>; bindings?: Partial<unknown> }) => void;

  // Available data sources for binding
  availableSystems: SystemState[];
  availableDatasets: Dataset[];
}
```

---

## Data Bindings

Widgets can bind to various data sources:

```typescript
interface WidgetBindings {
  // Bind to a specific system state
  system_state_id?: string;

  // Bind to multiple systems
  system_state_ids?: string[];

  // Bind to a dataset
  dataset_id?: string;

  // Bind to events/feed
  event_filter?: EventFilter;

  // Custom bindings (widget-specific)
  [key: string]: unknown;
}

interface EventFilter {
  types?: string[];
  severity?: string[];
  limit?: number;
  since?: string; // ISO timestamp
}
```

---

## Widget Registry

```typescript
// Frontend registry
const widgetRegistry = new Map<string, WidgetTypeDefinition>();

// Registration
function registerWidget(definition: WidgetTypeDefinition) {
  if (widgetRegistry.has(definition.type)) {
    throw new Error(`Widget type "${definition.type}" already registered`);
  }
  widgetRegistry.set(definition.type, definition);
}

// Lookup
function getWidgetDefinition(type: string): WidgetTypeDefinition | undefined {
  return widgetRegistry.get(type);
}

// Catalog
function getWidgetCatalog(): WidgetTypeDefinition[] {
  return Array.from(widgetRegistry.values());
}
```

---

## Standard Widget Types (MVP)

| Type              | Category     | Description                        |
|-------------------|--------------|-------------------------------------|
| `title`           | layout       | Panel/section title                 |
| `divider`         | layout       | Horizontal or vertical divider      |
| `spacer`          | layout       | Empty space placeholder             |
| `section_header`  | layout       | Section header with optional status |
| `status_display`  | display      | Single system status indicator      |
| `health_bar`      | display      | Progress/health bar with thresholds |
| `data_table`      | display      | Tabular data from dataset           |
| `weapons_list`    | display      | Weapons/assets inventory            |
| `info_card`       | display      | Rich text/markdown content          |
| `alert_feed`      | display      | Live alert stream                   |

---

## Error Handling

When a widget fails to render:

```typescript
interface WidgetFallback {
  type: 'error' | 'loading' | 'not_found' | 'no_data';
  message: string;
  details?: string;
}
```

Fallback UI shows:
- Widget type and instance label (if any)
- Error type icon
- Brief message
- "Retry" action for recoverable errors

---

## Widget Actions → API

Widgets emit actions that translate to API calls:

```typescript
// Example: Status widget action
{
  type: 'update_status',
  payload: {
    system_state_id: 'abc123',
    status: 'degraded'
  }
}

// Mapped to:
// PATCH /api/system-states/abc123
// { status: 'degraded' }
```

Action permissions are validated server-side based on role.

---

## Acceptance Checks

- [ ] New widgets can be added via registry without changing core code
- [ ] Widget config is validated against schema
- [ ] Bindings resolve to live data
- [ ] Actions are dispatched and handled
- [ ] Fallback UI renders on error
- [ ] Widget catalog is browsable in admin
