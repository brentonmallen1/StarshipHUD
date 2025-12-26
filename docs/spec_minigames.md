# Mini-Game Contract Specification (Task 0.8)

This document defines the **mini-game system** — timed interactions that players complete to resolve tasks.

---

## Design Principles

1. **Short & Repeatable**: Mini-games should take 15-60 seconds
2. **Clear Outcomes**: Success, partial success, or failure
3. **Station-Themed**: Each mini-game fits a station's role
4. **Optional**: Tasks function without mini-games; they're an enhancement
5. **Pluggable**: New mini-games can be added without changing task logic

---

## Mini-Game Interface Contract

### Inputs (Launcher → Mini-Game)

```typescript
interface MiniGameContext {
  // Identity
  task_id: string;
  minigame_type: string;

  // Configuration
  difficulty: number;        // 1-5 scale
  time_limit: number;        // Seconds

  // Modifiers (environmental effects)
  modifiers: MiniGameModifier[];

  // Related data (for display)
  system_states?: SystemState[];
  incident?: Incident;
}

interface MiniGameModifier {
  type: 'jamming' | 'low_power' | 'damage' | 'stress' | 'glitch';
  intensity: number;  // 0-1 scale
  description: string;
}
```

### Outputs (Mini-Game → Launcher)

```typescript
interface MiniGameResult {
  outcome: MiniGameOutcome;
  score?: number;           // Optional performance metric
  time_taken: number;       // Seconds
  side_effects: SideEffect[];
}

type MiniGameOutcome =
  | 'success'    // Task succeeds, full rewards
  | 'partial'    // Task succeeds with degraded outcome
  | 'failure'    // Task fails, consequences apply
  | 'abort';     // Player quit, treated as failure

interface SideEffect {
  type: string;
  target?: string;
  value?: number | string;
  description: string;
}
```

---

## Mini-Game Type Definition

Each mini-game type is registered with:

```typescript
interface MiniGameTypeDefinition {
  // Identity
  type: string;                    // Unique key (e.g., "wire_reroute")
  name: string;                    // Display name
  description: string;             // Brief description
  station: StationGroup;           // Primary station

  // Difficulty scaling
  difficultyParams: {
    base_time: number;             // Base time limit at difficulty 1
    time_per_difficulty: number;   // Adjust per difficulty level (+/-)
    complexity_scaling: string;    // Description of how difficulty changes gameplay
  };

  // Component
  Component: React.FC<MiniGameProps>;

  // Outcome mapping hints
  outcomes: {
    success: string;               // What success means
    partial: string;               // What partial means
    failure: string;               // What failure means
  };
}
```

---

## MVP Mini-Games

### A. Wire Reroute (Engineering)

```typescript
{
  type: 'wire_reroute',
  name: 'Wire Reroute',
  station: 'engineering',
  description: 'Connect matching power nodes to restore circuits',

  difficultyParams: {
    base_time: 45,
    time_per_difficulty: -5,
    complexity_scaling: 'More wires, decoy nodes at higher difficulty'
  },

  outcomes: {
    success: 'Circuit restored, power stable',
    partial: 'Circuit restored but unstable',
    failure: 'Breaker tripped, power fluctuation'
  }
}
```

**Gameplay**:
- Display: Grid of colored nodes (left and right sides)
- Goal: Drag wires to connect matching colors
- Challenge: Limited time, wires can't cross (or penalty)
- Modifiers: `jamming` adds decoy nodes, `low_power` dims display

### B. Signal Tuning (Sensors/Comms)

```typescript
{
  type: 'signal_tuning',
  name: 'Signal Tuning',
  station: 'sensors',
  description: 'Align frequency and phase to lock onto signal',

  difficultyParams: {
    base_time: 40,
    time_per_difficulty: -4,
    complexity_scaling: 'Signal drift speed, noise intensity'
  },

  outcomes: {
    success: 'Signal locked, full clarity',
    partial: 'Signal acquired, degraded quality',
    failure: 'Lock lost, contact confidence dropped'
  }
}
```

**Gameplay**:
- Display: Two dials (frequency + phase) and a signal meter
- Goal: Adjust dials until signal meter is green
- Challenge: Signal drifts, requiring constant adjustment
- Modifiers: `stress` increases drift speed, `glitch` adds visual noise

### C. Coolant Balancing (Engineering)

```typescript
{
  type: 'coolant_balance',
  name: 'Coolant Balancing',
  station: 'engineering',
  description: 'Maintain reactor temperature by balancing coolant flow',

  difficultyParams: {
    base_time: 60,
    time_per_difficulty: -8,
    complexity_scaling: 'Surge frequency, narrower safe zone'
  },

  outcomes: {
    success: 'Temperature stabilized',
    partial: 'Temperature controlled but elevated',
    failure: 'Thermal spike, engine strain'
  }
}
```

