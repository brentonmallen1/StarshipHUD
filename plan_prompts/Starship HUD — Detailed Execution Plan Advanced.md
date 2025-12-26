# Starship HUD — Detailed Execution Plan (Expanded with New Systems + Mini-Games)

This is the **canonical execution plan**. It is optimized for iterative implementation with Claude Code:
- Small tasks (≤30 minutes)
- Concrete artifacts per task
- Acceptance checks per task
- Clear dependency ordering

New additions integrated here:
- System dependency graph widget
- Damage control / crew tasks queue
- Ship log / timeline with bookmarks
- Comms “incoming transmission” console
- Sensor sweep / contact tracker
- Threat posture + ROE (red/yellow alert, etc.)
- Environmental / habitat simulation panel
- Procedural “glitch aesthetics” system
- Holomap / deck plan
- NPC/Contact dossier cards
- Scenario staging / rehearsal mode
- Mini-games (Among Us-style) to fix systems

---

## Master Checklist (Phases → Tasks)

### Phase 0 — Contracts & Decisions
- [ ] 0.1 Status model spec
- [ ] 0.2 Layout model spec
- [ ] 0.3 Widget contract spec
- [ ] 0.4 Roles/modes spec
- [ ] 0.5 Sync model spec
- [ ] 0.6 Seed ship spec
- [ ] 0.7 Incident/task lifecycle spec (NEW)
- [ ] 0.8 Mini-game contract spec (NEW)
- [ ] 0.9 Threat posture + ROE spec (NEW)
- [ ] 0.10 Scenario rehearsal spec (NEW)
- [ ] 0.11 Panel navigation + cross-panel linking spec

### Phase 1 — Repo + Tooling + Containers
- [ ] 1.1 Repo scaffold
- [ ] 1.2 Dev env scaffold (direnv/nix)
- [ ] 1.3 Backend uv scaffold
- [ ] 1.4 Frontend scaffold
- [ ] 1.5 justfile baseline
- [ ] 1.6 Docker/Compose skeleton

### Phase 2 — Backend Core (Schema + API)
- [ ] 2.1 Migration framework
- [ ] 2.2 Schema v1 migrations (expanded entities)
- [ ] 2.3 CRUD endpoints: ships/panels
- [ ] 2.4 CRUD endpoints: system_states
- [ ] 2.5 CRUD endpoints: widget_instances
- [ ] 2.6 CRUD endpoints: scenarios/scenario_actions
- [ ] 2.7 Events feed endpoints
- [ ] 2.8 Panel snapshot endpoint
- [ ] 2.9 Validation rules (thresholds, bounds, transitions)
- [ ] 2.10 Seed data loader (starter ship)

### Phase 3 — Frontend Shell + Data Plumbing
- [ ] 3.1 Routing skeleton
- [ ] 3.2 Global chrome (alert bar container)
- [ ] 3.3 Data layer: API client + cache strategy + polling
- [ ] 3.4 Role gating (simple)
- [ ] 3.5 Player panel view renders “empty panel”
- [ ] 3.6 Admin app shell
- [ ] 3.7 Panel index + diegetic navigator component
- [ ] 3.8 Deep-link plumbing (alerts/log/widgets → target panel/widget)

### Phase 4 — Layout + Edit Mode
- [ ] 4.1 Panel canvas base renderer (static widgets)
- [ ] 4.2 Edit mode toggle + visible affordances
- [ ] 4.3 Drag move
- [ ] 4.4 Resize handles
- [ ] 4.5 Snap-to-grid overlay
- [ ] 4.6 Collision policy v1
- [ ] 4.7 Save/discard layout to backend

