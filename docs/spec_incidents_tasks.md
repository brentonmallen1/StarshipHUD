# Incident/Task Lifecycle Specification (Task 0.7)

This document defines the **incident and task systems** — narrative events and actionable work items.

---

## Core Concepts

### Incident

An **Incident** is a narrative/system event that represents something happening to the ship.

Examples:
- "Coolant leak in Bay 2"
- "Hostile contact approaching"
- "Power surge in reactor"
- "Hull breach in Cargo Bay"

### Task

A **Task** is an actionable unit that a station can perform to address an incident or maintain systems.

Examples:
- "Seal breach"
- "Patch conduit"
- "Reroute power"
- "Align antenna"
- "Purge contamination"

---

## Incident Model

```typescript
interface Incident {
  id: string;
  ship_id: string;

  // Identity
  name: string;
  description: string;
  severity: IncidentSeverity;

  // Lifecycle
  status: IncidentStatus;
  created_at: string;
  resolved_at?: string;

  // Relationships
  linked_system_ids: string[];  // Affected system states

  // Effects (what happens while active)
  effects: IncidentEffect[];

  // Metadata
  source: 'scenario' | 'derived' | 'manual';  // How it was created
  source_id?: string;  // Scenario ID if from scenario
}

type IncidentSeverity = 'minor' | 'moderate' | 'major' | 'critical';

type IncidentStatus =
  | 'active'      // Ongoing, tasks may be spawned
  | 'contained'   // Stabilized but not resolved
  | 'resolved'    // Fully addressed
  | 'failed';     // Escalated beyond recovery

interface IncidentEffect {
  type: 'status_drift' | 'value_drift' | 'spawn_task' | 'emit_event';
  target?: string;      // system_state_id for drifts
  rate?: number;        // Drift rate per interval
  interval?: number;    // Seconds between drift applications
  task_template?: string;  // For spawn_task type
  event?: EventPayload;    // For emit_event type
}
```

### Incident Lifecycle

```
                        ┌──────────────┐
                        │   created    │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
              ┌────────►│   active     │◄────────┐
              │         └──────┬───────┘         │
              │                │                 │
              │     ┌──────────┼──────────┐      │
              │     ▼          ▼          ▼      │
         ┌────┴─────┐   ┌──────────┐   ┌────────┴─┐
         │contained │   │ resolved │   │  failed  │
         └──────────┘   └──────────┘   └──────────┘
```

---

## Task Model

```typescript
interface Task {
  id: string;
  ship_id: string;

  // Relationship
  incident_id?: string;  // Optional - standalone tasks exist

  // Identity
  title: string;
  description?: string;
  station: StationGroup;  // Who should handle this

  // Lifecycle
  status: TaskStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;

  // Timer (optional)
  time_limit?: number;      // Seconds to complete
  expires_at?: string;      // Calculated deadline

  // Mini-game (optional)
  minigame_id?: string;     // Required mini-game to complete
  minigame_difficulty?: number;

  // Consequences
  on_success: TaskOutcome[];
  on_failure: TaskOutcome[];
  on_expire: TaskOutcome[];

  // Assignment (optional)
  claimed_by?: string;  // Player/session ID
}

type TaskStatus =
  | 'pending'     // Created, not yet started
  | 'active'      // In progress
  | 'succeeded'   // Completed successfully
  | 'failed'      // Failed (via mini-game or manual)
  | 'expired';    // Timer ran out

interface TaskOutcome {
  type: 'set_status' | 'adjust_value' | 'spawn_task' | 'spawn_incident'
      | 'emit_event' | 'set_glitch' | 'resolve_incident';
  target?: string;        // system_state_id
  value?: number | string;
  relative?: boolean;     // For adjust_value: +/- instead of absolute
  task_template?: string; // For spawn_task
  incident_data?: Partial<Incident>; // For spawn_incident
  event?: EventPayload;   // For emit_event
}
```

### Task Lifecycle

```
          ┌─────────────┐
          │   pending   │
          └──────┬──────┘
                 │ claim/start
                 ▼
          ┌─────────────┐
     ┌───►│   active    │◄───┐
     │    └──────┬──────┘    │
     │           │           │
     │  ┌────────┼────────┐  │
     │  ▼        ▼        ▼  │
 ┌───┴───┐ ┌─────────┐ ┌─────┴───┐
 │succeed│ │  failed │ │ expired │
 └───────┘ └─────────┘ └─────────┘
```

---

## Task Timer Behavior

When a task has a `time_limit`:

1. **On Creation**: Calculate `expires_at = created_at + time_limit`
2. **Timer Display**: Widget shows countdown
3. **On Expiration**:
   - Status → `expired`
   - Execute `on_expire` outcomes
   - Emit `task_expired` event

