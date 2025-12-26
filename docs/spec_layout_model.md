# Layout Model Specification (Task 0.2)

This document defines how **panels** and **widget instances** are positioned and sized.

---

## Core Concepts

### Panel

A **Panel** is a canvas that holds widget instances. Each ship has multiple panels representing different stations or views.

```typescript
interface Panel {
  id: string;           // UUID
  ship_id: string;      // FK to ship
  name: string;         // Display name (e.g., "Engineering Main")
  station_group: StationGroup;
  role_visibility: Role[];  // ['player', 'gm'] or ['gm']
  sort_order: number;   // Within station group
  icon_id?: string;     // Optional icon reference
  grid_columns: number; // Layout grid width (default: 12)
  grid_rows: number;    // Layout grid height (default: 8)
  created_at: string;
  updated_at: string;
}

type StationGroup =
  | 'command'
  | 'engineering'
  | 'sensors'
  | 'tactical'
  | 'life_support'
  | 'communications'
  | 'admin';

type Role = 'player' | 'gm';
```

### Widget Instance

A **Widget Instance** is a placed widget on a panel with position and configuration.

```typescript
interface WidgetInstance {
  id: string;           // UUID
  panel_id: string;     // FK to panel
  widget_type: string;  // Registry key (e.g., "health_bar", "status_display")

  // Position (grid units)
  x: number;            // 0-based column
  y: number;            // 0-based row
  width: number;        // Columns spanned
  height: number;       // Rows spanned

  // Configuration
  config: WidgetConfig; // Type-specific configuration
  bindings: WidgetBindings; // Data bindings

  // Metadata
  label?: string;       // Optional instance label
  created_at: string;
  updated_at: string;
}
```

---

## Grid System

### Coordinate Space

- Origin: Top-left corner (0, 0)
- X-axis: Columns (left to right)
- Y-axis: Rows (top to bottom)
- Units: Grid cells (not pixels)

### Default Grid

- Columns: 12 (responsive breakpoints can adjust)
- Rows: 8 (expandable for scrolling panels)
- Cell aspect ratio: ~16:9 equivalent at default viewport

### Widget Sizing Constraints

| Constraint    | Min | Max | Default |
|---------------|-----|-----|---------|
| Width         | 1   | 12  | 2       |
| Height        | 1   | 8   | 1       |

---

## Layout Rules

### Collision Policy (v1)

1. **No Overlap**: Widget instances cannot overlap on the same panel
2. **Push Behavior**: When dragging, overlapped widgets push away (down, then right)
3. **Bounds Check**: Widgets cannot extend beyond panel grid bounds
4. **Snap-to-Grid**: All positions snap to integer grid coordinates

### Edit Mode Affordances

When in edit mode:
- Grid lines visible (subtle overlay)
- Widget borders show resize handles (corners + edges)
- Drag handle visible (top center or full header)
- Selection state highlighted

---

## Database Schema

```sql
CREATE TABLE panels (
  id TEXT PRIMARY KEY,
  ship_id TEXT NOT NULL REFERENCES ships(id),
  name TEXT NOT NULL,
  station_group TEXT NOT NULL CHECK(station_group IN ('command', 'engineering', 'sensors', 'tactical', 'life_support', 'communications', 'admin')),
  role_visibility TEXT NOT NULL DEFAULT '["player", "gm"]', -- JSON array
  sort_order INTEGER NOT NULL DEFAULT 0,
  icon_id TEXT,
  grid_columns INTEGER NOT NULL DEFAULT 12,
  grid_rows INTEGER NOT NULL DEFAULT 8,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE widget_instances (
  id TEXT PRIMARY KEY,
  panel_id TEXT NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 2,
  height INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}', -- JSON
  bindings TEXT NOT NULL DEFAULT '{}', -- JSON
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_widget_instances_panel ON widget_instances(panel_id);
```

---

## API Endpoints

```
GET    /api/panels                    # List all panels for current ship
GET    /api/panels/:id                # Get panel with widget instances
POST   /api/panels                    # Create panel
PATCH  /api/panels/:id                # Update panel metadata
DELETE /api/panels/:id                # Delete panel

GET    /api/panels/:id/widgets        # List widget instances
POST   /api/panels/:id/widgets        # Add widget instance
PATCH  /api/widgets/:id               # Update widget (position, config)
DELETE /api/widgets/:id               # Remove widget instance

POST   /api/panels/:id/layout         # Batch update widget positions
```

---

## Acceptance Checks

- [ ] Panels can be created and assigned to station groups
- [ ] Widget instances can be positioned on the grid
- [ ] Collisions are prevented or handled gracefully
- [ ] Layout changes persist to backend
- [ ] Edit mode shows grid overlay and handles
