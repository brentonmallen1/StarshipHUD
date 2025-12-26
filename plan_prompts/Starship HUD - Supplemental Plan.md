# Supplemental Plan — Next 12 Tasks (Deep Detail)

This supplements the main execution plan by giving **high-resolution step-by-step guidance** for the next 12 tasks, including:
- precise intent
- concrete outputs
- interfaces/fields to define
- edge cases to decide
- acceptance checks (definition of done)
- recommended “Claude prompt” framing (no code, just how to scope)

---

## Task 1/12 — 0.7 Incident/Task Lifecycle Spec

### Objective
Create a spec that makes incidents + tasks **first-class gameplay pacing objects** (GM controllable, system-coupled, mini-game compatible).

### Outputs
- `/docs/spec_incidents_tasks.md`
- One example incident + task set in `/docs/examples/incidents_tasks_example.json` (example data only)

### What to Decide (Write Explicitly)
- **Incident vs Task boundaries**
  - Incident = narrative/system-level problem container
  - Task = actionable step that resolves or mitigates incident
- **Task states** (recommend fixed enum)
  - `open` → `active` → (`succeeded` | `failed` | `expired` | `aborted`)
- **Assignment semantics**
  - Claimable by station? by user? (MVP: station-only; user optional)
- **Time semantics**
  - Optional timer: counts down from start OR from creation
  - Define “expiry action” (auto-fail? degrade system? spawn new incident?)
- **Consequences and rewards**
  - Must be declarative (payload fields), not hardcoded per task type

### Spec Sections (Suggested)
1. Core definitions
2. Field-level contract for Incident
3. Field-level contract for Task
4. State machine for Task (include diagram in markdown)
5. Time & expiry rules
6. Consequences/rewards payload schema
7. How tasks link to system_states, zones, contacts, holomap markers
8. Logging requirements (events emitted on transitions)
9. Accessibility & UX considerations (panic tasks must be legible)

### Edge Cases to Cover
- Multiple tasks attached to one incident
- Two incidents affecting same system
- Task succeeds but system stays degraded (partial success)
- GM override transitions (force succeed/fail)
- Player attempts task without required minigame (what happens)

### Acceptance Checks
- Includes a **task state transition table**
- Defines a **minimal incident** and **minimal task** JSON example
- Explains exactly what events are emitted at:
  - incident create/resolve
  - task create/start/finish/expire

### Claude Prompt Framing
“Write the lifecycle spec with explicit field contracts, a state machine, and example JSON. Optimize for deterministic backend implementation.”

---

## Task 2/12 — 0.8 Mini-Game Contract Spec

### Objective
Ensure mini-games can be added like widgets: modular, swappable, outcomes standardized.

### Outputs
- `/docs/spec_minigames.md`
- `/docs/examples/minigame_contract_examples.json`

### What to Decide
- Mini-game result enum:
  - `success`, `partial`, `fail`, `abort`, `timeout`
- Difficulty model:
  - integer 1–10 OR named tiers
- Timing:
  - time_limit seconds, plus optional grace
- Modifiers:
  - posture, low power, jamming, hull breach (as a list)

### Contract (Write Explicitly)
- **Inputs**: task_id, minigame_id, difficulty, time_limit, modifiers
- **Outputs**: result, score (optional), notes, duration_ms
- **Side effects**: must be described as “recommended mapping” not direct state mutation by frontend (backend applies mapping)

### Spec Sections
1. Goals + constraints (short duration, repeatable)
2. Mini-game interface contract
3. Outcome mapping model (declarative)
4. Anti-cheat expectations (MVP honest clients, later hardened)
5. UX rules (no navigation away, clear timer, big affordances)
6. Accessibility rules (color/contrast, avoid tiny targets)

### Edge Cases
- Client disconnect mid-game
- Double-submit results
- Aborted games (does it re-open task?)
- Multiple users starting same minigame (lock semantics)

### Acceptance Checks
- Shows 3 example mappings:
  - engineering reroute wires
  - comms signal tuning
  - life support pressure seal
- Defines server-side idempotency expectation for result submission

### Claude Prompt Framing
“Write an interface + outcome mapping spec that a backend can enforce and a frontend can implement with a consistent overlay launcher.”

---

## Task 3/12 — 0.9 Threat Posture + ROE Spec

### Objective
Make red/yellow alert (and ROE toggles) an actual **control surface** that influences alerts, sensors, comms, and glitch intensity.

### Outputs
- `/docs/spec_posture_roe.md`
- `/docs/examples/posture_profiles.md` (written examples)

### Decisions
- Postures (MVP):
  - Green, Yellow, Red
- Optional postures (defer):
  - Silent Running, General Quarters
- ROE toggles (MVP):
  - weapons_safeties (on/off)
  - comms_open (open/encrypted)
  - transponder (on/off/spoof)
  - sensor_emissions (passive/active)