**Gameplay**:
- Display: Two gauges (primary/secondary coolant), temperature indicator
- Goal: Keep temperature in green zone for required duration
- Challenge: Random surges require quick valve adjustments
- Modifiers: `damage` causes valve lag

### D. Pressure Seal (Life Support)

```typescript
{
  type: 'pressure_seal',
  name: 'Pressure Seal',
  station: 'life_support',
  description: 'Patch hull breaches before atmosphere is lost',

  difficultyParams: {
    base_time: 50,
    time_per_difficulty: -6,
    complexity_scaling: 'More leaks, faster spawn rate'
  },

  outcomes: {
    success: 'All breaches sealed',
    partial: 'Major breaches sealed, minor leaks remain',
    failure: 'Breach worsened, pressure critical'
  }
}
```

**Gameplay**:
- Display: Schematic with leak points appearing
- Goal: Click/tap leaks to seal them
- Challenge: Leaks spawn faster than you can seal them; prioritize
- Modifiers: `low_power` reduces visibility

---

## Outcome Mapping

When mini-game completes, outcomes map to task system:

```typescript
function processMiniGameResult(task: Task, result: MiniGameResult): void {
  switch (result.outcome) {
    case 'success':
      task.status = 'succeeded';
      executeOutcomes(task.on_success);
      break;

    case 'partial':
      task.status = 'succeeded';
      // Execute success outcomes with reduced effect
      executeOutcomes(task.on_success, { effectiveness: 0.5 });
      // May also trigger minor negative effects
      break;

    case 'failure':
    case 'abort':
      task.status = 'failed';
      executeOutcomes(task.on_failure);
      break;
  }

  // Always apply side effects from mini-game
  for (const effect of result.side_effects) {
    applySideEffect(effect);
  }

  emitEvent('minigame_completed', {
    task_id: task.id,
    minigame_type: task.minigame_id,
    outcome: result.outcome,
    score: result.score
  });
}
```

---

## Database Schema

```sql
CREATE TABLE minigame_defs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  station TEXT NOT NULL,
  difficulty_params TEXT NOT NULL, -- JSON
  outcomes TEXT NOT NULL, -- JSON
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE minigame_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  minigame_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  score INTEGER,
  time_taken INTEGER NOT NULL,
  side_effects TEXT NOT NULL DEFAULT '[]', -- JSON
  modifiers TEXT NOT NULL DEFAULT '[]', -- JSON
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_minigame_results_task ON minigame_results(task_id);
```

---

## API Endpoints

```
# Mini-game definitions (catalog)
GET    /api/minigames                 # List available mini-games
GET    /api/minigames/:type           # Get mini-game details

# Mini-game execution
POST   /api/tasks/:id/start-minigame  # Begin mini-game for task
POST   /api/tasks/:id/complete-minigame  # Submit mini-game result
```

### Start Mini-Game Response

```typescript
{
  task_id: string;
  minigame_type: string;
  difficulty: number;
  time_limit: number;
  modifiers: MiniGameModifier[];
  system_context: {
    states: SystemState[];
    incident?: Incident;
  };
}
```

### Complete Mini-Game Request

```typescript
{
  outcome: MiniGameOutcome;
  score?: number;
  time_taken: number;
  side_effects?: SideEffect[];
}
```

---

## Overlay Integration

Mini-games open as a full-screen overlay:

1. Player clicks "Start Mini-Game" on task widget
2. Overlay appears with mini-game component
3. Timer counts down
4. On completion/timeout, overlay closes
5. Result is submitted to backend
6. Task status updates, outcomes execute

The overlay:
- Blocks panel interaction underneath
- Shows timer prominently
- Has "Abort" button (with confirmation)
- Handles window focus loss gracefully

---

## Modifier System

Modifiers come from:
- Posture state (red alert = stress)
- Related system states (low power, damage)
- Incidents (jamming, contamination)
- Glitch intensity

```typescript
function calculateModifiers(task: Task, ship: ShipState): MiniGameModifier[] {
  const modifiers: MiniGameModifier[] = [];

  if (ship.posture === 'red') {
    modifiers.push({
      type: 'stress',
      intensity: 0.5,
      description: 'Red alert conditions'
    });
  }

  const power = ship.systems.find(s => s.id === 'power_grid');
  if (power && power.value < 50) {
    modifiers.push({
      type: 'low_power',
      intensity: 1 - (power.value / 50),
      description: 'Reduced power affecting systems'
    });
  }

  if (ship.glitch_intensity > 0.3) {
    modifiers.push({
      type: 'glitch',
      intensity: ship.glitch_intensity,
      description: 'System interference'
    });
  }

  return modifiers;
}
```

---

## Acceptance Checks

- [ ] New mini-games can be added without changing the task system
- [ ] Mini-games are optional; tasks still function without them
- [ ] Outcomes correctly map to task success/failure
- [ ] Modifiers affect mini-game difficulty/visuals
- [ ] Results persist and emit events
- [ ] Overlay doesn't break panel layout
