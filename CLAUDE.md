# Starship HUD — Project Instructions

You are an expert full-stack engineer working on the **Starship HUD** web application. Follow these constraints for all changes.

---

## Code Search

Prefer grepika MCP tools over built-in Grep/Glob for code search:
- `mcp__grepika__index` - Build/update search index (run first!)
- `mcp__grepika__search` - Pattern/regex search (replaces Grep)
- `mcp__grepika__toc` - Directory tree (replaces Glob patterns)
- `mcp__grepika__outline` - File structure extraction
- `mcp__grepika__refs` - Symbol references

These provide ranked results with FTS5+trigram indexing for better search quality.


## 1) Project Mission

Immersive, diegetic spaceship HUD for a tabletop campaign. The ship feels like a character. UI communicates narrative state quickly (status colors, motion, alerts). GM designs panels and drives scenes.

---

## 2) Quick Start

```bash
just setup              # Install all deps (backend + frontend)
just dev                # Start backend (:8000) + frontend (:5173)
just backend            # Backend only
just frontend           # Frontend only
just reset-db           # Reset database + re-seed
just seed               # Re-seed without reset

# Testing
cd backend && uv run pytest                      # All backend tests
cd backend && uv run pytest tests/test_ships.py  # Single file
cd backend && uv run pytest -x                   # Stop on first failure
cd backend && uv run ruff check app/             # Backend lint
cd frontend && npm run lint                      # Frontend lint
cd frontend && npm run build                     # Type-check + build
cd frontend && npm run test:e2e                  # Playwright smoke tests (own ports 18731/18732, uses local Chrome)
```

CI (`.gitea/workflows/ci.yml`) runs all of the above; pytest enforces 80% coverage.

---

## 3) Architecture

**Stack:** React frontend, Python FastAPI backend, SQLite database, Docker deployment (Unraid target)
**Dev tooling:** direnv + nix, uv (Python), justfile (commands)

### Key principles
- **Backend is source of truth** — frontend is renderer + controller
- **Panels are layout; widgets are views** — widgets coordinate through state/events, not each other
- **Widget registry pattern** — a widget is one registry entry (`widgetRegistry.ts`): renderer, optional config editor, defaults and binding kind. The config modal is a generic shell; never add widget-specific branches to it
- **Panel visibility** — `role_visibility: Role[]` field filters panels: `"player"` for player views, `"gm"` for GM dashboards. Enforced server-side
- **Authorization is server-side** — every domain router goes through `authorize_request` (`services/authz.py`): per-ship effective role, GM-only mutations except an explicit player allowlist (`PLAYER_RULES`, field-level), and visibility filters forced for players. A new player-facing action must be added to that allowlist; never rely on hiding a button. With `AUTH_ENABLED=false` every caller is admin (trusted-table mode)
- **Live updates** — successful API mutations bump an in-process counter streamed over SSE (`/api/live/{ship_id}`); the frontend invalidates queries on change and polls only as a fallback (`livePoll()`). Assumes one uvicorn worker
- **Events as backbone** — state changes emit events via `services/events.emit_event` for log/timeline widgets, alerts, GM auditability. GM-authoring events use `transmitted=False`; players only ever see transmitted events
- Use existing libraries when sensible; don't reinvent the wheel

### Deliverables for features
- UI component(s) + API endpoint(s) + persistence model
- Update seed/demo content if it improves first-run experience
- Backend tests for new API endpoints

---

## 4) Style & UX (Diegetic HUD, Not a Dashboard)

- **Dark theme**, sci-fi aesthetic (Tron / LCARS / The Expanse energy)
- Avoid generic SaaS/dashboard patterns in player views
- **Status colors** (use CSS variables `--color-{status}`, never invent new ones):
  - `optimal` #00ffcc | `operational` #3fb950 | `degraded` #d4a72c | `compromised` #db6d28
  - `critical` #f85149 | `destroyed` #8b0000 | `offline` #6e7681
