# Data Model Reference

This document describes how data is organized in Starship HUD and how different objects relate to each other.

## Core Concepts

### Ship

The **Ship** is the top-level container for everything. Each ship has its own:

- System states (reactor, shields, life support, etc.)
- Panels (bridge station displays)
- Assets (weapons, drones, probes)
- Contacts (NPCs and other vessels)
- Crew (personnel aboard)
- Cargo (inventory)
- Scenarios (pre-scripted events)
- Events (ship log entries)

You can run multiple ships in one Starship HUD instance, though most campaigns use one.

**Key Fields:**
- `name` - Ship's name (e.g., "ISV Constellation")
- `ship_class` - Ship type (e.g., "Corvette")
- `registry` - Registration number
- `description` - Flavor text
- `attributes` - Custom key/value data

---

### System States

**System States** represent the ship's internal systems—everything from the reactor to life support to individual subsystems.

**Key Fields:**
- `name` - System name (e.g., "Main Reactor")
- `status` - Current status (operational, degraded, critical, etc.)
- `value` - Numeric value (e.g., power output percentage)
- `max_value` - Maximum possible value
- `unit` - Unit of measurement (e.g., "MW", "%")
- `depends_on` - List of parent system IDs

**Computed Fields:**
- `effective_status` - Status after accounting for parent dependencies
- `limiting_parent` - Which parent is capping this system's status

---

### Panels

**Panels** are the displays players see. Each panel:

- Belongs to a station group (Command, Engineering, etc.)
- Contains multiple widgets in a grid layout
- Has role visibility (player, GM, or both)

**Key Fields:**
- `name` - Panel name (e.g., "Main Engineering")
- `station_group` - Which station this belongs to
- `role_visibility` - Who can see this panel
- `grid_columns` / `grid_rows` - Grid dimensions (default 24 x 48)

---

### Widget Instances

**Widget Instances** are the individual widgets placed on panels.

**Key Fields:**
- `widget_type` - Type of widget (e.g., "health_bar")
- `x` / `y` - Position on the grid
- `width` / `height` - Size in grid units
- `config` - Widget-specific configuration
- `bindings` - Data connections (which system, asset, etc.)
- `label` - Custom label override

---

### Assets

**Assets** are deployable equipment: weapons, drones, and probes.

**Key Fields:**
- `name` - Asset name (e.g., "PDC Array Port")
- `asset_type` - Category (energy_weapon, torpedo, drone, probe, etc.)
- `status` - Operational status
- `ammo_current` / `ammo_max` - Ammunition counts
- `is_armed` / `is_ready` - Readiness state
- `mount_location` - Where it's mounted (port, starboard, dorsal, etc.)
- `depends_on` - Parent system IDs

---

### Contacts

**Contacts** are NPC dossiers—other ships, people, or entities the crew knows about.

**Key Fields:**
- `name` - Contact name
- `affiliation` - Faction or organization
- `threat_level` - friendly, neutral, suspicious, hostile, unknown
- `role` - What they do
- `notes` - Background information
- `tags` - Categorization tags

---

### Sensor Contacts

**Sensor Contacts** are what appears on radar—detected objects in space.

**Key Fields:**
- `label` - Designation (e.g., "Contact Alpha")
- `contact_id` - Link to dossier (if identified)
- `confidence` - How certain the detection is (0-100)
- `threat_level` - Assessed threat
- `bearing_deg` / `range_km` - Position relative to ship
- `vector` - Movement direction/speed
- `signal_strength` - Detection strength
- `visible` - Whether players can see this contact

Sensor contacts can link to contact dossiers once identified.

---

### Crew

**Crew** members are personnel aboard the ship.

**Key Fields:**
- `name` - Crew member name
- `role` - Their job (e.g., "Chief Engineer")
- `status` - Duty status (fit_for_duty, light_duty, incapacitated, critical, deceased, missing)
- `player_name` - If a PC, the player's name
- `is_npc` - Whether this is an NPC
- `condition_tags` - Current conditions (injured, fatigued, etc.)

---

### Cargo

**Cargo** is ship inventory—supplies, equipment, trade goods.