### Phase 5 — Widget Framework + Runtime “Overlay Systems”
- [ ] 5.1 Widget registry + instance renderer + fallback UI
- [ ] 5.2 Widget creation modal (catalog)
- [ ] 5.3 Widget config modal framework
- [ ] 5.4 Binding selectors (state/dataset/etc.)
- [ ] 5.5 Widget error surfacing
- [ ] 5.6 Global “glitch aesthetics” overlay engine (NEW)
- [ ] 5.7 Global “mini-game launcher” overlay (NEW)

### Phase 6 — Widgets (MVP + New Fun Systems)
- [ ] 6.1 Title widget
- [ ] 6.2 Divider widget
- [ ] 6.3 Spacer widget
- [ ] 6.4 Section header widget
- [ ] 6.5 Direct status widget
- [ ] 6.6 Health/progress widget
- [ ] 6.7 Dataset model v1
- [ ] 6.8 Table widget
- [ ] 6.9 Weapons/assets widget
- [ ] 6.10 Informational widget
- [ ] 6.11 Ship log / timeline + bookmarks widget (NEW)
- [ ] 6.12 Incoming transmission console widget (NEW)
- [ ] 6.13 Sensor sweep / contact tracker widget (NEW)
- [ ] 6.14 Threat posture + ROE widget (NEW)
- [ ] 6.15 Damage control / tasks queue widget (NEW)
- [ ] 6.16 System dependency graph widget (NEW)
- [ ] 6.17 Environmental/habitat panel widgets (NEW)
- [ ] 6.18 Holomap / deck plan widget (NEW)
- [ ] 6.19 NPC/Contact dossier cards widget (NEW)

### Phase 7 — Admin “DB-like” UI + Authoring Tools
- [ ] 7.1 Generic entity table viewer
- [ ] 7.2 Inline edit forms
- [ ] 7.3 Panel manager + open-in-edit
- [ ] 7.4 Widget catalog + add widget flow
- [ ] 7.5 Ship reset controls
- [ ] 7.6 Contacts/dossiers manager (NEW)
- [ ] 7.7 Holomap editor (basic overlays) (NEW)
- [ ] 7.8 Sensor contacts manager (NEW)
- [ ] 7.9 Task template + incident generator UI (NEW)
- [ ] 7.10 Scenario rehearsal + diff viewer (NEW)
- [ ] 7.11 Mini-game catalog + attachment UI (NEW)

### Phase 8 — Scenarios + Alerts + Incidents + Mini-Games
- [ ] 8.1 Scenario authoring UI
- [ ] 8.2 Scenario execution endpoint (atomic)
- [ ] 8.3 Alert rules (derived + explicit)
- [ ] 8.4 Alert feed widget
- [ ] 8.5 Incidents → tasks auto-spawn rules (NEW)
- [ ] 8.6 Mini-game runtime outcomes → state changes (NEW)
- [ ] 8.7 GM “rehearsal run” mode (no-commit) (NEW)

### Phase 9 — Immersion Layer
- [ ] 9.1 Boot sequence visual
- [ ] 9.2 Audio hook
- [ ] 9.3 Status transition animation semantics
- [ ] 9.4 Ambient texture layer
- [ ] 9.5 “Panic escalator” (glitch intensity rises under stress) (NEW)

### Phase 10 — Deployment & Hardening
- [ ] 10.1 Compose polish
- [ ] 10.2 Export config JSON
- [ ] 10.3 Import config JSON (optional)
- [ ] 10.4 Unraid deploy doc + smoke checklist

---

# Phase 0 — Contracts & Decisions (Expanded)

## Task 0.7 — Incident/Task Lifecycle Spec (≤30m) (NEW)
### Output
`/docs/spec_incidents_tasks.md`

### Define these concepts
- **Incident**: a narrative/system event (e.g., “coolant leak in bay 2”)
- **Task**: an actionable unit assigned to a station (e.g., “seal breach”, “patch conduit”)

### Required fields (prose-level contract)
- Incident:
  - id, name, description, severity, created_at, resolved_at
  - linked systems (system_state_ids)
  - effects (direct/derived: status shifts, value drifts)
