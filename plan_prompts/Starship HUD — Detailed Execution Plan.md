# Starship HUD — Detailed Execution Plan (Widget-Driven Panels + GM Control)

> This is a **build-execution** document: concrete steps, artifacts, acceptance criteria, and implementation notes.  
> It assumes: React frontend, FastAPI backend, SQLite, Docker/Compose, and a **macOS/iOS-widget-like edit mode** where the GM/admin can add/configure/move widgets on panels.  
> Source concept: modular widgets, multiple panels, status/health systems, scenarios, alerts, immersive boot/animations, and an admin “DB-like” control plane.

---

## Master Checklist (Progress Tracker)

### Phase 0 — Decisions & Contracts
- [ ] Confirm “source of truth” and sync approach (push vs poll)
- [ ] Freeze canonical status model and threshold rules
- [ ] Freeze widget contract (type registry + config schema + data deps)
- [ ] Freeze panel/layout contract (positioning, resizing, collisions)
- [ ] Define permissions model (GM vs player vs optional station roles)

### Phase 1 — Repo / Tooling / Deployment Scaffolding
- [ ] Monorepo or split repo decision (frontend/backend)
- [ ] Dev environment (direnv + nix)
- [ ] Python deps via uv
- [ ] justfile commands (dev, test, lint, docker, migrate)
- [ ] Dockerfile + compose + env template

### Phase 2 — Backend: Schema + API Skeleton
- [ ] SQLite schema v1 (migrations)
- [ ] Core entities CRUD endpoints
- [ ] Panel snapshot endpoint
- [ ] State mutation endpoint(s)
- [ ] Event/logging endpoint(s)

### Phase 3 — Frontend: Shell + Routing + State Plumbing
- [ ] Routes: player panel view(s) + admin
- [ ] App chrome (global alert bar, subtle nav)
- [ ] Data fetching layer (query cache + invalidation)
- [ ] Auth/roles gates (even if “simple local” first)

### Phase 4 — Layout Engine + Edit Mode
- [ ] Panel canvas renderer
- [ ] Edit mode interactions (add/move/resize/config/delete)
- [ ] Collision + snapping behavior
- [ ] Layout persistence
- [ ] Keyboard accessibility basics

### Phase 5 — Widget Framework
- [ ] Widget registry
- [ ] Widget instance renderer (type → component)
- [ ] Widget config modal framework
- [ ] Widget data binding contract (deps → data fetch)
- [ ] Widget-level permission gating

### Phase 6 — Core Widgets (MVP Set)
- [ ] Organizational widgets: Title, Divider, Spacer, Section Header
- [ ] Direct Status widget
- [ ] Health/Progress widget
- [ ] Table widget
- [ ] Weapons/Assets widget
- [ ] Informational widget (text + image/animation)

### Phase 7 — GM/Admin “DB-Like” Control Plane
- [ ] Generic table viewer (per entity)
- [ ] Inline editing + create/delete flows
- [ ] Panel management UI
- [ ] Widget type catalog UI
- [ ] Bulk ship reset controls

### Phase 8 — Scenarios + Global Events + Alerts
- [ ] Scenario model (ordered actions)
- [ ] Scenario authoring UI
- [ ] Scenario execution + atomic apply
- [ ] Alert generation rules
- [ ] Alert feed widget + global alert bar

### Phase 9 — Immersion Layer
- [ ] Boot sequence (animation + audio hooks)
- [ ] Status transition animation semantics
- [ ] Ambient UI “texture” animations
- [ ] Sound triggers per scenario/alert (optional at MVP)

### Phase 10 — Hardening + Deployment
- [ ] Persisted storage volumes
- [ ] Backups/export (JSON export of ship config)
- [ ] Role-safe default config
- [ ] Smoke tests
- [ ] Unraid deployment doc

---

# Phase 0 — Decisions & Contracts (Pedantic and Load-Bearing)

## 0.1 Define the Canonical Status Model

### Goal
Make “status” a universal language across backend, widgets, scenarios, alerts with consistent color palette.

### Canonical statuses
- `operational`
- `degraded`
- `compromised`
- `critical`
- `destroyed`
- `offline`

### Rules to decide now (write into README/spec)
1. **Terminal states:** decide whether `destroyed` and/or `offline` are terminal until GM reset.
2. **Precedence:** if a system has both a derived status (from health) and a direct override, which wins?
3. **Visibility:** does the player UI show the raw health number, the derived status, or both?
4. **Alert mapping:** which statuses trigger global alerts and at what severity?

