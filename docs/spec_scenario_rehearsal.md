# Scenario Rehearsal Specification (Task 0.10)

This document defines the **rehearsal mode** — allowing GMs to preview scenario consequences before committing.

---

## Purpose

Rehearsal mode enables a GM to:
1. See what a scenario will do before it happens
2. Understand cascading effects (tasks, alerts, state changes)
3. Catch unintended consequences
4. Preview the player experience

---

## Core Concept

A **rehearsal** is a dry-run that computes:
- State diffs (before/after for all affected systems)
- Events that would be emitted
- Incidents that would spawn
- Tasks that would spawn
- Alerts that would appear
- Glitch intensity changes

**No persistence** occurs unless the GM explicitly commits.

---

## Rehearsal Model

```typescript
interface RehearsalRequest {
  scenario_id: string;
  // Optional overrides for testing variations
  parameter_overrides?: Record<string, unknown>;
}

interface RehearsalResult {
  scenario_id: string;
  scenario_name: string;
  computed_at: string;

  // What would change
  state_diffs: StateDiff[];
  spawned_incidents: IncidentPreview[];
  spawned_tasks: TaskPreview[];
  emitted_events: EventPreview[];
  alerts: AlertPreview[];

  // Summary
  affected_systems: string[];
  affected_stations: StationGroup[];
  severity_assessment: 'minor' | 'moderate' | 'major' | 'critical';

  // Warnings
  warnings: RehearsalWarning[];
}
```

### State Diff

```typescript
interface StateDiff {
  system_id: string;
  system_name: string;

  // Before state
  before: {
    status: SystemStatus;
    value: number;
  };

  // After state
  after: {
    status: SystemStatus;
    value: number;
  };

  // Change summary
  status_changed: boolean;
  value_delta: number;
  severity_increased: boolean;
}
```

### Previews

```typescript
interface IncidentPreview {
  name: string;
  severity: IncidentSeverity;
  linked_systems: string[];
  tasks_that_would_spawn: number;
}

interface TaskPreview {
  title: string;
  station: StationGroup;
  has_timer: boolean;
  has_minigame: boolean;
  consequences_on_fail: string;  // Summary
}

interface EventPreview {
  type: string;
  severity: string;
  message: string;
}

interface AlertPreview {
  level: 'info' | 'warning' | 'critical';
  message: string;
  source: string;
}

interface RehearsalWarning {
  type: 'cascade' | 'conflict' | 'missing_target' | 'extreme_change';
  message: string;
  details?: string;
}
```

---

## Rehearsal Computation

The backend computes rehearsal by:

1. **Snapshot Current State**: Capture all system states
2. **Simulate Actions**: Apply scenario actions to snapshot (not DB)
3. **Compute Derived Effects**:
   - Threshold-triggered alerts
   - Auto-spawn rule triggers
   - Cascade effects from dependencies
4. **Generate Diffs**: Compare before/after
5. **Collect Warnings**: Identify potential issues

```python
def compute_rehearsal(scenario_id: str, ship_id: str) -> RehearsalResult:
    # Snapshot current state
    current_states = get_system_states(ship_id)
    snapshot = {s.id: s.model_copy() for s in current_states}

    # Get scenario
    scenario = get_scenario(scenario_id)

    # Simulate actions
    simulated = simulate_actions(scenario.actions, snapshot)

    # Compute derived effects
    derived = compute_derived_effects(simulated, ship_id)

    # Generate diffs
    diffs = []
    for system_id, before in snapshot.items():
        after = simulated.get(system_id, before)
        if before != after:
            diffs.append(create_diff(before, after))

    # Collect warnings
    warnings = detect_warnings(diffs, derived)

    return RehearsalResult(
        scenario_id=scenario_id,
        scenario_name=scenario.name,
        state_diffs=diffs,
        spawned_incidents=derived.incidents,
        spawned_tasks=derived.tasks,
        emitted_events=derived.events,
        alerts=derived.alerts,
        warnings=warnings
    )
```

---

## Warning Types

### Cascade Warning

Triggered when a state change would trigger further changes:

```typescript
{
  type: 'cascade',
  message: 'Power drop will trigger sensor degradation',
  details: 'power_grid below 30% triggers lr_sensors status → degraded'
}
```

### Conflict Warning

Triggered when scenario actions conflict:

```typescript
{
  type: 'conflict',
  message: 'Scenario sets reactor to operational and critical',
  details: 'Actions 2 and 5 both target reactor with different statuses'
}
```

### Missing Target Warning

Triggered when action targets non-existent system:

```typescript
{
  type: 'missing_target',
  message: 'System "aux_power" not found',
  details: 'Action 3 targets aux_power which does not exist on this ship'
}
```