- **Always** communicate status via color + shape/icon (never color alone)
- **Motion semantics:** operational=stable, degraded=flicker, compromised=glitch, critical=pulse, destroyed=inert, offline=muted
- **CRITICAL: Player panels must never scroll.** Fit entirely in viewport. Use pagination/tabs/toggles for overflow. Admin pages may scroll.
- Player nav should be diegetic ("console selector"); admin nav can be conventional
- CSS/Canvas animations preferred; no heavy shaders

---

## 5) Backend & Data Model

- **SQLite-first:** inspectable schema, explicit tables for core concepts, JSON columns only for flexible config
- **Validation server-side:** threshold consistency, bounds, enum integrity, actionable errors
- **Pydantic model pattern:** `Base` → `Create` → `Update` → `Full` (see `backend/app/models/`)
- **API route pattern:** standard REST (list/get/create/patch/delete) per module (see `backend/app/api/`). Routers stay thin; business logic lives in `backend/app/services/` (system_states, scenario_engine, ship_transfer, sector_map, events) and raises `services/errors.py` exceptions
- **Update models** subclass `UpdateSchema` with `table=` so explicit `null` on NOT NULL columns is a 422
- **Status calculation:** thresholds and the effective-status cascade live in `services/system_states.py` (also used by scenarios, tasks and assets); effective_status = min(own, every ancestor)
- **Scenarios** run through one engine (`run_scenario(..., dry_run=)`) inside a savepoint: all actions apply or none do
- **JSON columns:** SQLite stores as text — always `json.loads()` when reading

---

## 6) Project Structure

```
backend/app/
  api/            # Route handlers (one module per domain)
  models/         # Pydantic schemas (Base/Create/Update/Full)
  services/       # Business logic
  migrations/     # SQL migration files
  main.py         # App setup + router registration
  database.py     # Schema + connection + migrations
  seed.py         # Demo data

frontend/src/
  components/
    widgets/      # Widget renderers + widgetRegistry.ts + WidgetState
      config/     # One <Name>ConfigEditor.tsx per configurable widget (+ shared fields/FxFields)
    admin/        # GM authoring (modals, forms)
    layout/       # PlayerLayout, AdminLayout
    controls/     # Reusable controls
    ui/           # Base UI components
  pages/admin/    # Admin route-level views
  pages/PanelView.tsx  # Player panel renderer
  hooks/          # useShipData.ts, useMutations.ts
  contexts/       # ShipContext, RoleContext, ToastContext
  services/api.ts # Namespaced API client
  styles/index.css # Design tokens
  types/index.ts  # All TypeScript types (single source of truth)
```

---

## 7) Key Files

| File | Purpose |
|------|---------|
| `frontend/src/types/index.ts` | All TypeScript types |
| `frontend/src/components/widgets/widgetRegistry.ts` | Widget metadata, dimensions, ConfigEditor/defaultConfig/binding |
| `frontend/src/types/widget-configs.ts` | Per-widget config interfaces + `*_DEFAULTS` |
| `frontend/src/utils/status.ts` | `STATUS_META` (label/code/colour token/shape/order), `resolveStatusColor`, `getEffectiveStatus` |
| `frontend/src/services/api.ts` | API client (shipsApi, panelsApi, systemStatesApi, scenariosApi, tasksApi, eventsApi, assetsApi, cargoApi, cargoBaysApi, cargoCategoriesApi, cargoPlacementsApi, crewApi, contactsApi, sensorContactsApi, holomapApi, incidentsApi, sessionApi, uploadsApi) |
| `frontend/src/hooks/useShipData.ts` | Data fetching hooks |
| `frontend/src/hooks/useMutations.ts` | Mutation hooks for CRUD |
| `frontend/src/styles/index.css` | Design tokens (colors, spacing, fonts, glows) |
| `backend/app/models/base.py` | Core enums (SystemStatus, StationGroup, Posture, Role, EventSeverity) |
| `backend/app/database.py` | SQLite schema, migrations |
| `backend/app/seed.py` | Demo data — update when adding features |

---

## 8) Frontend Patterns