### Acceptance Criteria
- A single page spec exists describing transitions and precedence.
- Every widget uses the same enum values (no synonyms).

---

## 0.2 Freeze the Layout Model (Grid vs Freeform)

### Goal
Prevent endless rework once drag/resize ships.

### Decision options (pick one explicitly)
- **Constrained grid:** widgets occupy grid cells; resizing changes span.
- **Freeform with snapping:** widgets store x/y/w/h; snapping to grid/lines.
- **Hybrid:** freeform but with section containers.

### Recommended MVP
**Freeform with snapping** (feels “widget-like” and gives design freedom).

### Layout data contract (define fields)
- `x, y, w, h` in **panel coordinate space**
- `z_index` optional
- `min_w/min_h` per widget type
- `locked` flag (for decorative elements, optional)

### Collision policy (choose)
- No-overlap enforcement (auto-push)
- Soft overlap allowed (z-index)
- “Snap-away” on drop

### Acceptance Criteria
- One doc defines coordinates, snapping, and collision.
- A single JSON example of a panel layout exists.

---

## 0.3 Widget Contract + Registry (The Most Important Abstraction)

### Goal
Make widgets modular and composable; future widget additions don’t touch panel code.

### Widget Type Contract (define in prose)
Each widget type must provide:
- `type_id`: stable unique string
- `display_name`
- `description` (for the creation modal catalog)
- `config_schema`: formal definition of config fields and defaults
- `data_dependencies`: what backend data it needs (table name, system state id, etc.)
- `render(view_mode)`: renders live view
- `render_editor()`: renders config UI

### Widget Instance Contract
Each placed widget instance stores:
- `widget_instance_id`
- `widget_type_id`
- `panel_id`
- `layout` (x/y/w/h)
- `config` (JSON)
- `bindings` (references to system state ids / tables / queries)

### Acceptance Criteria
- One document describes widget contract + instance contract.
- A “widget catalog” list exists with each type’s config fields.

---

## 0.4 Permissions and Modes

### Goal
Avoid accidental player mutation and keep GM power centralized.

### Roles (MVP)
- **GM/Admin:** full CRUD + scenario triggers
- **Player:** read-only by default; optional “station controls” later

### Modes
- **Edit Mode:** layout + config changes enabled
- **Run Mode:** layout locked; only allowed interactions enabled

### Acceptance Criteria
- A spec defines which role can do what.
- Edit mode has a visible, unmistakable UI state.

---

## 0.5 Sync Model (State Updates Across Devices)

### Goal
Ensure all clients see consistent state.

### Options
- **Polling:** simplest; acceptable for LAN play; periodic refresh.
- **WebSocket:** best UX; more complexity; worth it if you want instant alerts.
- **SSE:** simpler than WS; server-to-client only.

### Recommended path
- MVP: **Polling** for state + event feed
- Next: upgrade to **WebSocket** for near real-time

### Acceptance Criteria
- Document refresh cadence and expected latency.
- Define event ordering expectations (especially for scenarios).

---

# Phase 1 — Repo, Tooling, and Packaging

## 1.1 Repository Structure

### Goal
Keep dev velocity high and deployment easy.

### Recommended structure
- `/frontend` React app
- `/backend` FastAPI app
- `/infra` docker/compose/env templates
- `/docs` specs + screenshots + style references

### Acceptance Criteria
- A clean top-level README describing how to run dev mode.

---

## 1.2 Dev Tooling Setup

### Goal
One-command dev startup.

### Deliverables
- `direnv` + `nix` shell definition
- `uv` project config for backend
- `justfile` tasks:
  - `just dev` (runs both)
  - `just dev-frontend`
  - `just dev-backend`
  - `just test`
  - `just fmt`
  - `just lint`
  - `just docker-build`
  - `just docker-up`

### Acceptance Criteria
- New machine: run `direnv allow`, then `just dev`.

---

## 1.3 Dockerization Plan

### Goal
Deploy to Unraid via Docker Compose.

### Deliverables
- Backend Dockerfile
- Frontend Dockerfile (or served by backend)
- Compose file:
  - backend service
  - frontend service (optional)
  - volume for sqlite DB