- Task:
  - id, incident_id, title, station (engineering/tactical/etc.)
  - status (open/active/succeeded/failed/expired)
  - timer/ETA (optional)
  - required mini-game (optional)
  - consequences on fail/ignore
  - rewards on success (stabilize system, reduce glitch, etc.)

### Acceptance checks
- A GM can describe “what happens if ignored” for every task type.
- Tasks can be generated by scenarios and by derived rules.

---

## Task 0.8 — Mini-Game Contract Spec (≤30m) (NEW)
### Output
`/docs/spec_minigames.md`

### Define
- Mini-game is **a timed interaction** with a **clear outcome**:
  - success / partial / fail / abort
- Outcomes map to:
  - system state changes
  - incident/task status changes
  - events/log entries
  - glitch intensity changes

### Mini-game interface contract (conceptual)
- Inputs:
  - task_id
  - system_state_ids
  - difficulty
  - time_limit
  - modifiers (jamming, low power, etc.)
- Output:
  - result enum
  - score metric (optional)
  - side effects (declared)

### Acceptance checks
- You can plug in a new mini-game without changing the task system.
- Mini-games are optional; tasks still function without them.

---

## Task 0.9 — Threat Posture + ROE Spec (≤30m) (NEW)
### Output
`/docs/spec_posture_roe.md`

### Define
- Posture levels (example):
  - Green / Yellow / Red
  - plus optional: Silent Running, General Quarters
- ROE toggles:
  - weapons safeties
  - comms openness
  - transponder behavior
  - sensor emission profile

### Define effects
- Which widgets change behavior/appearance under posture changes:
  - global tint, alert thresholds, sensor noise, comms encryption prompts, etc.

### Acceptance checks
- Posture is a single source-of-truth state with clearly defined downstream effects.

---

## Task 0.10 — Scenario Rehearsal Spec (≤30m) (NEW)
### Output
`/docs/spec_scenario_rehearsal.md`

### Define
- Rehearsal mode is a **dry-run** that computes:
  - a diff of system_states before/after
  - events that would be emitted
  - tasks/incidents that would spawn
  - alerts that would appear
- No persistence unless “Commit”

### Acceptance checks
- A scenario can be previewed without mutating real gameplay state.

---

## Task 0.11 — Panel Navigation + Cross-Panel Linking Spec (≤30m)

### Output
`/docs/spec_panel_navigation.md`

### Goal
Make “multiple panels per ship” a first-class concept:
- GM can create any number of panels (stations, sub-panels, special scenes).
- Players can navigate between panels via a **diegetic** navigator (not a generic navbar).
- Alerts/events/markers can **deep-link** to the relevant panel (and optionally the specific widget instance).

### Define (explicit decisions)
#### A) Panel identity and organization
- Panel fields that matter to navigation:
  - `panel_id`, `ship_id`, `name`, `role_visibility`
  - `station_group` (e.g., command/engineering/sensors/tactical/life_support/admin)
  - `sort_order` (within station group)
  - `icon_id` (optional, for diegetic UI)
- Rules for grouping:
  - Default: each panel belongs to exactly one `station_group`
  - Optional: tags for cross-cutting (e.g., “emergency”, “briefing”, “maintenance”)

#### B) Navigation UX model (choose one for MVP)

**Station Dial**: rotary selector of station groups + list of panels inside

For MVP, define:
- Where the navigator lives (global chrome vs floating console)
- How it opens/closes
- How it indicates current station/panel
- How it remains subtle during play (auto-hide after selection, minimal footprint)

#### C) “Panel availability” rules
- Role filter:
  - players only see panels with `role_visibility` including player
  - GM sees all
- Optional “station lock”:
  - A player device can be “assigned” a station_group (default off)
  - Assigned devices default to their station panel but can still browse if allowed