**Key Fields:**
- `name` - Item name
- `category` - Type (supplies, equipment, trade goods, etc.)
- `quantity` - How many
- `unit` - Unit of measurement
- `description` - Notes
- `location` - Where it's stored
- `value` - Worth (for trade goods)

---

### Events

**Events** are ship log entries—things that have happened.

**Key Fields:**
- `type` - Event category (status_change, transmission, alert, etc.)
- `severity` - info, warning, critical
- `message` - What happened
- `data` - Additional structured data
- `transmitted` - Whether this was broadcast ship-wide

---

### Transmissions

**Transmissions** are incoming messages from outside the ship.

**Key Fields:**
- `sender_name` - Who sent it
- `channel` - Communication channel (distress, hail, internal, broadcast, encrypted)
- `encrypted` - Whether it needs decryption
- `signal_strength` - How clear the signal is (0-100)
- `text` - Message content

---

### Scenarios

**Scenarios** are pre-scripted event sequences for GMs.

**Key Fields:**
- `name` - Scenario name
- `description` - What this scenario represents
- `actions` - List of actions to execute
- `position` - Sort order in the UI

**Action Types:**
- `set_status` - Change a system's status
- `adjust_value` - Change a system's numeric value
- `spawn_task` - Create a task
- `send_transmission` - Queue a message
- `emit_event` - Add to ship log
- `delay` - Wait before next action

---

### Tasks

**Tasks** are work items for the crew to complete.

**Key Fields:**
- `title` - Task name
- `description` - What needs to be done
- `station` - Which station handles this
- `status` - pending, active, succeeded, failed, expired
- `time_limit` - Seconds allowed (optional)
- `on_success` / `on_failure` / `on_expire` - Consequence actions

---

### Posture State

**Posture State** tracks the ship's alert level and rules of engagement.

**Postures:**
- `green` - Normal operations
- `yellow` - Elevated alert
- `red` - Combat ready
- `general_quarters` - Battle stations
- `silent_running` - Minimal emissions

**Rules of Engagement:**
- `weapons_safeties` - on / off
- `comms_broadcast` - open / encrypted / silent
- `transponder` - active / masked / off
- `sensor_emissions` - standard / reduced / passive_only

---

## Relationships Diagram

```
Ship
├── System States
│   └── depends_on → other System States (cascade effects)
├── Panels
│   └── Widget Instances
│       └── bindings → System States, Assets, etc.
├── Assets
│   └── depends_on → System States
├── Contacts (dossiers)
├── Sensor Contacts
│   └── contact_id → Contact (when identified)
├── Crew
├── Cargo
├── Events (ship log)
├── Transmissions
├── Scenarios
│   └── actions → affect System States, create Tasks, etc.
├── Tasks
│   └── on_success/failure/expire → affect System States
├── Posture State
└── Holomap Layers
    └── Holomap Markers
```

---

## Widget Bindings

Widgets connect to data through **bindings**. Common binding fields:

| Binding | Used By | Purpose |
|---------|---------|---------|
| `system_state_id` | Status Display, Health Bar | Single system |
| `system_state_ids` | System Dependencies, Environment | Multiple systems |
| `asset_id` | Asset Display | Single asset |
| `dataset_id` | Data Table | Custom data source |
| `station_group` | Task Queue | Filter by station |

---

## Status Enums

### System Status

```
optimal → operational → degraded → compromised → critical → destroyed
                                                              ↑
offline ←───────────────────────────────────────────────────────┘
```

Any non-destroyed system can go offline and return to its previous status.

### Threat Level

```
friendly | neutral | suspicious | hostile | unknown
```

### Event Severity

```
info | warning | critical
```

### Task Status

```
pending → active → succeeded
              ↘ failed
              ↘ expired
```

### Crew Status

```
fit_for_duty | light_duty | incapacitated | critical | deceased | on_leave | missing
```

---

## See Also

- [Status States](status-states.md) - Visual language for status
- [Widget Reference](widgets.md) - All widget types and their bindings
- [Scenarios](../guide/scenarios.md) - How scenarios use the data model