- `.env.example`

### Acceptance Criteria
- `docker compose up` brings up the full app with persistence.

---

# Phase 2 — Backend: Schema + API Skeleton

## 2.1 Schema v1 (SQLite)

### Goal
Store panels, widgets, state, scenarios, and logs in a way that’s easy to inspect (pgadmin/dbeaver vibe).

### Tables (detailed intent + fields)

#### `ships`
- Purpose: supports future multiple ships/campaigns
- Fields:
  - `id`
  - `name`
  - `created_at`, `updated_at`
  - `active_panel_id` (optional)

#### `panels`
- Purpose: named screens composed of widget instances
- Fields:
  - `id`
  - `ship_id`
  - `name`
  - `role_visibility` (JSON list: e.g. `["player", "gm"]`)
  - `theme` (optional)
  - `created_at`, `updated_at`

#### `widget_instances`
- Purpose: a placed widget with layout + config
- Fields:
  - `id`
  - `panel_id`
  - `widget_type_id`
  - `layout_json` (x/y/w/h + flags)
  - `config_json`
  - `bindings_json` (references to system states / tables)
  - `created_at`, `updated_at`

#### `system_states`
- Purpose: canonical data representing ship systems
- Fields:
  - `id`
  - `ship_id`
  - `name` (e.g. “Port Shields”)
  - `state_type` (`direct` or `health`)
  - `status` (enum)
  - `value_current` (nullable)
  - `value_min/value_max` (nullable)
  - `thresholds_json` (nullable)
  - `metadata_json` (optional extra fields: units, notes)
  - `created_at`, `updated_at`

#### `scenarios`
- Purpose: GM macros
- Fields:
  - `id`
  - `ship_id`
  - `name`
  - `description`
  - `created_at`, `updated_at`

#### `scenario_actions`
- Purpose: ordered steps applied when scenario runs
- Fields:
  - `id`
  - `scenario_id`
  - `order_index`
  - `action_type` (set_status, set_value, add_event, etc.)
  - `payload_json` (target ids + values)
  - `created_at`

#### `events`
- Purpose: audit + playback + alerts
- Fields:
  - `id`
  - `ship_id`
  - `event_type` (status_change, scenario_run, alert, note)
  - `severity` (info/warn/critical)
  - `payload_json`
  - `created_at`

### Acceptance Criteria
- You can answer: “What widgets are on Engineering panel?” via DB.
- You can answer: “What changed during the last scenario?” via events.

---

## 2.2 API Design (Endpoints + semantics)

### Read endpoints
- List panels for a ship
- Get panel details + widget instances
- Get system states (bulk)
- Get recent events (paged)

### Write endpoints
- Update system state (direct status or health value)
- Save widget instance layout
- Save widget instance config/bindings
- Create/delete widget instances
- Trigger scenario

### Admin endpoints
- CRUD for all entities (ships/panels/states/scenarios/actions)

### Acceptance Criteria
- Frontend can fully render a panel from one “panel snapshot” response plus state bulk fetch.
- Scenario trigger produces events and state updates atomically.

---

## 2.3 Validation Rules (Server-Side)

### Goal
Prevent impossible states.

Rules to implement (spec first)
- Health-based systems compute derived status from thresholds unless overridden.
- Value bounds enforced (min/max).
- Thresholds validated on creation/update (no overlaps, covers full range if required).
- Terminal statuses require explicit reset path.

### Acceptance Criteria
- Invalid configs are rejected with actionable error messages.

---

# Phase 3 — Frontend: Shell, Routing, Data Plumbing

## 3.1 Routes + Page Roles

### Pages
- **Player Panel View:** renders a single panel
- **Panel Index:** list of available panels (role-filtered)
- **Admin:** DB-like UI

### Acceptance Criteria
- A player can open `/panel/:id` and see the intended station view.

---

## 3.2 App Chrome + Global Systems

### Always-present UI layers
- Global alert bar (top, subtle but visible)
- Ambient background “ship texture” animation layer
- Optional audio manager (muted by default)

### Acceptance Criteria
- Alerts visible regardless of panel route.

---

## 3.3 Data Fetching Strategy

### Goals
- No spaghetti refetch logic
- Predictable caching
- Offline-ish tolerance for a LAN party environment

### Approach
- Central query layer that:
  - Fetches panel snapshot
  - Fetches system states in bulk (per ship)
  - Fetches events feed