### Extreme Change Warning

Triggered when changes are severe:

```typescript
{
  type: 'extreme_change',
  message: '4 systems would become critical',
  details: 'reactor, power_grid, engines, shields all → critical'
}
```

---

## API Endpoints

```
# Rehearsal
POST   /api/scenarios/:id/rehearse    # Compute rehearsal
GET    /api/scenarios/:id/last-rehearsal  # Get cached rehearsal

# Commit
POST   /api/scenarios/:id/execute     # Execute with commit
POST   /api/scenarios/:id/execute-from-rehearsal  # Execute from cached rehearsal
```

### Rehearse Request

```typescript
// POST /api/scenarios/:id/rehearse
{
  parameter_overrides?: Record<string, unknown>;
}
```

### Rehearse Response

```typescript
{
  rehearsal: RehearsalResult;
  can_commit: boolean;
  commit_token: string;  // One-time token for committing
}
```

### Commit from Rehearsal

```typescript
// POST /api/scenarios/:id/execute-from-rehearsal
{
  commit_token: string;  // Ensures we commit exactly what was rehearsed
}
```

---

## UI Requirements

### Rehearsal Panel

The scenario rehearsal UI shows:

1. **Scenario Header**
   - Name and description
   - "Rehearse" button
   - "Commit" button (disabled until rehearsed)

2. **State Diffs Section**
   - Table: System | Before | After | Change
   - Color-coded: green (improve), yellow (minor), red (severe)
   - Expandable rows for details

3. **Spawned Items Section**
   - List of incidents with severity badges
   - List of tasks with station badges
   - Expandable for details

4. **Events & Alerts Section**
   - Timeline of events that would emit
   - Alert previews

5. **Warnings Section**
   - Prominent display of any warnings
   - Must acknowledge warnings before commit

6. **Actions**
   - "Discard" - Clear rehearsal, no commit
   - "Commit" - Execute the rehearsed scenario

```
┌─────────────────────────────────────────────────────┐
│  SCENARIO: Hull Breach - Cargo Bay                  │
│  A micro-meteor impact causes decompression         │
├─────────────────────────────────────────────────────┤
│  [Rehearse]  [Commit] (disabled)                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⚠ WARNING: 1 cascade effect detected               │
│  └─ Hull damage will trigger atmosphere drop        │
│                                                     │
├─────────────────────────────────────────────────────┤
│  STATE CHANGES                                      │
├─────────────────────────────────────────────────────┤
│  System        │ Before      │ After       │ Δ     │
│  ──────────────┼─────────────┼─────────────┼────── │
│  hull          │ ● 100%      │ ○ 80%       │ -20   │
│  atmo (cascade)│ ● 100%      │ ◐ 90%       │ -10   │
├─────────────────────────────────────────────────────┤
│  SPAWNED INCIDENTS                                  │
├─────────────────────────────────────────────────────┤
│  ⬤ Hull Breach - Cargo Bay 2 (critical)            │
│    └─ Linked: hull, atmo                            │
├─────────────────────────────────────────────────────┤
│  SPAWNED TASKS                                      │
├─────────────────────────────────────────────────────┤
│  □ Seal breach in Cargo Bay 2                       │
│    Station: Engineering │ Timer: 3:00 │ Mini-game   │
│    On fail: atmo -20%                               │
├─────────────────────────────────────────────────────┤
│  EVENTS                                             │
├─────────────────────────────────────────────────────┤
│  [CRITICAL] Hull breach detected in Cargo Bay 2!   │
│  [INFO] New task assigned to Engineering            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Discard Rehearsal]       [✓ Acknowledge & Commit] │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Deterministic Execution

When committing from rehearsal:

1. Verify `commit_token` matches cached rehearsal
2. Verify no state has changed since rehearsal (or warn)
3. Execute the same computed plan
4. Results should match rehearsal exactly

If state changed between rehearsal and commit:
- Show diff of current vs rehearsed baseline
- Allow "Re-rehearse" or "Commit anyway"

---

## Caching

Rehearsal results are cached:
- Keyed by: `scenario_id + ship_id + snapshot_hash`
- TTL: 5 minutes (configurable)
- Invalidated on any state change

```sql
CREATE TABLE rehearsal_cache (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  ship_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  result TEXT NOT NULL,  -- JSON
  commit_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_rehearsal_cache_token ON rehearsal_cache(commit_token);
```

---

## Acceptance Checks

- [ ] Rehearsal computes without mutating DB
- [ ] State diffs are accurate and complete
- [ ] Cascade effects are detected and shown
- [ ] Warnings surface potential issues
- [ ] Commit applies same computed plan deterministically
- [ ] UI shows clear before/after comparison
- [ ] GM can acknowledge warnings and proceed