- **Widget grid:** columns from `panel.grid_columns` (default 24), 25px row height; constants and `widgetsToLayout()` in `utils/panelGrid.ts` are shared by player view, editor and GM dashboards. Player view scales the grid down to fit instead of scrolling
- **State:** React Query for server state (polling via `livePoll(ms)` as a fallback to the SSE stream), React Context for app state
- **API errors** are `ApiError` with `.status`; a 401 anywhere ends the session
- **CSS:** one `.css` per component, BEM-like naming (`.widget-name__element--variant`), status classes (`.status-optimal`), animation classes (`.pulse-critical`, `.flicker-degraded`, `.glitch`)
- **Design tokens** in `styles/index.css`: `--color-*`, `--space-*`, `--font-*`, `--glow-*`
- **Panel CRUD** uses `panelsApi` directly (no mutation hooks in `useMutations.ts` for panels)

---

## 9) Engineering Standards

- State what files are changed/added, why, and how to verify
- Frontend: layout/editor separated from runtime renderers; widget config/editor separated from widget view
- Backend: routing separated from service logic; DB models separated from API DTOs
- Schema changes via migrations in `database.py`; seed data kept versioned
- Start with simplest MVP; defer complexity behind clean contracts
- **Testing:** pytest + pytest-asyncio + httpx test client; 80% coverage threshold; one test file per API module in `backend/tests/`

---

## 10) Common Tasks

**New widget:**
1. Config shape: add `XConfig` + `X_DEFAULTS` (`as const satisfies XConfig`) to `types/widget-configs.ts`.
2. Renderer: `components/widgets/XWidget.tsx` + `.css`. Read config with `getConfig<XConfig>(instance.config)` and fall back to `X_DEFAULTS` (never inline literals). Bound system: `useBoundSystem(instance, systemStates)`; status colours/labels/shapes from `utils/status.ts`. Loading/error/empty: `<WidgetState kind=… />`. Runtime edits from inside the widget: `onConfigChange({ changedKey })` — a partial patch, never `{ ...instance.config }`.
3. Editor (only if configurable): `components/widgets/config/XConfigEditor.tsx` exporting `XConfigEditor({ config, onChange, bindings, onBindingsChange, systemStates }: WidgetConfigEditorProps<XConfig>)`. Merge `{ ...X_DEFAULTS, ...config }`, emit partial patches (`undefined` removes a key), build from `config/fields.tsx` (and `FxFields` for decorative effects). Export it from `config/index.ts`.
4. Register in `WIDGET_TYPES`: `Renderer`, `ConfigEditor: lazyEditor('XConfigEditor')`, `defaultConfig: X_DEFAULTS`, `binding: 'system' | 'optional-system'` if it reads `bindings.system_state_id` (default `'none'`). New widgets are created with `defaultConfig`; the modal shows the binding picker from `binding`.
5. GM-only modals opened from a widget go through `components/widgets/lazyAdminModals.ts` and mount only while open.

**New data domain:** Types in `types/index.ts` → API namespace in `api.ts` → hooks in `useShipData.ts` + `useMutations.ts` → Pydantic models in `models/` → API router in `api/` → register in `main.py` → schema in `database.py`

**New admin page:** Create in `pages/admin/` → route in `App.tsx` → nav link in admin layout

**Schema change:** Update `database.py` SCHEMA → add migration in `apply_migrations()` → update Pydantic models → update TS types

---

## 11) Do Not Do

- Turn player UI into a generic dashboard
- Let widgets become snowflakes with bespoke state logic
- Couple widgets to each other directly
- Build a full VTT — stay focused on ship systems and immersion
- Introduce heavy infra (Postgres, message brokers) unless explicitly required

---

## 12) Libraries

**Frontend:** @tanstack/react-query, react-router-dom, react-grid-layout, @visx, @dnd-kit
**Backend:** FastAPI, aiosqlite, pydantic v2, pydantic-settings, pillow (uploads)

---

## 13) Priorities (When Uncertain)

1. Clear contracts (widgets, panels, state, events)
2. GM authoring power (panel builder + scenarios)
3. Player readability (status language + alerts)
4. Immersion polish (animations, transmissions, holomap)
5. Deployment simplicity (Unraid-ready containers)
