# Panel Navigation & Cross-Panel Linking Specification (Task 0.11)

This document defines how **players navigate between panels** and how **deep-links** work across the application.

---

## Core Concepts

### Multiple Panels Per Ship

- GM creates any number of panels (stations, sub-panels, special scenes)
- Players navigate between panels via a **diegetic navigator**
- Alerts/events/markers can **deep-link** to relevant panels and widgets

---

## Panel Identity and Organization

### Panel Fields

```typescript
interface Panel {
  id: string;
  ship_id: string;
  name: string;                    // Display name
  station_group: StationGroup;     // Grouping for navigation
  role_visibility: Role[];         // Who can see this panel
  sort_order: number;              // Order within station group
  icon_id?: string;                // Optional icon for navigator
  description?: string;            // Brief description
  // ... layout fields from spec_layout_model
}

type StationGroup =
  | 'command'
  | 'engineering'
  | 'sensors'
  | 'tactical'
  | 'life_support'
  | 'communications'
  | 'admin';
```

### Station Group Display

| Group          | Icon  | Display Name      | Color Accent |
|----------------|-------|-------------------|--------------|
| command        | ⬡     | Command           | Gold         |
| engineering    | ⚙     | Engineering       | Orange       |
| sensors        | ◎     | Sensors           | Cyan         |
| tactical       | ⚔     | Tactical          | Red          |
| life_support   | ♡     | Life Support      | Green        |
| communications | ⌘     | Communications    | Blue         |
| admin          | ⚡     | Admin/GM          | Purple       |

---

## Navigation UX Model

### Station Dial (MVP Choice)

The navigator is a **Station Dial** — a rotary-style selector in the corner.

**Interaction Flow**:
1. Player clicks station dial icon (persistent in corner)
2. Dial expands showing station groups
3. Selecting a group shows panels in that group
4. Selecting a panel navigates to it
5. Dial collapses after selection

**Visual Design**:
```
Collapsed:                 Expanded:
┌───┐                     ┌─────────────────────┐
│ ⬡ │                     │  ⬡ Command          │
└───┘                     │    • Bridge Main    │
                          │    • Deck Plan      │
                          │  ⚙ Engineering      │
                          │  ◎ Sensors          │
                          │  ⚔ Tactical         │
                          │  ♡ Life Support     │
                          │  ⌘ Communications   │
                          └─────────────────────┘
```

### Navigator Placement

- **Location**: Bottom-left corner (or bottom-right, configurable)
- **Always Visible**: Small icon always present
- **On Hover/Click**: Expands to full navigator
- **Auto-Hide**: Collapses 2 seconds after selection or mouse-out

### Current Station Indicator

- Navigator icon reflects current station group's icon
- Current panel highlighted in expanded view
- Subtle glow/pulse on current selection

---

## Panel Availability Rules

### Role Filtering

```typescript
function getVisiblePanels(panels: Panel[], role: Role): Panel[] {
  return panels.filter(p => p.role_visibility.includes(role));
}

// Players only see panels with 'player' in role_visibility
// GM sees all panels
```

### Station Lock (Optional)

A device can be "assigned" to a station group:

```typescript
interface DeviceAssignment {
  device_id: string;
  station_group?: StationGroup;
  locked: boolean;
}
```

When locked:
- Navigator defaults to assigned station
- Other stations still accessible (with visual distinction)
- GM can change assignment from admin

---

## Deep-Linking Contract

### Link Payload

```typescript
interface DeepLinkPayload {
  // Target location
  target: {
    panel_id: string;
    widget_instance_id?: string;
  };

  // Why we're linking
  reason: DeepLinkReason;

  // What to focus on arrival
  focus?: FocusHint;
}

type DeepLinkReason =
  | 'alert'
  | 'event'
  | 'marker'
  | 'system_state'
  | 'task'
  | 'contact'
  | 'transmission';

interface FocusHint {
  system_state_id?: string;
  incident_id?: string;
  task_id?: string;
  contact_id?: string;
  holomap_marker_id?: string;
}
```

### Link Origins

Deep-links originate from:

| Origin                | Example Use Case                           |
|-----------------------|--------------------------------------------|
| Alert Bar             | Click critical alert → Engineering panel   |
| Timeline Events       | Click incident → related panel             |
| Holomap Markers       | Click breach marker → Life Support         |
| Sensor Contacts       | Click contact → Sensors panel              |
| Transmission Console  | "View sender dossier" → panel with dossier |
| Task Queue            | "Open related panel" → target panel        |
| System Overview Cards | "View details" → station panel             |

### Creating Links

```typescript
// From an alert
createDeepLink({
  target: { panel_id: 'engineering-main' },
  reason: 'alert',
  focus: { system_state_id: 'reactor' }
});

// From a holomap marker
createDeepLink({
  target: { panel_id: 'life-support-main' },
  reason: 'marker',
  focus: { holomap_marker_id: 'breach-cargo-2' }
});

// From a task
createDeepLink({
  target: { panel_id: 'engineering-main', widget_instance_id: 'tasks-queue-1' },
  reason: 'task',
  focus: { task_id: 'seal-breach-123' }
});
```

---

## Focus Behavior

### On Navigation

When navigating via deep-link:

1. **Navigate to Panel**: Route to `/panel/:panel_id`
2. **Find Target Widget**:
   - If `widget_instance_id` specified, find that widget
   - Else, find first widget bound to `focus` hint