- Refetch policy:
  - Poll events + states at a fixed interval (MVP)
  - Invalidate panel snapshot only when edit operations occur

### Acceptance Criteria
- You can open multiple clients and they converge on same state.

---

## 3.4 Edit Mode UX (Top-Level)

### Entry/Exit
- GM toggles edit mode via a clear “Edit HUD” control.
- Visual cue: panel shows draggable outlines, handles, grid overlay.

### Guardrails
- Confirm on leaving edit mode if dirty
- “Undo last move” (MVP optional, but recommended)
- “Reset widget to default size” control

### Acceptance Criteria
- A player cannot enter edit mode by accident.

---

# Phase 4 — Layout Engine + Edit Interactions

## 4.1 Canvas Model

### Goals
- Widgets behave like system “modules” on a screen
- Composition supports narrative styling

### Required behaviors
- Drag widget by header/handle
- Resize with corners
- Snap-to-grid or snap-to-guides
- Option to “lock” a widget (non-movable)

### Acceptance Criteria
- A GM can design a panel without fighting the UI.

---

## 4.2 Collision & Snapping Policy

### Specify and implement
- Snap grid size (e.g. 8px/16px conceptually)
- Minimum spacing between widgets (optional)
- Collision resolution:
  - Prefer no overlap in MVP (predictable)
  - Later allow overlap with z-order for “holo overlays”

### Acceptance Criteria
- Dropping widgets doesn’t cause chaotic rearrangement.

---

## 4.3 Layout Persistence

### Behavior
- Layout changes save as “draft” while editing
- Explicit “Save Layout” button commits
- “Discard Changes” resets to last saved

### Acceptance Criteria
- Refreshing the page does not lose committed layout.

---

# Phase 5 — Widget Framework (Core Infrastructure)

## 5.1 Widget Registry + Catalog UI

### Goals
- Add new widget types without editing panel renderer logic
- Creation modal lists all types and shows previews/description

### Required functionality
- Registry mapping: `type_id -> {component, editor, schema}`
- Catalog displays:
  - name
  - description
  - typical use
  - required bindings

### Acceptance Criteria
- Adding a widget type requires only:
  1) implementing the widget
  2) registering it

---

## 5.2 Widget Instance Rendering Contract

### Runtime
- Panel renderer reads widget_instances
- For each instance:
  - loads type renderer
  - injects config + data
  - applies status decoration rules (border color, glow)

### Failure modes
- Unknown widget type: show “Missing Widget” placeholder
- Invalid config: show “Config Error” with details (admin-visible)
- Missing bindings: show “Unbound” placeholder (admin-visible)

### Acceptance Criteria
- Misconfiguration never crashes the whole panel.

---

## 5.3 Config Modal Framework

### Goals
- Consistent admin editing experience across widget types

### Modal must support
- Schema-driven forms (even if hand-built first)
- Live preview (optional)
- Validation errors inline
- Binding selectors (choose system state/table, etc.)

### Acceptance Criteria
- Every widget config is editable from the same interaction pattern.

---

# Phase 6 — Core Widgets (Detailed Implementation Tasks)

> Build in an order that validates layout and state plumbing early.

## 6.1 Organizational Widgets (Build First)

### 6.1.1 Title Widget
- Config: text, alignment, optional icon, style variant
- Runtime: static display
- Role: create “sections” and give panels character

### 6.1.2 Divider Widget
- Config: style (line, segmented, glow), thickness, orientation
- Runtime: static

### 6.1.3 Spacer Widget
- Config: none or size presets
- Runtime: static

### 6.1.4 Section Header Widget
- Config: title + optional subtitle + severity tint (optional)
- Runtime: static

**Acceptance Criteria**
- A GM can create a panel layout that looks intentional before any system logic exists.

---

## 6.2 Direct Status Widget

### Purpose
Show and optionally set a system’s discrete status (life support, comms, etc.).

### Config fields
- Title
- Bound `system_state_id`
- Display variant (compact vs detailed)
- Player interaction allowed? (default false)

### Runtime behavior
- Shows status label + iconography
- Shows border/glow color by status
- Optional subtext (from metadata or last event)

### Admin interactions
- In admin: dropdown to set status quickly
- In player: read-only unless enabled

**Acceptance Criteria**
- Updating status in one client updates all clients after refresh interval.

