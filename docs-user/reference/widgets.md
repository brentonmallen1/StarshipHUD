# Widget Reference

Widgets are the building blocks of panels. Each widget type displays specific information or provides specific interactions. This reference covers all 22 available widgets.

## Widget Categories

Widgets are organized into five categories:

| Category | Count | Purpose |
|----------|-------|---------|
| **Layout** | 3 | Structure and spacing |
| **Display** | 7 | Show system status and data (read-only) |
| **Interactive** | 7 | Player actions and live feeds |
| **Specialized** | 4 | Complex visualizations |
| **GM** | 1 | Game master tools |

---

## Layout Widgets

Layout widgets help structure panels visually. They don't display ship data.

### Title

Panel title with optional subtitle. Use at the top of panels to identify the station or view.

| Property | Value |
|----------|-------|
| Type | `title` |
| Min Size | 2 x 2 |
| Default Size | 12 x 6 |

**Configuration:**
- Title text
- Subtitle text (optional)

---

### Spacer

Invisible spacer for layout gaps. Reserves space without any visual indication.

| Property | Value |
|----------|-------|
| Type | `spacer` |
| Min Size | 1 x 2 |
| Default Size | 4 x 6 |

**Configuration:** None (size controlled by dimensions)

---

### Divider

Visible horizontal separator line. Creates visual breaks between widget groups.

| Property | Value |
|----------|-------|
| Type | `divider` |
| Min Size | 1 x 2 |
| Default Size | 24 x 4 |

**Configuration:** None

---

## Display Widgets

Display widgets show system status and ship data. They are read-only for players.

### Status Display

Shows a single system's current status with color-coded indicator and label.

| Property | Value |
|----------|-------|
| Type | `status_display` |
| Min Size | 1 x 2 |
| Default Size | 6 x 6 |

**Bindings:**
- `system_id` - The system to display

**Status indicators use color + shape:**
- Operational: green circle
- Degraded: amber triangle
- Compromised: orange diamond
- Critical: red diamond (pulsing)
- Destroyed: deep red X
- Offline: gray hollow circle

---

### Health Bar

Visual bar showing a system's current value as a percentage of capacity. Shows limiting parent if status is capped.

| Property | Value |
|----------|-------|
| Type | `health_bar` |
| Min Size | 1 x 2 |
| Default Size | 8 x 6 |

**Bindings:**
- `system_id` - System with numeric value

**Bar colors by value:**
- 70-100%: Green
- 40-69%: Amber
- 0-39%: Red

---

### Asset Display

Individual weapon, drone, or probe with ammunition count and status.

| Property | Value |
|----------|-------|
| Type | `asset_display` |
| Min Size | 3 x 4 |
| Default Size | 6 x 12 |

**Bindings:**
- `asset_id` - The asset to display

**Shows:**
- Asset name and type
- Current/max ammunition
- Readiness status (armed, ready, offline)
- Operational status

---

### System Dependencies

Graph visualization showing how systems depend on each other. When a parent system degrades, children are affected.

| Property | Value |
|----------|-------|
| Type | `system_dependencies` |
| Min Size | 2 x 2 |
| Default Size | 12 x 24 |

**Bindings:**
- `system_ids` - Systems to include in graph (optional, shows all if not specified)

**Use for:**
- Engineering diagnostics
- Understanding cascade failures
- Visualizing system relationships

---

### Data Table

Tabular display of structured data from a dataset.

| Property | Value |
|----------|-------|
| Type | `data_table` |
| Min Size | 2 x 2 |
| Default Size | 12 x 24 |

**Bindings:**
- `data_source` - The data source to display

**Configuration:**
- Columns to display
- Sorting options

---

### Ship Overview

Ship information display showing name, class, and basic stats. Optionally editable.

| Property | Value |
|----------|-------|
| Type | `ship_overview` |
| Min Size | 4 x 8 |
| Default Size | 12 x 14 |

**Bindings:** None (reads current ship automatically)

**Shows:**
- Ship name and class
- Basic statistics
- Optional edit capability (GM only)

---

### Environment Summary

Atmospheric conditions, gravity, and habitat status at a glance.

| Property | Value |
|----------|-------|
| Type | `environment_summary` |
| Min Size | 2 x 2 |
| Default Size | 8 x 18 |

**Bindings:**
- `system_ids` - Atmosphere, gravity, habitat systems (optional)

**Shows:**
- Atmosphere quality/composition
- Gravity level
- Habitat conditions

---

## Interactive Widgets

Interactive widgets allow player actions or show live updating feeds.

### Posture Display

Ship threat posture indicator with click-to-change controls.

| Property | Value |
|----------|-------|
| Type | `posture_display` |
| Min Size | 3 x 4 |
| Default Size | 8 x 18 |

**Bindings:** None (reads ship posture automatically)

**Posture levels:**
- **Green** - Peacetime operations
- **Yellow** - Elevated alert
- **Red** - Combat ready
- **General Quarters** - Battle stations
- **Silent Running** - Minimal emissions

Players with appropriate permissions can change posture.

---

### Alert Feed

Scrolling list of recent alerts and ship events.