#### D) Deep-linking contract (critical)
Define a universal link payload for jumping context:
- `target`: `{ panel_id, widget_instance_id? }`
- `reason`: `"alert" | "event" | "marker" | "system_state" | "task" | "contact"`
- `focus`: optional hint `{ system_state_id?, incident_id?, task_id?, contact_id?, holomap_marker_id? }`

Define where deep-links originate:
- Alert bar (global)
- Timeline events
- Holomap markers
- Sensor contacts
- Transmission console (“view sender dossier”, “jump to sensors panel”)
- Task queue (“open holomap marker”, “open engineering subpanel”)

Define focus behavior:
- Navigating to panel:
  - optionally auto-scroll/pan to widget
  - optionally flash/highlight widget for 2–3 seconds
- If widget missing:
  - fall back to panel highlight or show “target not present” toast (GM-only detail)

#### E) Command panel “overview → detail” convention
Codify the command panel philosophy:
- Overview cards should deep-link to the full station panel. :contentReference[oaicite:2]{index=2}
- Prevent “captain sees everything” unless GM chooses to allow it.

### Edge cases to address
- Panel deleted while clients are on it
- Deep-link to missing/unknown widget instance
- Multiple panels per station group (paging vs list)
- Role changes mid-session (player → GM)
- “Scene panel” temporarily visible (e.g., a distress signal overlay panel)

### Acceptance checks
- Spec contains:
  - navigation UX choice + written interaction flow
  - panel grouping schema
  - deep-link payload contract
  - fallback rules for missing targets
- Includes at least two examples:
  - “Red alert triggered → click alert → jump to Engineering panel, highlight Reactor widget”
  - “Holomap breach marker clicked → jump to Life Support panel, focus Zone Details widget”


---

# Phase 2 — Backend Schema (Expanded)

## Task 2.2 — Schema v1 Migrations (Expanded Entities) (≤30m)
### Add these tables (in addition to earlier core)
- `posture_state` (one row per ship): posture + ROE toggles
- `incidents`
- `tasks`
- `contacts` (NPC dossiers)
- `contact_tags` / `contact_relationships` (optional later)
- `sensor_contacts` (tracks + confidence + IFF)
- `holomap_layers` + `holomap_markers` (deck plan overlays)
- `glitch_state` (global intensity + per-panel overrides)
- `minigame_defs` (catalog) + `task_minigame_links` (bindings)
- `timeline_bookmarks` (ship log bookmarks)

### Acceptance checks
- Every NEW concept is representable in DB without JSON-only handwaving.
- You can query “open tasks for engineering” in one simple query.

---

# Phase 3 — Frontend Shell + Data Plumbing (Expanded)

## Task 3.7 — Panel Index + Diegetic Navigator Component (≤30m) (NEW)

### Goal
Implement the **player-facing** navigation foundation:
- A panel index route for browsing
- A diegetic navigator element present on all player pages (subtle)

### Outputs
- A panel index view (list by station group)
- A global navigator component (dial/buttons)
- Local storage of “last visited panel” per device/session

### Requirements (behavioral)
#### A) Panel index route
- Displays panels grouped by `station_group`
- Shows a short description or icon if present
- Applies role filtering (players don’t see GM-only panels)

#### B) Diegetic navigator (MVP)
- Always accessible, minimal footprint:
  - e.g., a corner “console notch” or “station selector glyph”
- Open state reveals:
  - station groups
  - panels in that group
- Selecting a panel:
  - navigates to `/panel/:id`
  - closes navigator
  - updates “last visited”

#### C) Panel load behavior
- If user hits `/`:
  - auto-redirect to last visited panel if available
  - else pick the first visible panel (by sort order)

#### D) Visual integration constraints
- Must look like ship UI, not a navbar:
  - no hamburger drawer unless it is heavily re-skinned into diegetic form
  - avoid material/admin tropes
- Use consistent status language:
  - navigator may show subtle station-level status indicators (optional later)