---

## 6.3 Health / Progress Widget

### Purpose
Shields, hull, fuel, power, etc.

### Config fields
- Title
- Bound `system_state_id`
- Display: number, percent, both
- Units (optional)
- Threshold display (optional markers)

### Backend linkage
- `value_current`, `min/max`, `thresholds_json`
- Derived status computed consistently

### Runtime behavior
- Animated fill transitions on change
- Border/glow by derived status
- Option to show “critical” pulse behavior

### Admin interactions
- Control to increment/decrement by step
- Direct edit numeric

**Acceptance Criteria**
- Changing value triggers derived status changes deterministically.

---

## 6.4 Table Widget

### Purpose
Cargo manifest, crew list, etc.

### Config fields
- Data source identifier (choose table/view)
- Visible columns
- Sort column + direction
- Row highlight rules (optional)

### Backend model options (pick one)
- Generic “data tables” API (admin-defined)
- Hardcoded tables per concept (cargo/crew)

### MVP recommendation
Start with **a generic JSON “table feed”** per named dataset, stored in DB as rows, to avoid building a full query builder early.

### Runtime behavior
- Compact sci-fi table styling
- Row hover highlights
- Status color integration (if column includes status)

**Acceptance Criteria**
- GM can add a “Crew” dataset and bind a table widget to it.

---

## 6.5 Weapons / Assets Widget

### Purpose
Weapons, drones, probes: discrete assets with readiness and stats.

### Config fields
- Title
- Asset list binding (dataset id)
- Display mode (list vs cards)
- Show ammo/cooldown/range toggles

### Data model (MVP)
- Store asset entries in a dataset table (like crew/cargo)
- Each asset row includes:
  - name
  - type
  - status
  - ammo
  - cooldown
  - range
  - notes

### Runtime behavior
- Status decoration per asset
- Optional “expanded details” drawer

**Acceptance Criteria**
- GM can mark “Torpedo Tubes” as degraded and players see it.

---

## 6.6 Informational Widget

### Purpose
Lore text, images, animated gifs, “incoming transmission” panels.

### Config fields
- Title (optional)
- Content type: text / image / animation
- Source: inline text or URL/path
- Loop behavior

### Runtime behavior
- Styled presentation, diegetic borders
- Optional “typewriter” animation for transmissions

**Acceptance Criteria**
- GM can trigger a scenario that changes the content (via state/event).

---

# Phase 7 — Admin / GM Control Plane (DB-Like)

## 7.1 Admin Navigation Structure

### Tabs/Sections
- Ships
- Panels
- Widget Instances
- System States
- Datasets (crew/cargo/assets)
- Scenarios
- Events/Logs

**Acceptance Criteria**
- GM can find anything within 2 clicks.

---

## 7.2 Generic Table Viewer

### Requirements
- Column view
- Sorting
- Filtering (simple string match MVP)
- Row click → edit form
- Create new row

**Acceptance Criteria**
- “Feels like pgAdmin lite” even if visually themed.

---

## 7.3 Panel Builder UI

### Requirements
- Panel list with create/delete
- “Open panel in edit mode”
- Drag widgets on canvas
- Add widget modal with catalog
- Save/discard layout

**Acceptance Criteria**
- GM can assemble a full station screen with no manual DB edits.

---

## 7.4 Ship Controls

### Buttons
- Reset all systems to operational + full values
- Set all to offline (for “boot up” sessions)
- Export/import ship config (Phase 10/Hardening)

**Acceptance Criteria**
- GM can reliably recover from chaos mid-session.

---

# Phase 8 — Scenarios + Alerts + Event System

## 8.1 Event Log (Always On)

### Goal
Make state changes auditable, replayable, and usable for UI/alerts.

### Event types
- `state_change`
- `scenario_run`
- `alert`
- `note`

### Payload contents (spec)
- who/what initiated (gm, scenario)
- before/after (for state_change)
- related entity ids
- severity

**Acceptance Criteria**
- “Recent events” feed can drive UI without extra plumbing.

---

## 8.2 Scenario Model

### A scenario contains
- Name + description
- Ordered actions
- Optional audiovisual cues
- Optional “duration” for staged effects (future)

### Action types (MVP)
- Set direct status
- Set health value
- Insert alert event
- Insert note/transmission event