### Define Effects (Prose + tables)
- Global UI tint / alert bar behavior
- Sensor noise floor changes (confidence drift)
- Comms encryption prompts
- Glitch base intensity bump

### Acceptance Checks
- Contains a table: posture → effects
- Contains a table: ROE toggle → effects
- Defines which role can modify posture (GM only by default)

### Claude Prompt Framing
“Write the posture spec as a deterministic mapping that can be used by both UI styling and backend rule engines.”

---

## Task 4/12 — 0.10 Scenario Rehearsal Spec

### Objective
Let GM run a **dry-run** that yields a diff (states, tasks, alerts, events) with no persistence.

### Outputs
- `/docs/spec_scenario_rehearsal.md`
- `/docs/examples/rehearsal_diff_example.json`

### Decide
- Rehearsal can be:
  - “pure diff” (read-only)
  - “sandbox branch” (defer)
- Commit semantics:
  - commit applies *the same computed plan* (deterministic)

### Define Diff Model
- state changes: before/after
- new incidents/tasks
- events/alerts that would be emitted
- glitch deltas
- holomap marker changes (if any)

### Acceptance Checks
- Defines “determinism contract”: rehearsal diff must match commit outcome given same starting state
- Defines how to handle time-dependent actions (e.g., timers start at commit time)

### Claude Prompt Framing
“Specify a rehearsal mode that produces a structured diff and can be committed without re-simulating differently.”

---

## Task 5/12 — 2.2 Schema Expansion (Tasks/Incidents/Posture/Contacts/Holomap)

### Objective
Add the minimum DB tables and relationships to support the new systems without painting into a corner.

### Outputs
- `/docs/spec_schema_additions_v1.md` (table-by-table)
- A migration plan note: `/docs/migrations_plan.md`

### Tables to Define (MVP)
- `posture_state` (per ship)
- `incidents`
- `tasks`
- `contacts`
- `sensor_contacts`
- `holomap_layers`
- `holomap_markers`
- `glitch_state`
- `timeline_bookmarks`
- `minigame_defs`
- `task_minigame_links`

### Relationship Notes (to include)
- incident → tasks (1-to-many)
- incident ↔ system_states (many-to-many via join table or JSON list; choose explicitly)
- holomap_marker ↔ incident/task (optional FK)
- sensor_contact ↔ contact (optional FK)
- minigame_defs ↔ tasks (via link table)

### Edge Cases
- deleting an incident: what happens to tasks? (archive vs cascade delete)
- deleting system_state referenced by tasks/incidents (restrict)
- bookmarks referencing events (FK or event_id stored)

### Acceptance Checks
- Each table has:
  - purpose
  - key fields
  - constraints
  - indexes
- You can answer queries:
  - open tasks by station
  - incidents affecting a system
  - markers for a deck plan

### Claude Prompt Framing
“Write the schema spec with constraints and indexes to support the target queries. Keep JSON use explicit and minimal.”

---

## Task 6/12 — 2.7 Events Feed + Bookmarks

### Objective
Events become the backbone for log/timeline, alerts, transmissions, and auditability.

### Outputs
- `/docs/spec_events_and_bookmarks.md`
- `/docs/examples/events_examples.json`

### Event Types (MVP additions)
- `transmission_received`
- `contact_updated`
- `incident_created/resolved`
- `task_created/started/finished/expired`
- `posture_changed`
- `holomap_marker_added/updated`

### Bookmark Model
- bookmark references:
  - event_id (preferred)
  - label
  - visibility (gm-only vs player-visible)

### Acceptance Checks
- Events spec defines:
  - severity mapping
  - retention policy (how many kept)
  - pagination shape
- Bookmark spec defines:
  - who can create
  - how they show in timeline

### Claude Prompt Framing
“Define event types and payload expectations so that frontend widgets can be dumb renderers.”

---

## Task 7/12 — 5.7 Mini-Game Launcher Overlay (Framework)

### Objective
A consistent overlay container that can host any mini-game module.

### Outputs
- `/docs/spec_minigame_overlay_ui.md`
- `/docs/wireframes/minigame_overlay.md` (ASCII/wireframe is fine)

### Overlay Requirements
- modal overlay with:
  - title, task reference
  - timer
  - “abort” and “submit”
  - result display
- no route changes
- keyboard handling (escape abort, etc.)

### Acceptance Checks
- Spec includes:
  - interaction flow diagram
  - error states (disconnect, timeouts)
  - state locking expectations (task becomes active when game starts)

### Claude Prompt Framing
“Write the overlay interaction spec and failure behaviors; optimize for reliability over flair.”

---

## Task 8/12 — 6.15 Tasks Queue Widget (Detailed)

### Objective
Make tasks the panic engine: players have clear actions, GMs have pacing control.

### Outputs
- `/docs/spec_widget_tasks_queue.md`
- `/docs/examples/tasks_queue_configs.json`