| Property | Value |
|----------|-------|
| Type | `alert_feed` |
| Min Size | 2 x 2 |
| Default Size | 12 x 30 |

**Bindings:** None (reads events automatically)

**Configuration:**
- Max items to display
- Filter by severity

Alerts are color-coded by severity (info, warning, critical) and show timestamps.

---

### Task Queue

List of active tasks assigned to the current station. Players can claim and complete tasks.

| Property | Value |
|----------|-------|
| Type | `task_queue` |
| Min Size | 2 x 2 |
| Default Size | 12 x 30 |

**Bindings:**
- `station_group` - Filter to specific station (optional)

**Task workflow:**
1. Task appears (pending)
2. Player claims task (active)
3. Player completes task (succeeded/failed)
4. Timed tasks may expire

---

### Contact Tracker

Contact list with threat indicators. Players can pin contacts and expand dossiers.

| Property | Value |
|----------|-------|
| Type | `contact_tracker` |
| Min Size | 2 x 2 |
| Default Size | 10 x 24 |

**Bindings:** None (reads contacts automatically)

**Shows:**
- Designation and class
- Threat level (friendly/neutral/hostile)
- Distance and bearing
- Expandable dossiers

---

### Crew Status

Crew health and status display with conditions. Designed for medical and command panels.

| Property | Value |
|----------|-------|
| Type | `crew_status` |
| Min Size | 2 x 2 |
| Default Size | 10 x 24 |

**Bindings:** None (reads crew automatically)

**Shows:**
- Crew member names and roles
- Health status
- Conditions (injured, incapacitated, etc.)
- Assigned station

---

### Transmission Console

Incoming transmissions and messages displayed as they arrive.

| Property | Value |
|----------|-------|
| Type | `transmission_console` |
| Min Size | 2 x 2 |
| Default Size | 12 x 24 |

**Bindings:** None (reads transmissions automatically)

**Shows:**
- Sender identification
- Timestamp
- Message content
- Priority level

---

### System Status Overview

Interactive summary of all system statuses with drill-down capability and bulk reset option.

| Property | Value |
|----------|-------|
| Type | `system_status_overview` |
| Min Size | 4 x 8 |
| Default Size | 12 x 14 |

**Bindings:** None (reads all systems)

**Features:**
- Summary counts by status
- Click to see systems in each status
- Bulk reset option (GM only)

---

## Specialized Widgets

Specialized widgets provide complex visualizations.

### Holomap

Interactive ship deck plan with real-time markers showing crew, damage, and points of interest.

| Property | Value |
|----------|-------|
| Type | `holomap` |
| Min Size | 2 x 2 |
| Default Size | 12 x 24 |

**Bindings:**
- Configured via holomap editor

**Features:**
- Deck plan image
- Real-time markers
- Zoom and pan
- Marker interactions

---

### Ship Log

Timeline of all ship events with filtering and search capabilities.

| Property | Value |
|----------|-------|
| Type | `ship_log` |
| Min Size | 2 x 2 |
| Default Size | 12 x 30 |

**Bindings:** None (reads full event history)

**Features:**
- Chronological event list
- Filter by event type
- Search functionality
- Time range selection

---

### Radar

Polar radar display showing sensor contacts with range rings and bearing indicators.

| Property | Value |
|----------|-------|
| Type | `radar` |
| Min Size | 4 x 8 |
| Default Size | 12 x 24 |

**Bindings:** None (reads contacts automatically)

**Features:**
- Contacts positioned by bearing and distance
- Range rings for distance reference
- Contact icons indicate type/threat
- Optional sweep animation

---

### Mini-Game

Launcher for interactive mini-games tied to task completion.

| Property | Value |
|----------|-------|
| Type | `mini_game` |
| Min Size | 2 x 2 |
| Default Size | 10 x 24 |

**Note:** Mini-game support is still being developed. Currently shows a placeholder.

---

## GM Widgets

GM widgets are only visible and usable by Game Masters.

### Quick Scenarios

One-click scenario execution panel for prepared scenarios.

| Property | Value |
|----------|-------|
| Type | `quick_scenarios` |
| Min Size | 4 x 8 |
| Default Size | 12 x 14 |

**Bindings:** None (reads all scenarios)

**Features:**
- List of available scenarios
- One-click execution
- Scenario descriptions
- Recent execution history

**Use for:**
- GM dashboard panels
- Quick access to common scenarios
- Session pacing tools

---

## Grid System Reference

Panels use a **24-column grid** with **25px row height**. Widget sizes are specified in grid units.

### Example Sizes

| Description | Width x Height | Pixels (approx) |
|-------------|----------------|-----------------|
| Small indicator | 4 x 4 | 100px x 100px |
| Medium widget | 8 x 12 | 200px x 300px |
| Large widget | 12 x 24 | 300px x 600px |
| Full width | 24 x 12 | 600px x 300px |

### Minimum Size Enforcement

The panel editor enforces minimum dimensions for each widget type. You cannot resize a widget smaller than its minimum.

---

## See Also

- [Panels](../guide/panels.md) - Panel design and layout
- [Status States](status-states.md) - Status colors and meanings
- [GM Guide](../guide/gm-guide.md) - Using widgets in sessions