**Acceptance Criteria**
- Triggering scenario produces:
  - state updates
  - events
  - alerts if applicable

---

## 8.3 Alerts

### Global alert bar behavior
- Shows latest critical/warn alerts
- Click navigates to relevant panel/system (if linkable)
- Auto-fades info-level alerts; critical persists until acknowledged (GM)

### Alert generation
- Either explicit from scenarios
- Or derived from status transitions (e.g., entering `critical`)

**Acceptance Criteria**
- Players immediately notice meaningful changes.

---

## 8.4 Alert Feed Widget (Recommended)

### Purpose
Local “ship log” on command panel.

### Config
- Filter by severity
- Max items
- Show timestamps

**Acceptance Criteria**
- Command panel can act as “bridge overview” without detailed system screens.

---

# Phase 9 — Immersion Layer

## 9.1 Boot Sequence

### Requirements
- A startup animation that runs on first load (per session)
- Optional audio cue
- Progressive “systems online” feel

### Implementation spec (in prose)
- Stage 1: logo + “establishing link”
- Stage 2: scanlines + panel UI fades in
- Stage 3: widgets appear in waves
- Stage 4: status settles (green → current)

**Acceptance Criteria**
- Players get a “ship is alive” first impression.

---

## 9.2 Animation Semantics (Status → Motion)

Define rules:
- operational: stable glow
- degraded: mild flicker
- compromised: intermittent glitches
- critical: pulsing + audible cue optional
- destroyed: dim + static noise (inert)
- offline: muted, gray, no motion

**Acceptance Criteria**
- Status is perceivable even in peripheral vision.

---

## 9.3 Diegetic Navigation

### Requirements
- Avoid generic navbars
- Use subtle “ship console” affordances:
  - station selector as a “console dial”
  - command panel as “bridge map”

**Acceptance Criteria**
- UI doesn’t look like Grafana.

---

# Phase 10 — Hardening + Deployment

## 10.1 Persistence & Backup

### Requirements
- SQLite volume mounted persistently
- Admin export to JSON (ship + panels + widgets + states + scenarios + datasets)
- Import applies id remapping safely (future if needed)

**Acceptance Criteria**
- GM can migrate configs between machines.

---

## 10.2 Default Content / Seed Data

### Provide a seed “starter ship”
- Panels: Command, Engineering, Tactical, Sensors, Life Support, Admin
- Systems: shields/hull/power/engines/comms/life support
- Example scenario: “Engine Failure”
- Example dataset: crew list

**Acceptance Criteria**
- Fresh install demonstrates value immediately.

---

## 10.3 Unraid Deployment Notes

### Deliverables
- Compose file includes:
  - port mapping
  - volume mapping
  - env variables documented
- A short “Deploy on Unraid” doc:
  - where to mount volumes
  - how to update image
  - how to backup DB

**Acceptance Criteria**
- You can redeploy without losing data.

---

# Execution Order (Recommended)

1. Phase 0 contracts/specs (write docs first)
2. Backend schema + CRUD + state update + events
3. Frontend shell + panel renderer (static placeholders)
4. Layout engine + edit mode (organizational widgets only)
5. Widget registry + config modal framework
6. Direct status + health widgets
7. Admin CRUD tables + panel builder polish
8. Scenarios + alerts + event feed
9. Table/dataset system + weapons/assets widget
10. Immersion boot + animations + sound hooks
11. Docker/compose hardening + seed content + docs

---

# “Claude Code” Prompting Strategy (How to Iterate)

For each phase, do this loop:
- Provide Claude the **phase subsection** from this plan
- Require:
  - files created/changed list
  - tests or smoke steps
  - manual QA checklist for that section
- Do not proceed until the phase exit criteria are met.

---

# Appendices

## A. Initial Widget Catalog (MVP)

- Organizational:
  - Title
  - Divider
  - Spacer
  - Section Header
- System:
  - Direct Status
  - Health/Progress
  - Table
  - Weapons/Assets
  - Informational
- Recommended soon-after:
  - Alert Feed
  - Transmission/Comms panel widget
  - Power distribution matrix

## B. Minimum Viable Panels

- Command: summaries + alert feed + nav
- Engineering: engines/power/fuel + logs
- Tactical: weapons/assets + hull status
- Sensors: radar/scan + comms status
- Life Support: direct status + environmental
- Admin: db-like CRUD + scenario triggers

---