### Config Fields
- station filter
- show states (open/active)
- sorting (severity, time remaining)
- compact vs detailed
- show minigame button

### Runtime Behaviors
- claim/start task (optional)
- launch mini-game
- show countdown
- show consequences preview (GM toggle)

### Acceptance Checks
- Spec includes:
  - UI states
  - empty states
  - what happens when task expires while visible

### Claude Prompt Framing
“Write widget spec including config, bindings, runtime actions, and state transitions. Include edge cases.”

---

## Task 9/12 — 6.12 Transmission Console Widget (Detailed)

### Objective
A diegetic comms console that feels like story delivery, not chat UI.

### Outputs
- `/docs/spec_widget_transmissions.md`
- `/docs/examples/transmission_payloads.json`

### Data Sources (choose)
- transmissions as events (`transmission_received`)
- optionally a `transmissions` table later (defer)

### Widget Config
- filter by channel (distress, internal, unknown)
- show encryption state
- show distortion intensity (from glitch/jamming)

### Runtime Interactions
- request retransmit
- attempt decrypt (mini-game hook optional)
- archive/acknowledge
- link to contact dossier (if sender known)

### Acceptance Checks
- Defines how to represent:
  - partial packets / corrupted text
  - “signal lost” moments
  - urgent alerts triggered by messages

### Claude Prompt Framing
“Specify a comms widget that consumes events and presents transmissions with distortion/encryption semantics.”

---

## Task 10/12 — 6.14 Threat Posture + ROE Widget (Detailed)

### Objective
Command panel “big lever” that affects multiple systems’ presentation and behavior.

### Outputs
- `/docs/spec_widget_posture_roe.md`
- `/docs/examples/posture_widget_config.json`

### Widget Config
- allowed postures
- which toggles visible
- gm-only interactions
- whether posture change emits an alert

### Runtime
- posture indicator (big and unmistakable)
- toggles for ROE
- shows “effective effects” summary (small text)

### Acceptance Checks
- Defines what updates immediately (UI tint, alerts)
- Defines what updates indirectly (sensor noise, comms encryption defaults)

### Claude Prompt Framing
“Write widget spec with emphasis on effects preview and audit trail (events).”

---

## Task 11/12 — 6.18 Holomap / Deck Plan Widget (Image + Markers)

### Objective
Spatial stakes: breaches, fires, sealed doors, crew positions.

### Outputs
- `/docs/spec_widget_holomap.md`
- `/docs/examples/holomap_marker_types.md`

### MVP Model
- background image per ship or per deck
- layers (optional) for deck selection
- markers:
  - position (x,y normalized 0..1)
  - type (breach/fire/door/crew/anomaly)
  - severity
  - linked incident/task id
  - label

### Runtime Interactions
- click marker → details panel
- filter markers by type/severity
- GM can add/move markers in edit/admin mode (define boundary)

### Acceptance Checks
- Marker coordinate system is defined (normalized)
- Spec covers responsiveness (different screen sizes)

### Claude Prompt Framing
“Specify holomap widget with coordinate model, marker taxonomy, and linking behavior to incidents/tasks.”

---

## Task 12/12 — 7.10 Scenario Rehearsal + Diff Viewer (Admin UI)

### Objective
The GM sees a “what will happen” diff before committing.

### Outputs
- `/docs/spec_admin_rehearsal_ui.md`
- `/docs/wireframes/rehearsal_diff_view.md`

### UI Requirements
- scenario list → scenario detail
- “Rehearse” button
- diff sections:
  1) system states changes
  2) incidents/tasks to spawn
  3) alerts/events to emit
  4) holomap marker changes
  5) glitch intensity changes
- “Commit” uses diff plan id (or reuses computed plan)

### Acceptance Checks
- Diff view clearly shows:
  - before/after values
  - status changes highlighted
  - created objects clearly labeled
- Rehearsal can be rerun after state changes and results update accordingly

### Claude Prompt Framing
“Write rehearsal UI spec focusing on clarity and determinism; avoid hidden side effects.”

---

# Dependency Graph (So You Don’t Fight Yourself)

### Must happen first (spec before schema/UI)
- 0.7 incidents/tasks spec
- 0.8 minigames spec
- 0.9 posture spec
- 0.10 rehearsal spec

### Then DB and API contracts
- 2.2 schema expansion
- 2.7 events/bookmarks spec (and endpoints)

### Then UI frameworks
- 5.7 minigame overlay spec
- 6.15 tasks queue widget spec
- 6.12 transmission widget spec
- 6.14 posture widget spec
- 6.18 holomap widget spec
- 7.10 rehearsal UI spec

---

# “Done Means Done” Checklist (Apply to Each Task)

For each of the 12 tasks, require:
- [ ] Clear written spec with headings
- [ ] At least one concrete example payload/config
- [ ] Edge cases section
- [ ] Acceptance checks written as verifiable statements

---