Timer pauses:
- Never (creates urgency)
- Exception: GM pause for out-of-game breaks

---

## Task Generation

Tasks can be created by:

### 1. Manual (GM)

```
POST /api/tasks
{
  "title": "Repair forward sensor array",
  "station": "engineering",
  "time_limit": 300
}
```

### 2. Scenario Actions

```yaml
actions:
  - spawn_task:
      title: "Seal hull breach"
      station: engineering
      time_limit: 180
      on_failure:
        - type: adjust_value
          target: atmo
          value: -20
          relative: true
```

### 3. Derived Rules (Auto-Spawn)

```typescript
interface TaskSpawnRule {
  id: string;
  name: string;
  trigger: SpawnTrigger;
  task_template: TaskTemplate;
  cooldown?: number;  // Prevent spam
}

interface SpawnTrigger {
  type: 'system_threshold' | 'incident_created' | 'posture_change';

  // For system_threshold
  system_id?: string;
  condition?: 'value_below' | 'value_above' | 'status_equals';
  threshold?: number | string;

  // For incident_created
  incident_severity?: IncidentSeverity[];
}

// Example rule
{
  name: "Auto-spawn power reroute task",
  trigger: {
    type: 'system_threshold',
    system_id: 'power_grid',
    condition: 'value_below',
    threshold: 25
  },
  task_template: {
    title: "Reroute power grid",
    station: "engineering",
    time_limit: 120
  }
}
```

---

## Database Schema

```sql
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  ship_id TEXT NOT NULL REFERENCES ships(id),
  name TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('minor', 'moderate', 'major', 'critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'contained', 'resolved', 'failed')),
  linked_system_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
  effects TEXT NOT NULL DEFAULT '[]', -- JSON array
  source TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  ship_id TEXT NOT NULL REFERENCES ships(id),
  incident_id TEXT REFERENCES incidents(id),
  title TEXT NOT NULL,
  description TEXT,
  station TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'succeeded', 'failed', 'expired')),
  time_limit INTEGER,
  expires_at TEXT,
  minigame_id TEXT,
  minigame_difficulty INTEGER,
  on_success TEXT NOT NULL DEFAULT '[]', -- JSON array
  on_failure TEXT NOT NULL DEFAULT '[]', -- JSON array
  on_expire TEXT NOT NULL DEFAULT '[]', -- JSON array
  claimed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE task_spawn_rules (
  id TEXT PRIMARY KEY,
  ship_id TEXT NOT NULL REFERENCES ships(id),
  name TEXT NOT NULL,
  trigger TEXT NOT NULL, -- JSON
  task_template TEXT NOT NULL, -- JSON
  cooldown INTEGER,
  last_triggered_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_incidents_ship_status ON incidents(ship_id, status);
CREATE INDEX idx_tasks_ship_station ON tasks(ship_id, station);
CREATE INDEX idx_tasks_status ON tasks(status);
```

---

## API Endpoints

```
# Incidents
GET    /api/incidents                 # List incidents (filterable)
GET    /api/incidents/:id             # Get incident details
POST   /api/incidents                 # Create incident (GM)
PATCH  /api/incidents/:id             # Update incident
DELETE /api/incidents/:id             # Delete incident (GM)

# Tasks
GET    /api/tasks                     # List tasks (filterable by station, status)
GET    /api/tasks/:id                 # Get task details
POST   /api/tasks                     # Create task (GM)
PATCH  /api/tasks/:id                 # Update task
POST   /api/tasks/:id/claim           # Claim task (player)
POST   /api/tasks/:id/complete        # Complete task (with result)
DELETE /api/tasks/:id                 # Delete task (GM)

# Spawn Rules
GET    /api/task-spawn-rules          # List rules
POST   /api/task-spawn-rules          # Create rule
PATCH  /api/task-spawn-rules/:id      # Update rule
DELETE /api/task-spawn-rules/:id      # Delete rule
```

---

## Event Emissions

| Event Type        | When                        | Payload                    |
|-------------------|-----------------------------|----------------------------|
| `incident_created`| Incident spawned            | incident_id, name, severity|
| `incident_resolved`| Incident resolved/failed   | incident_id, final_status  |
| `task_created`    | Task spawned                | task_id, title, station    |
| `task_claimed`    | Task claimed by player      | task_id, claimed_by        |
| `task_completed`  | Task succeeded/failed       | task_id, result            |
| `task_expired`    | Task timer ran out          | task_id, consequences      |

---

## Acceptance Checks

- [ ] GM can describe "what happens if ignored" for every task type
- [ ] Tasks can be generated by scenarios
- [ ] Tasks can be generated by derived rules
- [ ] Timer expiry triggers consequences
- [ ] Incidents can link to multiple systems
- [ ] Task outcomes execute on completion