### Manual QA checklist
- Open app as player:
  - sees panel list grouped by station
  - can open Engineering, then Sensors, then back
- Refresh browser:
  - returns to last visited panel
- Open navigator on panel page:
  - can switch panels quickly
- GM-only panels do not appear for player

### Acceptance checks
- Navigation does not rely on backend hacks: it uses panels data.
- Switching panels never breaks global alert bar.
- The component is visually “diegetic” in shape and interaction, not generic.

---

## Task 3.8 — Deep-Link Plumbing (Alerts/Events/Widgets → Target Panel) (≤30m) (NEW)

### Goal
Enable cross-panel jumps from global systems and widgets:
- alert bar click → panel focus
- timeline item click → panel focus (if linkable)
- holomap marker click → related panel focus
- transmission sender click → dossier panel focus

### Outputs
- A small “navigateToTarget(payload)” utility and conventions
- Highlight/focus behavior on arrival (flash border, gentle pulse)

### Requirements
- Accepts the deep-link payload defined in Task 0.11
- Handles fallbacks:
  - missing widget_instance_id → just go to panel
  - missing panel → go to panel index and show message
- Supports “focus hint”:
  - if widget not specified but system_state_id is, find the first widget bound to it (GM-only or best-effort)

### Acceptance checks
- Clicking a global alert takes you to a relevant panel reliably.
- Focus highlight is obvious but not obnoxious.

---

# Phase 5 — Widget Framework Additions (Overlays)

## Task 5.6 — Global Glitch Aesthetics Overlay Engine (≤30m) (NEW)
### Goal
A single overlay system that can “corrupt” UI diegetically under stress.

### Behaviors (implement in increasing complexity)
- baseline: subtle scanlines / grain
- severity-based: flicker, chromatic offset, dropped frames, jitter
- targeted: only affects specific panels or widgets (optional later)

### Inputs
- `glitch_state` (global intensity)
- modifiers from posture/incidents (optional)

### Acceptance checks
- Glitch can be toggled off (GM/Accessibility).
- Glitch intensity can be driven by state.

---

## Task 5.7 — Global Mini-Game Launcher Overlay (≤30m) (NEW)
### Goal
Mini-games open as an overlay/modal experience without navigating away.

### Requirements
- Launch from a task card button
- Clear timer + success/fail outcomes
- Writes result back via API

### Acceptance checks
- Mini-game completes and changes task status.
- Overlay doesn’t break panel layout.

---

# Phase 6 — New Widget Additions (Detailed)

## Task 6.11 — Ship Log / Timeline + Bookmarks Widget (≤30m) (NEW)
### Purpose
Readable narrative record + GM bookmarks for story beats.

### Config
- filter (all / alerts / scenario runs / state changes)
- max items
- show timestamps
- bookmark visibility (players may see a subset)

### Runtime
- scrollable list of events
- bookmark markers
- click item → details

### Acceptance checks
- Bookmark creation is possible from admin or from log widget (GM-only).

---

## Task 6.12 — Incoming Transmission Console Widget (≤30m) (NEW)
### Purpose
Comms panel that feels alive: distortion, encryption, retransmit.

### Config
- binding: “active transmission” event stream OR selected transmission id
- display: typewriter effect on/off
- effects: distortion intensity (linked to glitch/jamming)

### Runtime actions (GM-only unless enabled)
- “Request retransmit”
- “Attempt decrypt”
- “Acknowledge / archive”

### Acceptance checks
- GM can push a transmission via scenario/event and players see it.
- Transmission presentation reacts to posture/glitch (optional v2).

---

## Task 6.13 — Sensor Sweep / Contact Tracker Widget (≤30m) (NEW)
### Purpose
Contacts with confidence + IFF ambiguity.

### Config
- show contacts within range threshold
- sort by threat/confidence
- display mode: list vs radar-lite

### Data model expectations
- contacts have: id, label, confidence, IFF, threat, vector/range, notes

