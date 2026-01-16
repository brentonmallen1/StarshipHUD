# Widgets

Widgets are the building blocks of panels. Each widget type displays specific information or provides specific interactions.

## Widget Categories

Widgets are organized into four categories:

| Category | Purpose |
|----------|---------|
| **Layout** | Structure and spacing |
| **Display** | Show system status and data |
| **Interactive** | Player actions and live feeds |
| **Specialized** | Complex visualizations |

---

## Layout Widgets

Layout widgets help structure panels visually. They don't display ship data.

### Title

Panel title with optional subtitle. Use at the top of panels to identify the station or view.

- **Use for:** Panel headers, section labels
- **Config:** Title text, subtitle text

### Divider

Horizontal or vertical separator line. Creates visual breaks between widget groups.

- **Use for:** Separating panel sections
- **Config:** Orientation (horizontal/vertical)

### Spacer

Visible spacer with a subtle border. Reserves space and shows panel structure.

- **Use for:** Creating gaps, placeholder areas
- **Config:** None (size controlled by dimensions)

### Invisible Spacer

Completely invisible spacer. Creates gaps without any visual indication.

- **Use for:** Fine-tuning layout, padding edges
- **Config:** None

---

## Display Widgets

Display widgets show system status and ship data.

### Status Display

Shows a single system's current status with color-coded indicator and label.

- **Use for:** Quick status checks, dashboard overviews
- **Bindings:** `system_state_id` - the system to display
- **Config:** Orientation (horizontal/vertical), custom label

**Status indicators use both color and shape:**

- Operational → green circle
- Degraded → amber triangle
- Compromised/Critical → orange/red diamond
- Destroyed → deep red X
- Offline → gray hollow circle

### Health Bar

Visual bar showing a system's current value as a percentage of capacity.

- **Use for:** Reactor output, shield strength, fuel levels
- **Bindings:** `system_state_id` - system with numeric value
- **Config:** Custom label, show percentage

The bar color changes based on the value:

- High values → green
- Medium values → amber
- Low values → red

### Asset Display

Individual weapon, drone, or probe with ammunition count and status.

- **Use for:** Weapon loadouts, deployable assets
- **Bindings:** `system_state_id` - the asset system
- **Config:** Asset type, show ammo count

### System Dependencies

Graph visualization showing how systems depend on each other. When a parent system degrades, children are affected.

- **Use for:** Engineering diagnostics, understanding cascade failures
- **Bindings:** `system_state_ids` - systems to include in graph
- **Config:** Layout direction, show status colors

### Data Table

Tabular display of structured data from a dataset.

- **Use for:** Cargo manifests, crew rosters, mission logs
- **Bindings:** `dataset_id` - the data source
- **Config:** Columns to display, sorting

### Environment Summary

Atmospheric conditions, gravity, and habitat status at a glance.

- **Use for:** Life support monitoring, EVA readiness
- **Bindings:** `system_state_ids` - atmosphere, gravity, habitat systems
- **Config:** Display format

---

## Interactive Widgets

Interactive widgets allow player actions or show live updating feeds.

### Posture Display

Ship threat posture indicator with click-to-change controls (if permitted).

- **Use for:** Bridge command decisions, Rules of Engagement
- **Bindings:** Reads ship posture state
- **Config:** Allow player changes, posture options

**Posture levels typically include:**

- Condition Green - Peacetime
- Condition Yellow - Elevated alert
- Condition Red - Combat ready
- Condition Black - Under attack

### Alert Feed

Scrolling list of recent alerts and ship events.

- **Use for:** Situational awareness, event history
- **Bindings:** None (reads ship events automatically)
- **Config:** Max items, filter by severity

Alerts are color-coded by severity and show timestamps.

### Task Queue

List of active tasks assigned to the current station. Players can claim and complete tasks.

- **Use for:** Crew coordination, responding to incidents
- **Bindings:** None (filters by current station)
- **Config:** Show completed tasks, task limit

**Task workflow:**

1. Task appears in queue (pending)
2. Player claims task (active)
3. Player completes task (succeeded/failed)
4. Timed tasks may expire

### Contact Tracker

Contact list with threat indicators. Players can pin contacts and expand dossiers.

- **Use for:** Tactical awareness, identifying threats
- **Bindings:** None (reads contacts automatically)
- **Config:** Default sort, show dossiers

**Contact information includes:**

- Designation and class
- Threat level (friendly/neutral/hostile)
- Distance and bearing
- Dossier notes (expandable)

### Transmission Console

Incoming transmissions and messages displayed as they arrive.

- **Use for:** Communications, narrative delivery
- **Bindings:** None (reads transmissions automatically)
- **Config:** Max messages, auto-scroll

Transmissions include sender, timestamp, and message content.

---

## Specialized Widgets

Specialized widgets provide complex visualizations.

### Holomap

Interactive ship deck plan with real-time markers showing crew, damage, and points of interest.

- **Use for:** Internal ship awareness, damage control coordination
- **Bindings:** Configured per holomap
- **Config:** Deck image, marker types, zoom level

### Ship Log

Timeline of all ship events with filtering and search capabilities.

- **Use for:** Mission recap, investigating past events
- **Bindings:** None (reads full event history)
- **Config:** Default filters, time range

### Radar

Polar radar display showing sensor contacts with range rings and bearing indicators.

- **Use for:** Tactical overview, spatial awareness
- **Bindings:** None (reads contacts automatically)
- **Config:** Range scale, contact icons, sweep animation

**Radar features:**

- Contacts positioned by bearing and distance
- Range rings for distance reference
- Contact icons indicate type/threat
- Optional sweep animation

### Mini-Game

Launcher for interactive mini-games tied to task completion.

- **Use for:** Skill-based task resolution
- **Bindings:** Task-specific
- **Config:** Game type, difficulty

!!! note "Mini-Games"
    Mini-game support is still being developed. Currently shows a placeholder.

---

## Widget Configuration

### Common Options

Most widgets share these configuration options:

| Option | Description |
|--------|-------------|
| **Custom Label** | Override the default widget title |
| **Position** | Grid X/Y coordinates |
| **Size** | Width/height in grid units |

### Bindings

Bindings connect widgets to data:

```
system_state_id: "reactor-main"     // Single system
system_state_ids: ["power", "life"] // Multiple systems
dataset_id: "cargo-manifest"        // Tabular data
```

### Minimum Sizes

Each widget type has minimum dimensions to ensure readability:

| Widget | Min Width | Min Height |
|--------|-----------|------------|
| Status Display | 1 | 1 |
| Health Bar | 1 | 1 |
| Task Queue | 2 | 1 |
| Radar | 4 | 4 |
| Holomap | 2 | 1 |

The panel editor enforces these minimums automatically.