3. **Scroll/Pan**: Bring widget into view
4. **Highlight**: Flash border for 2-3 seconds

### Highlight Animation

```css
@keyframes focus-highlight {
  0% { box-shadow: 0 0 0 0 var(--focus-color); }
  50% { box-shadow: 0 0 20px 4px var(--focus-color); }
  100% { box-shadow: 0 0 0 0 var(--focus-color); }
}

.widget--focused {
  animation: focus-highlight 0.5s ease-in-out 3;
}
```

### Fallback Behavior

| Scenario                    | Fallback                                    |
|-----------------------------|---------------------------------------------|
| Widget not found            | Navigate to panel, show toast (GM only)     |
| Panel not found             | Navigate to panel index, show error         |
| Focus hint has no matches   | Navigate to panel, no highlight             |
| User lacks access           | Show "access denied" message                |

---

## Navigation Utility

```typescript
interface NavigationService {
  // Navigate to panel
  navigateToPanel(panelId: string): void;

  // Navigate with deep-link
  navigateToTarget(payload: DeepLinkPayload): void;

  // Get current location
  getCurrentPanel(): Panel | null;

  // Get last visited panel
  getLastVisitedPanel(): string | null;

  // Set last visited
  setLastVisitedPanel(panelId: string): void;
}

// Implementation
function navigateToTarget(payload: DeepLinkPayload): void {
  const { target, focus } = payload;

  // Navigate to panel
  router.push(`/panel/${target.panel_id}`);

  // After navigation, apply focus
  nextTick(() => {
    let widgetId = target.widget_instance_id;

    // If no widget specified, find by focus hint
    if (!widgetId && focus) {
      widgetId = findWidgetByFocus(target.panel_id, focus);
    }

    if (widgetId) {
      scrollToWidget(widgetId);
      highlightWidget(widgetId);
    }
  });
}
```

---

## Panel Load Behavior

### Root Route (`/`)

When user hits the root:

1. Check for `lastVisitedPanel` in local storage
2. If exists and accessible → redirect to that panel
3. Else → redirect to first visible panel (by sort order)
4. If no panels → show "No panels available" message

### Panel Route (`/panel/:id`)

1. Verify panel exists
2. Verify user has access
3. If accessible → render panel
4. If not found → redirect to index with error
5. If no access → show access denied

---

## Command Panel Philosophy

The Command panel uses "overview → detail" navigation:

- Overview cards show system summaries
- Each card links to the detailed station panel
- Captain gets bird's-eye view, can drill down as needed

```typescript
interface OverviewCard {
  system_ids: string[];        // Systems summarized
  target_panel_id: string;     // Link destination
  label: string;               // Card title
}
```

---

## Edge Cases

### Panel Deleted While Viewing

1. Detect panel deletion (via polling or event)
2. Show "Panel no longer exists" toast
3. Navigate to panel index

### Role Change Mid-Session

1. Detect role change
2. Re-evaluate panel visibility
3. If current panel now hidden → navigate to first visible
4. Update navigator to reflect new access

### Multiple Panels Per Station Group

- Navigator shows all panels in group as list
- Sort by `sort_order`
- Primary panel (sort_order = 0) shown first

### Scene Panel (Temporary)

GM can create temporary panels for special scenes:
- Mark with tag: `temporary` or `scene`
- Auto-hide after scene ends (GM action)
- Deep-links still work while active

---

## Database Additions

```sql
-- Add to panels table
ALTER TABLE panels ADD COLUMN description TEXT;
ALTER TABLE panels ADD COLUMN tags TEXT DEFAULT '[]';  -- JSON array

-- Device assignments (optional feature)
CREATE TABLE device_assignments (
  device_id TEXT PRIMARY KEY,
  ship_id TEXT NOT NULL REFERENCES ships(id),
  station_group TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## API Endpoints

```
# Panel navigation
GET    /api/panels                    # List panels (filtered by role)
GET    /api/panels/by-station         # Grouped by station

# Device assignment
GET    /api/devices/me/assignment     # Get current device assignment
PATCH  /api/devices/me/assignment     # Update assignment
```

---

## Examples

### Example 1: Red Alert → Engineering

1. Red alert triggered (reactor critical)
2. Alert bar shows: "⚠ Reactor critical - Engineering"
3. Player clicks alert
4. Deep-link: `{ target: { panel_id: 'engineering' }, reason: 'alert', focus: { system_state_id: 'reactor' } }`
5. Navigation to Engineering panel
6. Reactor widget highlighted for 2 seconds

### Example 2: Holomap Breach → Life Support

1. Breach marker added to holomap in Cargo Bay 2
2. GM clicks marker, selects "View in Life Support"
3. Deep-link: `{ target: { panel_id: 'life-support' }, reason: 'marker', focus: { holomap_marker_id: 'breach-cargo-2' } }`
4. Navigation to Life Support panel
5. Zone Details widget (if bound to that zone) highlighted

---

## Acceptance Checks

- [ ] Navigator shows panels grouped by station
- [ ] Role filtering works correctly
- [ ] Deep-links navigate to correct panel
- [ ] Widget focus/highlight works on arrival
- [ ] Fallbacks handle missing targets gracefully
- [ ] Last visited panel persists across refreshes
- [ ] Navigator looks diegetic, not like a navbar