### Acceptance checks
- GM can add contacts in admin; players see updates.
- Confidence changes over time is representable (v2: drift).

---

## Task 6.14 — Threat Posture + ROE Widget (≤30m) (NEW)
### Purpose
Command panel “ship stance” (red/yellow alert) with ROE toggles.

### Config
- allowed postures
- which ROE controls visible
- whether players can view only or interact

### Runtime
- prominent posture indicator with global theme tint hook
- toggles update posture_state

### Acceptance checks
- Changing posture updates global chrome (at least tint/label).
- Posture change emits an event + optional alert.

---

## Task 6.15 — Damage Control / Tasks Queue Widget (≤30m) (NEW)
### Purpose
The “Among Us panic layer”: actionable tasks with timers and consequences.

### Config
- station filter
- show only open/active
- max tasks
- show mini-game launch button if attached

### Runtime actions
- claim task (optional)
- start mini-game
- mark as complete (GM override)
- escalate (GM)

### Acceptance checks
- Tasks appear from admin creation and from scenario spawn.
- Timer expiry transitions to failed/expired and emits events.

---

## Task 6.16 — System Dependency Graph Widget (≤30m) (NEW)
### Purpose
Visualize cascades: power → comms → sensors, etc.

### Config
- dependency dataset/graph binding
- layout style (force graph vs fixed)
- show only impacted nodes under current incident (optional v2)

### Runtime
- nodes colored by status
- edges indicate “dependency strength”
- hover shows rationale (“sensors degrade if power < 30%”)

### Acceptance checks
- Graph renders from a stored model; statuses update colors as state changes.

---

## Task 6.17 — Environmental / Habitat Widgets (≤30m) (NEW)
### Purpose
Life support becomes a rich system.

### Recommended decomposition (avoid one giant widget)
- Environment Summary widget (global)
- Zone Details widget (select zone)
- Hazard Alerts widget (radiation, contamination, pressure)

### Data model
- zones: name, pressure, temp, O2/CO2, radiation, contamination
- thresholds for alerts per zone

### Acceptance checks
- You can represent “Hull breach in Bay 2” as zone pressure drop + tasks.

---

## Task 6.18 — Holomap / Deck Plan Widget (≤30m) (NEW)
### Purpose
Spatial stakes. Mark breaches, fires, sealed doors.

### MVP representation
- background image (ship plan)
- overlay markers:
  - type (breach/fire/door/crew)
  - severity
  - linked incident/task

### Acceptance checks
- GM can drop markers; players see them.
- Clicking marker shows details and linked tasks.

---

## Task 6.19 — NPC/Contact Dossier Cards Widget (≤30m) (NEW)
### Purpose
Recall, continuity, and fast GM reference.

### Config
- show by tag (crew, hostile, neutral)
- show “recently contacted” first
- show threat/affiliation fields

### Acceptance checks
- Creating/updating a contact reflects immediately.
- Transmission can reference a contact and link to dossier (v2).

---

# Phase 7 — Admin Authoring Additions (Detailed)

## Task 7.10 — Scenario Rehearsal + Diff Viewer (≤30m) (NEW)
### Purpose
GM previews consequences before committing.

### UI requirements
- “Rehearse” button on scenario
- shows:
  - state diff list (before/after)
  - tasks/incidents that would spawn
  - alerts/events to be emitted

### Acceptance checks
- Rehearsal does not mutate DB.
- “Commit” applies same computed plan deterministically.

---

## Task 7.11 — Mini-Game Catalog + Attachment UI (≤30m) (NEW)
### Purpose
GM assigns mini-games to task templates and/or specific tasks.

### UI requirements
- list available mini-games with:
  - name, station, difficulty range, description
- attach mini-game to:
  - a task template
  - or a specific task instance

### Acceptance checks
- A task shows “Start Mini-Game” only when attached.

---

# Phase 8 — Incidents + Mini-Games (Execution)

