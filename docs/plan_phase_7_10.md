# Phase 7-10 Implementation Plan

**Status**: Ready to begin
**Prerequisites**: Phases 0-6 complete (specs, core backend, core widgets)
**Target**: Production-ready GM authoring tools, dynamic gameplay systems, and immersion polish

---

## Overview

This plan combines the remaining development phases with detailed task breakdowns from the supplemental plan. All foundational specs are complete; this focuses on **implementation and polish**.

### Completed Foundation (Phases 0-6)
✅ All core specifications (11 specs)
✅ Backend schema and API endpoints (20 tables, 50+ endpoints)
✅ Frontend shell with data plumbing
✅ Panel layout editing system
✅ Widget framework and overlays
✅ Core widgets (7 implemented)

### Remaining Work (Phases 7-10)
- Phase 7: Admin UI + Authoring Tools (7 tasks including **Ship's Log/Black Box Viewer**)
- Phase 8: Scenarios + Incidents Workflow (4 tasks including **Enhanced Event Feed with User Attribution**)
- Phase 9: Immersion Polish (4 tasks)
- Phase 10: Production Deployment (4 tasks)

### Key New Feature: Ship's Black Box Logging System
A comprehensive event logging system that tracks **who did what, when, where, and why**:
- **2500 event circular buffer** (configurable retention limit)
- **User attribution** for all actions (player/role/station tracking)
- **GM investigation tools** (advanced filtering, export, timeline view)
- **Mystery gameplay support** (player-visible vs GM-only events)
- **Audit trail** for debugging and post-session recaps

---

## Phase 7: Admin UI + Authoring Tools

**Goal**: Give GMs powerful, intuitive authoring tools for creating dynamic scenarios, managing NPCs, and configuring ship systems.

### 7.1 Contacts/Dossiers Manager

**Objective**: CRUD interface for managing NPC contacts and sensor readings.

**Outputs**:
- `/frontend/src/pages/admin/ContactsManager.tsx`
- `/frontend/src/components/admin/ContactForm.tsx`
- `/frontend/src/components/admin/ContactCard.tsx`

**Features**:
- List view with search/filter by faction, type, threat level
- Create/edit/delete contacts
- Form fields:
  - name, faction, type (ship/station/debris/anomaly)
  - threat_level (neutral/cautious/hostile/friendly)
  - description, notes
  - associated sensor_contact IDs
- Inline preview of how contact appears in player widgets
- Bulk import/export (JSON)

**Acceptance Checks**:
- [ ] Can create contact with all fields
- [ ] Search filters by name, faction, type
- [ ] Delete prompts for confirmation
- [ ] Shows count of linked sensor contacts

---

### 7.2 Dataset Editor

**Objective**: Generic table editor for data-driven widgets (crew rosters, cargo manifests, etc.)

**Outputs**:
- `/frontend/src/pages/admin/DatasetEditor.tsx`
- `/frontend/src/components/admin/DataTable.tsx`
- `/frontend/src/components/admin/DataRow.tsx`

**Features**:
- List all datasets (from `datasets` table)
- Create/edit/delete datasets
- Schema definition:
  - column names
  - column types (text/number/enum)
  - validation rules (optional)
- Row-level CRUD with inline editing
- Import/export CSV or JSON
- Preview widget using dataset

**Acceptance Checks**:
- [ ] Can define schema with 3+ column types
- [ ] Can add/edit/delete rows
- [ ] Export produces valid JSON
- [ ] Import validates against schema

---

### 7.3 Scenario Authoring UI

**Objective**: Visual editor for creating and editing scenarios with state changes, incidents, and tasks.

**Outputs**:
- `/frontend/src/pages/admin/ScenarioEditor.tsx`
- `/frontend/src/components/admin/ScenarioForm.tsx`
- `/frontend/src/components/admin/ActionBuilder.tsx`

**Features**:
- List scenarios with tags/categories
- Create/edit scenario metadata (name, description, tags)
- Action builder for each scenario:
  - Add system state changes (dropdown → target value)
  - Add incident spawns (title, severity, affected systems)
  - Add task spawns (linked to incident, time limit, mini-game)
  - Add events/alerts (custom messages)
  - Add holomap marker changes
  - Set glitch intensity
- Action ordering (drag to reorder)
- Validation warnings (e.g., setting destroyed system as operational)
- Duplicate scenario
- Archive/delete

**Acceptance Checks**:
- [ ] Can create scenario with 3+ action types
- [ ] Action reordering works
- [ ] Validation warns on impossible state transitions
- [ ] Can duplicate existing scenario
- [ ] Delete prompts for confirmation

---

### 7.4 Scenario Rehearsal + Diff Viewer

**Objective**: Let GM preview scenario outcomes before committing (dry-run with detailed diff).

**Outputs**:
- `/frontend/src/pages/admin/ScenarioRehearsal.tsx`
- `/frontend/src/components/admin/RehearsalDiff.tsx`
- `/docs/spec_admin_rehearsal_ui.md` (if not exists)

**Features**:
- "Rehearse" button on scenario detail page
- Diff viewer sections:
  1. **System State Changes**: before → after with color coding
  2. **Incidents/Tasks Spawned**: count, severity, affected systems
  3. **Events/Alerts Emitted**: messages, severity, timestamps
  4. **Holomap Changes**: markers added/moved/removed
  5. **Glitch Intensity**: before → after
- Diff uses computed plan ID (deterministic)
- "Commit" button applies the rehearsed plan
- "Re-rehearse" if ship state changed
- Clear indication that rehearsal is read-only

**Backend Requirements**:
- `POST /api/scenarios/{id}/rehearse` → returns diff object
- `POST /api/scenarios/{id}/commit` → applies diff (uses same logic)

**Acceptance Checks**:
- [ ] Rehearsal shows all 5 diff sections
- [ ] Before/after values clearly highlighted
- [ ] Commit applies exact rehearsed changes
- [ ] Re-rehearse updates diff after state change
- [ ] No side effects during rehearsal

**Spec Requirements** (from supplemental plan):
- Defines determinism contract: rehearsal diff must match commit outcome
- Defines how time-dependent actions are handled (timers start at commit)
- Diff model includes state changes, new objects, events, markers

---

### 7.5 Incident/Task Template Editor

**Objective**: Reusable templates for common incident/task patterns.

**Outputs**:
- `/frontend/src/pages/admin/TemplateEditor.tsx`
- `/frontend/src/components/admin/TemplateForm.tsx`

**Features**:
- List incident templates (e.g., "Coolant Leak", "Hull Breach", "Sensor Malfunction")
- Create/edit templates:
  - Title pattern (with variables like `{system_name}`)
  - Severity
  - Affected system(s)
  - Auto-spawn tasks (linked)
  - Consequences/rewards payload
- Task template fields:
  - Title pattern
  - Time limit
  - Required mini-game (optional)
  - Success/failure consequences
  - Station filter
- Spawn template from admin panel (quick incident creation)

**Acceptance Checks**:
- [ ] Can create incident template with 2+ tasks
- [ ] Variable substitution works in titles
- [ ] Spawning template creates incident + tasks
- [ ] Templates filterable by severity/system

---

### 7.6 Holomap Layer/Marker Editor

**Objective**: GM can add/edit/remove deck plans and markers.

**Outputs**:
- `/frontend/src/pages/admin/HolomapEditor.tsx`
- `/frontend/src/components/admin/MarkerPlacer.tsx`

**Features**:
- Layer management:
  - Upload deck plan image
  - Set layer name (e.g., "Deck 1", "Engineering")
  - Set active/visible
- Marker editor:
  - Click to place marker on deck plan
  - Marker types: breach/fire/door/crew/anomaly/task
  - Severity slider
  - Link to incident/task (optional)
  - Label text
  - Normalized coordinates (0-1 range)
- Move/delete markers
- Preview mode (how players see it)

**Acceptance Checks**:
- [ ] Can upload deck plan image
- [ ] Click placement creates marker at correct position
- [ ] Marker coordinates are normalized
- [ ] Can link marker to incident
- [ ] Preview mode hides GM-only markers

**Spec Reference**: Task 11/12 from supplemental plan
- Coordinate system: normalized (0-1) for responsiveness
- Marker taxonomy: breach/fire/door/crew/anomaly
- Linking behavior to incidents/tasks defined

---

### 7.7 Ship's Log / Black Box Viewer

**Objective**: Comprehensive log viewer for GM investigation and mystery gameplay scenarios.

**Outputs**:
- `/frontend/src/pages/admin/ShipLog.tsx`
- `/frontend/src/components/admin/LogViewer.tsx`
- `/frontend/src/components/admin/LogFilters.tsx`
- `/docs/spec_ship_log.md`

**Features**:
- **Full Event History** with user attribution:
  - Who: user/role/station that triggered the action
  - What: detailed action description
  - When: precise timestamp
  - Where: location/system affected (if applicable)
  - Why: linked incident/task/scenario (if applicable)
- **Advanced Filtering**:
  - By date/time range
  - By event type (state changes, tasks, incidents, postures, etc.)
  - By user/role
  - By system/location
  - By severity (info/warning/critical)
  - By keyword search in descriptions
- **Event Retention**:
  - Circular buffer: 2500 most recent events
  - Older events auto-pruned
  - Export full log before pruning (JSON/CSV)
- **Timeline View**:
  - Chronological display with visual timeline
  - Color-coded by severity
  - Expandable detail panels
  - Jump to bookmarked events
- **Export Capabilities**:
  - Export filtered results
  - Export full log archive
  - Format: JSON or CSV
- **Mystery Gameplay Support**:
  - GM can mark events as "player-visible" or "GM-only"
  - Players can access filtered log via widget
  - Redacted logs (hide sensitive GM info)

**Backend Requirements**:
- `GET /api/ship-log?filters...&page=1&limit=50` → paginated events
- `GET /api/ship-log/export?format=json` → full export
- `POST /api/ship-log/bookmark` → bookmark an event
- All action endpoints must log to ship log with user attribution

**Acceptance Checks**:
- [ ] All player actions logged with user/role attribution
- [ ] Filters work independently and in combination
- [ ] Timeline view shows events chronologically
- [ ] Export produces complete, valid JSON/CSV
- [ ] Event limit enforced (2500 max, oldest pruned)
- [ ] GM-only vs player-visible events respected
- [ ] Bookmarks link to correct events
- [ ] Search finds events by keyword in description

**Use Cases**:
- GM reviews who did what during a crisis
- Players investigate "what happened to the previous crew"
- Audit trail for debugging scenarios
- Narrative tool for post-session recaps

---

## Phase 8: Scenarios + Incidents Workflow

**Goal**: Make the system dynamic and reactive. Scenarios drive incidents, incidents spawn tasks, tasks drive mini-games.

### 8.1 Alert Rules System

**Objective**: Derived alerts trigger automatically based on state changes.

**Outputs**:
- `/backend/app/services/alert_rules.py`
- `/backend/app/models/alert_rule.py`
- `/docs/spec_alert_rules.md`

**Features**:
- Rule definition:
  - Condition: system state threshold (e.g., shields < 30%)
  - Alert message template
  - Severity mapping
  - Cooldown period (don't spam)
- Backend evaluates rules on state changes
- Emits events to event feed
- GM can enable/disable rules
- Predefined rules for common scenarios

**Acceptance Checks**:
- [ ] Rule triggers when threshold crossed
- [ ] Alert message uses template variables
- [ ] Cooldown prevents spam
- [ ] Rule can be disabled without deleting

---

### 8.2 Incident → Task Auto-Spawn

**Objective**: Incidents automatically create tasks based on spawn rules.

**Outputs**:
- `/backend/app/services/incident_handler.py`
- `/backend/app/models/task_spawn_rule.py`

**Features**:
- Task spawn rules:
  - Trigger: incident created with severity X
  - Spawn tasks: template IDs or inline definitions
  - Delay: immediate or after N seconds
  - Conditions: only if system state Y
- Backend evaluates rules on incident creation
- Tasks inherit incident context (affected systems, location)
- GM can override auto-spawn in admin UI

**Acceptance Checks**:
- [ ] Incident creation spawns linked tasks
- [ ] Task inherits incident system/location
- [ ] Delayed spawn works (after N seconds)
- [ ] GM can disable auto-spawn per incident type

**Spec Reference**: Task 1/12 from supplemental plan
- Incident/task boundaries defined
- Task states: open → active → (succeeded/failed/expired/aborted)
- Consequences/rewards payload schema
- Logging requirements for state transitions

---

### 8.3 Mini-Game Runtime Integration

**Objective**: Connect task actions to mini-game outcomes, apply consequences.

**Outputs**:
- `/backend/app/services/minigame_handler.py`
- `/backend/app/api/endpoints/minigames.py`

**Features**:
- API endpoints:
  - `POST /api/tasks/{id}/start-minigame` → returns minigame definition
  - `POST /api/minigames/{id}/submit-result` → applies outcome
- Outcome mapping:
  - Success → apply success consequences (restore system, complete task)
  - Partial → partial restoration
  - Fail → apply failure consequences (degrade further, spawn new incident)
  - Timeout/Abort → task remains open or fails
- Idempotency: double-submit protection
- Lock semantics: only one player can start mini-game per task

**Acceptance Checks**:
- [ ] Starting mini-game locks task
- [ ] Success outcome applies consequences correctly
- [ ] Failure can spawn new incident
- [ ] Double-submit rejected with clear error
- [ ] Result submission emits event to log

**Spec Reference**: Task 2/12 from supplemental plan
- Mini-game result enum: success/partial/fail/abort/timeout
- Inputs: task_id, minigame_id, difficulty, time_limit, modifiers
- Outputs: result, score, notes, duration_ms
- Side effects described as declarative mapping

---

### 8.4 Enhanced Event Feed with User Attribution (Black Box System)

**Objective**: Expand event types for comprehensive ship log with full user attribution and retention management.

**Outputs**:
- Updates to `/backend/app/services/event_logger.py`
- New event types in `/backend/app/models/event.py`
- Migration: Add user attribution fields to events table
- `/backend/app/services/log_retention.py` (pruning service)

**New Event Types** (Player Actions):
- `transmission_received` / `transmission_sent` (contact, channel, message, sender_role)
- `contact_updated` / `contact_created` (sensor sweep results, updated_by)
- `incident_created` / `incident_resolved` (created_by, resolved_by)
- `task_created` / `task_claimed` / `task_started` / `task_finished` / `task_expired` (user, role)
- `task_abandoned` / `task_failed` (user, role, reason)
- `posture_changed` (old posture, new posture, ROE changes, changed_by)
- `system_state_changed` (system, old_status, new_status, changed_by, reason)
- `holomap_marker_added` / `holomap_marker_updated` / `holomap_marker_removed` (user)
- `minigame_started` / `minigame_completed` (user, task_id, result, score)
- `scenario_executed` (scenario_id, executed_by)
- `panel_modified` / `widget_added` / `widget_removed` (panel_id, user)
- `navigation_changed` (from_panel, to_panel, user)

**User Attribution Fields** (added to all events):
- `user_id` (optional, if authenticated)
- `role` (player/gm/engineer/tactical/etc.)
- `station` (optional, which console/panel)
- `session_id` (for tracking continuous sessions)

**Features**:
- **Event Retention Policy**:
  - Circular buffer: **2500 most recent events** (configurable)
  - Auto-prune oldest events when limit reached
  - Scheduled cleanup task runs every hour
  - Export warning when approaching limit
- **User Attribution**:
  - All events track who triggered the action
  - Role-based attribution (GM, player, specific station)
  - Session tracking for context
- **Visibility Control**:
  - Events marked as `player_visible` or `gm_only`
  - Player widgets show only player-visible events
  - Admin/log viewer shows all events
- **Pagination & Query**:
  - Efficient pagination (cursor-based)
  - Filter by event type, user, role, date range
  - Full-text search in event descriptions
- **Severity Mapping**:
  - `info` (routine actions)
  - `warning` (concerning events)
  - `critical` (emergencies, failures)
- **Bookmark Support**:
  - Reference event_id
  - Label and notes
  - GM-only or player-visible bookmarks

**Backend Requirements**:
- Database migration: Add user attribution columns to events table
- Retention service: Prune events beyond 2500 limit
- Query optimization: Indexes on timestamp, user_id, event_type
- Export endpoint: `GET /api/events/export?format=json&limit=2500`

**Acceptance Checks**:
- [ ] All 20+ event types emit correctly with user attribution
- [ ] Events include user, role, station, session_id
- [ ] Retention limit enforced (2500 max)
- [ ] Oldest events pruned automatically
- [ ] Player-visible vs GM-only respected
- [ ] Pagination returns correct page size
- [ ] Filters work (type, user, date range, severity)
- [ ] Full-text search finds events
- [ ] Bookmarks reference valid event IDs
- [ ] Export produces complete log archive

**Spec Reference**: Task 6/12 from supplemental plan (enhanced)
- Event types and payload expectations defined
- User attribution model specified
- Bookmark model: references event_id, label, visibility
- Severity mapping and retention policy (2500 event limit)
- Circular buffer pruning strategy

---

## Phase 9: Immersion Polish

**Goal**: Add atmospheric touches that make the HUD feel alive and responsive.

### 9.1 Boot Sequence

**Objective**: Animated startup sequence when opening player view.

**Outputs**:
- `/frontend/src/components/BootSequence.tsx`
- `/frontend/src/components/BootSequence.css`

**Features**:
- Trigger: first load or manual "reboot"
- Animation stages:
  1. BIOS-style text scroll (system checks)
  2. Ship name + class reveal
  3. "Initializing subsystems..." with progress
  4. Status indicators come online
  5. Fade to normal HUD
- Duration: 3-5 seconds
- Skip button (after 1 second)
- Respect `prefers-reduced-motion`

**Acceptance Checks**:
- [ ] Boot sequence plays on first load
- [ ] Skip button appears after 1s
- [ ] Reduced motion shows instant load
- [ ] Subsystem names match ship config

---

### 9.2 Audio Hook System

**Objective**: Framework for audio cues without hard-coding sounds.

**Outputs**:
- `/docs/spec_audio_hooks.md`
- `/frontend/src/lib/audioHooks.ts`

**Features**:
- Hook points:
  - Posture change (yellow → red alert klaxon)
  - Task created (notification beep)
  - Critical alert (alarm)
  - Transmission received (comms chirp)
  - Mini-game timer warning (tension music)
- Config file maps hooks to audio files (optional)
- Volume control
- Mute toggle
- Browser autoplay handling

**Acceptance Checks**:
- [ ] Hook points documented
- [ ] Config can disable/replace sounds
- [ ] Volume control works globally
- [ ] No audio plays if muted

---

### 9.3 Status Transition Animations

**Objective**: Visual feedback for system state changes.

**Outputs**:
- `/frontend/src/components/widgets/StatusDisplayWidget.css` (enhanced)
- `/frontend/src/components/widgets/HealthBarWidget.css` (enhanced)

**Features**:
- Transition effects:
  - Operational → degraded: pulse yellow
  - Degraded → critical: flash red + shake
  - Critical → destroyed: fade to gray + crack effect
  - Destroyed → operational: glow green + restore animation
- Duration: 0.5-1s per transition
- Respect `prefers-reduced-motion` (instant change)

**Acceptance Checks**:
- [ ] State change triggers animation
- [ ] Animation completes before next change
- [ ] Reduced motion disables animations
- [ ] Colors match status model spec

---

### 9.4 Ambient Texture Layer

**Objective**: Subtle background effects that enhance atmosphere.

**Outputs**:
- `/frontend/src/components/AmbientEffects.tsx`
- `/frontend/src/components/AmbientEffects.css`

**Features**:
- Effects:
  - Subtle particle drift (stars/debris)
  - Occasional screen flicker (tied to glitch intensity)
  - Breathing light pulse on console borders
  - Status-colored ambient glow (very subtle)
- Posture-driven intensity
- Can be disabled in settings
- Minimal performance impact

**Acceptance Checks**:
- [ ] Effects visible but not distracting
- [ ] Intensity scales with posture
- [ ] Can be disabled
- [ ] No performance drop on lower-end devices

---

## Phase 10: Production Deployment

**Goal**: Harden the system for real-world use on Unraid.

### 10.1 Config Export/Import

**Objective**: Ship configurations as portable JSON files.

**Outputs**:
- `/backend/app/api/endpoints/config.py`
- `/docs/config_format.md`

**Features**:
- Export endpoints:
  - `GET /api/config/export/ship/{id}` → full ship config
  - `GET /api/config/export/scenarios` → all scenarios
  - `GET /api/config/export/all` → complete dump
- Import endpoint:
  - `POST /api/config/import` → validates and applies
- Validation:
  - Schema validation
  - Referential integrity checks
  - Conflict resolution (merge vs replace)
- Format: JSON with metadata (version, timestamp, ship_id)

**Acceptance Checks**:
- [ ] Export produces valid JSON
- [ ] Import validates schema
- [ ] Import detects conflicts
- [ ] Can export/import on different instances

---

### 10.2 Unraid Deployment Testing

**Objective**: Verify Docker deployment on Unraid hardware.

**Outputs**:
- `/docs/deployment_unraid.md` (updated)
- `/docs/troubleshooting.md`

**Tasks**:
- Test on actual Unraid instance
- Verify persistent volumes
- Test upgrades (new version container)
- Document port mappings
- Test reverse proxy setup (if applicable)
- Performance benchmarks
- Backup/restore procedures

**Acceptance Checks**:
- [ ] `docker compose up` works first time
- [ ] Database persists across restarts
- [ ] Logs accessible via Unraid UI
- [ ] Upgrade path tested
- [ ] Backup/restore documented

---

### 10.3 Performance Optimization

**Objective**: Ensure smooth performance under realistic load.

**Outputs**:
- Performance audit report
- Optimization PRs

**Focus Areas**:
- Frontend:
  - Lazy loading for admin pages
  - React Query cache tuning
  - Widget render optimization (memo/callback)
  - Asset bundling (code splitting)
- Backend:
  - Query optimization (indexes)
  - Response caching (Redis optional)
  - Pagination enforcement
  - Bulk operation support
- Database:
  - Index coverage analysis
  - Query plan review
  - Vacuum/optimize routines

**Acceptance Checks**:
- [ ] Admin page load < 1s
- [ ] Panel view load < 500ms
- [ ] Widget updates < 100ms
- [ ] No memory leaks in 24h session
- [ ] Database queries < 50ms p95

---

### 10.4 Security Hardening

**Objective**: Basic security best practices.

**Outputs**:
- Security audit report
- `/docs/security.md`

**Tasks**:
- Input validation on all endpoints
- SQL injection protection (parameterized queries)
- XSS protection (sanitize user content)
- CSRF tokens (if needed)
- Rate limiting on sensitive endpoints
- Error messages don't leak internals
- Secrets management (env vars, not hardcoded)
- HTTPS recommendation

**Acceptance Checks**:
- [ ] All inputs validated
- [ ] No SQL injection vectors
- [ ] User content sanitized
- [ ] Rate limiting active
- [ ] Secrets externalized

---

## Implementation Order

### Recommended Sequence

**Phase 7: Admin UI** (build authoring power)
1. 7.1 Contacts Manager (1-2 days)
2. 7.2 Dataset Editor (2-3 days)
3. 7.3 Scenario Authoring UI (3-4 days)
4. 7.4 Rehearsal + Diff Viewer (2-3 days)
5. 7.5 Template Editor (2 days)
6. 7.6 Holomap Editor (3 days)
7. 7.7 Ship's Log / Black Box Viewer (2-3 days)

**Phase 8: Dynamic Systems** (make it alive)
1. 8.1 Alert Rules (2 days)
2. 8.2 Incident → Task Auto-Spawn (2 days)
3. 8.3 Mini-Game Runtime (3 days)
4. 8.4 Enhanced Event Feed with User Attribution (3-4 days)

**Phase 9: Immersion** (polish the experience)
1. 9.1 Boot Sequence (1 day)
2. 9.2 Audio Hooks (1-2 days)
3. 9.3 Transition Animations (1 day)
4. 9.4 Ambient Effects (1 day)

**Phase 10: Production** (ship it)
1. 10.1 Config Export/Import (2 days)
2. 10.2 Unraid Testing (2-3 days)
3. 10.3 Performance Optimization (3-4 days)
4. 10.4 Security Hardening (2-3 days)

**Total Estimated Time**: 7-9 weeks (with testing and iteration)

---

## Success Criteria

### Phase 7 Complete When:
- GM can create/edit scenarios with 5+ action types
- GM can manage contacts and datasets
- GM can preview scenario outcomes before running
- Holomap editor functional
- **Ship's log viewer shows complete event history with filters**
- **GM can export logs for mystery scenarios**

### Phase 8 Complete When:
- Incidents auto-spawn tasks based on rules
- Mini-games integrate with task outcomes
- Alert rules trigger automatically
- **Event feed captures all 20+ event types with user attribution**
- **Circular buffer maintains 2500 event limit**
- **Player-visible vs GM-only events work correctly**

### Phase 9 Complete When:
- Boot sequence plays on load
- Status changes animate smoothly
- Audio hooks framework in place
- Ambient effects enhance atmosphere

### Phase 10 Complete When:
- Docker deployment tested on Unraid
- Config export/import working
- Performance meets targets
- Security audit passed

---

## Dependency Notes

### Must Happen First
- All specs complete (already done ✅)
- Core widgets implemented (already done ✅)

### Can Work in Parallel
- Admin UI components (Phase 7.1-7.6)
- Event feed expansion (Phase 8.4)
- Immersion polish (Phase 9.1-9.4)

### Must Happen Sequentially
- Scenario authoring → Rehearsal UI (7.3 → 7.4)
- Alert rules → Incident handler (8.1 → 8.2)
- Mini-game runtime → Task integration (8.3 depends on tasks)

---

## Next Steps

**Immediate**: Choose starting point for Phase 7
- **Option A**: Start with 7.1 (Contacts Manager) - simpler CRUD to build momentum
- **Option B**: Start with 7.3 (Scenario Authoring) - highest GM value
- **Option C**: Start with 7.4 (Rehearsal UI) - most architecturally interesting

**Recommended**: Start with **7.1 Contacts Manager** to build CRUD patterns, then move to **7.3 Scenario Authoring** for maximum GM impact.