## Task 8.5 — Incidents → Tasks Auto-Spawn Rules (≤30m) (NEW)
### Goal
System changes produce actionable tasks without GM micromanagement.

### Rule examples (define as data, not code-only)
- If a zone pressure drops below threshold → spawn “Seal breach” task
- If power bus below 25% → spawn “Reroute power” task
- If comms compromised → spawn “Align antenna” task

### Acceptance checks
- At least 2 auto-spawn rules work end-to-end.

---

## Task 8.6 — Mini-Game Outcomes → State Changes (≤30m) (NEW)
### Goal
Mini-games materially matter.

### MVP outcome mapping
- success: task succeeded + stabilize system (+value, or status improvement)
- partial: task succeeded but leaves degraded
- fail: task failed + worsen system / spawn new incident

### Acceptance checks
- One mini-game can:
  - resolve a task
  - update a system state
  - emit an event
  - adjust glitch intensity

---

## Task 8.7 — GM Rehearsal Run Mode (No-Commit) (≤30m) (NEW)
### Goal
Rehearse scenarios + mini-game consequences.

### Acceptance checks
- Dry-run works for:
  - state changes
  - task spawns
  - alert emissions

---

# Mini-Games (MVP Set Inspired by Among Us)

These are intentionally **short**, **repeatable**, and **station-themed**.
Pick 2–3 first; build the framework; add more later.

## Mini-Game A — “Wire Reroute” (Engineering)
- Gameplay: connect matching nodes under time pressure; occasional false wires when jammed.
- Use cases: restore power bus, stabilize reactor output.
- Failure consequences: power flicker increases glitch; may spawn “breaker trip” task.

## Mini-Game B — “Signal Tuning” (Sensors/Comms)
- Gameplay: align frequency/phase; moving target; noise increases under red alert.
- Use cases: decrypt transmission, improve contact confidence, restore comms.
- Failure: contact confidence drops; “lost lock” event.

## Mini-Game C — “Coolant Balancing” (Engineering)
- Gameplay: keep two gauges in range by toggling valves; periodic surges.
- Use cases: stop overheating; prevent engine shutdown.
- Failure: engine status degrades; may force posture change suggestion.

## Mini-Game D — “Pressure Seal” (Life Support)
- Gameplay: patch leaks on a schematic; leaks spawn; must prioritize.
- Use cases: hull breach response, zone stabilization.
- Failure: zone pressure continues to drop; crew condition degrades (v2).

---

# Updated Seed Ship Spec (Additions)

When you update the seed ship (Task 0.6 / 2.10), include:
- Command panel:
  - Threat posture + ROE widget
  - Ship log widget
  - Alert feed widget
  - “System overview” health summaries
- Engineering:
  - Health widgets (power/engines/fuel)
  - Damage control tasks queue
  - Mini-game launcher accessible
- Sensors/Comms:
  - Sensor contact tracker
  - Incoming transmission console
- Life Support:
  - Environment summary
  - Zone details
- Tactical:
  - Weapons/assets widget
- Holomap panel (optional):
  - deck plan with incident overlays
- GM/Admin:
  - Scenario rehearsal and diff viewer
  - Contacts/dossiers manager

---

# Suggested “Next 12 Tasks” (High Leverage)

1. 0.7 Incident/task lifecycle spec  
2. 0.8 Mini-game contract spec  
3. 0.9 Posture/ROE spec  
4. 0.10 Scenario rehearsal spec  
5. 2.2 Schema expansion for tasks/incidents/posture/contacts/holomap  
6. 2.7 Events feed + bookmarks table  
7. 5.7 Mini-game launcher overlay (framework)  
8. 6.15 Tasks queue widget  
9. 6.12 Transmission console widget  
10. 6.14 Threat posture + ROE widget  
11. 6.18 Holomap widget (image + markers)  
12. 7.10 Scenario rehearsal + diff viewer  

---
