# claude.md — Starship HUD Project System Prompt

You are an expert full-stack engineer working on the **Starship HUD** web application. You must follow the constraints and conventions in this document for **all** changes you propose or implement.

---

## 1) Project Mission

Build a web app that functions as an immersive, diegetic spaceship HUD for a tabletop campaign:
- The ship should feel like a character.
- The UI should communicate narrative state quickly (status colors, motion, alerts).
- The GM/admin must be able to design panels and drive scenes (scenarios, incidents, tasks).

---

## 2) Non-Negotiable Architecture

### 2.1 Overall stack
- **Frontend:** React
- **Backend:** Python **FastAPI**
- **Database:** **SQLite** (keep complexity low; optimize for inspectability)
- **Deployment:** Docker (Dockerfile + docker-compose + `.env.example`) targeting Unraid

### 2.2 Dev environment + workflow
- Use **direnv + nix** to provide reproducible tooling and dependencies.
- Use **uv** to manage Python dependencies and virtual environments.
- Use a **justfile** as the primary UX layer for developer commands.

### 2.3 Deliverables for every meaningful feature
- UI component(s) + API endpoint(s) + persistence model (if applicable)
- Clear boundaries between frontend, backend, and DB
- Update seed/demo content if it improves the “first run” experience
- Minimal documentation additions for new concepts

### 2.4 Use existing libraries
- **CRITICAL**: Use existing libraries instead of reinvinting the wheel where it makes sense
- Only use existing libraries if they are commonly used and actively maintained
- Don't use libraries if adding the dependency either overcomplicates the implementation or the overhead isn't worth it
- It's okay to use existing libraries even if their entire functionality might not be used, especially if it opens up opportunities or a more fluid implementation 

---

## 3) Core Design Principles (Keep This System Cohesive)

### 3.1 Modularity
- Prefer **composable modules** with clear contracts.
- Widgets/panels must be **extensible**:
  - Adding a new widget should not require touching unrelated panel/layout code.
- Frontend should be built as a **widget registry** (type → renderer/editor/schema).

### 3.2 Source of truth
- The backend is the **source of truth** for state.
- Frontend should be a **renderer + controller** for allowed interactions only.
- System state changes must be logged as events when relevant.

### 3.3 “Panels are layout; widgets are views”
- Panels define layout and composition only.
- Widgets render state and expose a narrow set of actions.
- Widgets should not directly coordinate with each other; they coordinate through state/events.

---

## 4) Style & UX Requirements (Diegetic HUD, Not a Dashboard)

### 4.1 Visual identity
- Must look **clean yet sci-fi**.
- Avoid “mundane SaaS dashboard” aesthetics:
  - No generic Grafana-style grid dashboards.
  - No obvious enterprise admin UI patterns in player views.
- Favor a cohesive, lore-friendly design language:
  - subtle motion, depth, and texture
  - non-standard layout rhythms (asymmetric, “console-like”)
  - readable typography and spacing under low light conditions

### 4.2 Color language
- Base theme: **dark**
- Accents: evoke **Tron / LCARS / The Expanse** energy (tasteful, not neon vomit)
- Status colors must be consistent across the app:
  - `optimal` → cyan (#00ffcc)
  - `operational` → green (#3fb950)
  - `degraded` → amber (#d4a72c)
  - `compromised` → orange (#db6d28)
  - `critical` → red (#f85149)
  - `destroyed` → deep red (#8b0000)
  - `offline` → gray (#6e7681)
- Status should be communicated via:
  - border/glow, iconography, and/or subtle motion
  - never color alone (include label/icon fallback)

### 4.3 Motion & animation
- Animations should add **texture and depth**, not gratuitous noise.
- Motion semantics should reinforce meaning:
  - operational = stable
  - degraded = mild flicker
  - compromised = intermittent glitching
  - critical = pulsing urgency
  - destroyed = inert/dead
  - offline = muted/no motion
- Keep performance reasonable; prefer lightweight CSS/Canvas effects over heavy shaders.

### 4.4 Navigation
- Player navigation should be subtle and diegetic:
  - "console selector", "bridge station dial", etc.
- Admin navigation can be more conventional, but should still feel "ship systems management".

### 4.5 No-Scroll Instrument Panel Design
- **CRITICAL**: Player panels must **never require scrolling** to see all information.
- Each panel should fit entirely within the viewport, like a physical instrument panel on a ship's bridge.
- Design constraints:
  - Panels must be designed for their target viewport size
  - Content must be prioritized and density-optimized
  - Use compact layouts, small fonts, abbreviated labels where appropriate
  - Overflow should be handled via:
    - Pagination (e.g., task queue pages)
    - Tabs/toggles (e.g., switch between sensor views)
    - Collapsible sections (expand/collapse detail)
    - **NOT** via scrollbars (except for rare cases like long lists in modals)
- Admin pages MAY scroll (they're authoring tools, not immersive panels)
- Responsive behavior:
  - Panels should scale/reflow for different screen sizes
  - Smaller screens may show fewer widgets or smaller text
  - Minimum supported resolution should be defined (e.g., 1920x1080)
  - Mobile/tablet may have different interaction patterns (out of scope for MVP)

**Implementation Notes**:
- Panel canvas should use viewport-aware layouts (vh/vw units, flexbox)
- Widget sizing should account for panel chrome (headers, borders)
- Test on target display resolution during development
- GM should be able to preview panels at different resolutions

---

## 5) Backend & Data Model Guidance

### 5.1 SQLite-first discipline
- Keep schema inspectable; avoid over-abstracted DB patterns.
- Favor explicit tables for core concepts (panels, widget instances, system states, events).
- Use JSON columns strategically for flexible widget config, but do not use JSON as a dumping ground:
  - if a concept is queried frequently, model it relationally.

### 5.2 Events as backbone
- Important state changes should emit events:
  - status changes, scenario runs, transmissions, alerts, task transitions
- Events should enable:
  - ship log/timeline widgets
  - alert bar
  - GM auditability and recap

### 5.3 Validation
- Enforce invariants server-side:
  - threshold consistency
  - min/max bounds
  - status enum integrity
  - terminal state rules (if defined)
- Reject invalid updates with actionable error messages.

---

## 6) Build & Deployment Requirements (Unraid Target)

### 6.1 Required artifacts
- Dockerfile(s)
- docker-compose.yml
- `.env.example`

### 6.2 Expectations
- Persistent volume for SQLite DB
- Simple “bring up” path: `docker compose up -d`
- Documentation snippet for Unraid deployment and upgrades
- Seed/demo ship data for first run

---

## 7) Engineering Standards for Contributions

### 7.1 Change discipline
For every change, explicitly state:
- What files are changed/added
- Why the change is needed
- How to manually verify it works (short checklist)

### 7.2 Separation of concerns
- Frontend:
  - layout/editor components separated from runtime renderer components
  - widget config/editor separated from widget view renderer
- Backend:
  - routing separated from service logic
  - DB models separated from API DTOs
- Data:
  - schema changes via migrations
  - seed data kept versioned and reproducible

### 7.3 Feature gating / evolution
- Start with the simplest MVP that preserves the architecture.
- Defer complexity behind clean contracts (e.g., start with polling; later upgrade to websockets).

---

## 8) “Do Not Do” List (Common Project Killers)

- Do not turn the player UI into a generic dashboard.
- Do not let widgets become snowflakes with bespoke state logic.
- Do not couple widgets to each other directly.
- Do not build a full VTT; keep interactions focused on ship systems and immersion.
- Do not introduce heavy infra (Postgres, message brokers) unless explicitly required.

---

## 9) Default Implementation Priorities

When uncertain, prioritize:
1. Clear contracts (widgets, panels, state, events)
2. GM authoring power (panel builder + scenarios)
3. Player readability (status language + alerts)
4. Immersion polish (animations, transmissions, holomap)
5. Deployment simplicity (Unraid-ready containers)

---

## 10) Project Structure

```
starship-hud/
├── backend/
│   ├── app/
│   │   ├── api/               # FastAPI route handlers (one module per domain)
│   │   ├── models/            # Pydantic schemas (Base/Create/Update/Full pattern)
│   │   ├── services/          # Business logic (when needed)
│   │   ├── migrations/        # SQL migration files
│   │   ├── main.py            # FastAPI app setup + router registration
│   │   ├── config.py          # Settings via pydantic-settings
│   │   ├── database.py        # SQLite schema + connection + migrations
│   │   └── seed.py            # Demo data generation
│   ├── data/                  # SQLite database + uploads
│   └── pyproject.toml         # Python deps (uv)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/         # GM authoring (modals, forms, action rows)
│   │   │   ├── widgets/       # Widget components + widgetRegistry.ts
│   │   │   ├── modals/        # Generic modals (PlayerEditModal, FieldEditor)
│   │   │   ├── layout/        # PlayerLayout, AdminLayout
│   │   │   ├── controls/      # Reusable controls (EditButton, InlineEditControls)
│   │   │   └── ui/            # Base UI components
│   │   ├── pages/             # Route-level views
│   │   │   ├── admin/         # Admin pages (AdminSystems, AdminPanels, etc.)
│   │   │   └── PanelView.tsx  # Main player panel renderer
│   │   ├── hooks/             # Custom hooks (useShipData, useMutations, etc.)
│   │   ├── contexts/          # React contexts (ShipContext, RoleContext, ToastContext)
│   │   ├── services/          # API client (api.ts with namespaced functions)
│   │   ├── styles/            # Global CSS with design tokens (index.css)
│   │   ├── types/             # TypeScript types (index.ts - single source of truth)
│   │   ├── utils/             # Utilities (graphLayout, navigation)
│   │   └── App.tsx            # Router configuration
│   └── package.json
│
├── docs/                       # MkDocs documentation
├── justfile                    # Developer command UX
├── docker-compose.yml
├── Dockerfile
└── CLAUDE.md
```

---

## 11) Key Files Reference

### Frontend (must-know)
| File | Purpose |
|------|---------|
| `frontend/src/types/index.ts` | All TypeScript types - single source of truth |
| `frontend/src/components/widgets/widgetRegistry.ts` | Widget metadata, lookup functions, dimension validation |
| `frontend/src/services/api.ts` | API client with namespaced functions (shipsApi, panelsApi, etc.) |
| `frontend/src/hooks/useShipData.ts` | Data fetching hooks (useShip, usePanels, useSystemStates, etc.) |
| `frontend/src/hooks/useMutations.ts` | Mutation hooks for all create/update/delete operations |
| `frontend/src/styles/index.css` | Design tokens (colors, spacing, fonts, glows) |
| `frontend/src/App.tsx` | Route structure |

### Backend (must-know)
| File | Purpose |
|------|---------|
| `backend/app/models/base.py` | Core enums (SystemStatus, StationGroup, Posture, etc.) and base schemas |
| `backend/app/database.py` | SQLite schema definition, migrations, connection |
| `backend/app/api/system_states.py` | Status calculation logic - reference implementation |
| `backend/app/seed.py` | Demo data - update when adding new features |
| `backend/app/main.py` | FastAPI setup + all router registrations |

---

## 12) Frontend Patterns

### 12.1 Widget Registry Pattern
Location: `frontend/src/components/widgets/widgetRegistry.ts`

```typescript
// Every widget must be registered here
export const WIDGET_TYPES: Record<string, WidgetTypeDefinition> = {
  health_bar: {
    type: 'health_bar',
    name: 'Health Bar',
    description: 'Displays system health as a bar',
    category: 'display',          // display | interactive | layout | specialized | gm
    minWidth: 2, minHeight: 2,
    defaultWidth: 4, defaultHeight: 2,
    Renderer: HealthBarWidget,
  },
  // ... more widgets
};

// Helper functions available:
getWidgetType(type)              // Get single widget definition
getAllWidgetTypes()              // Get all widget definitions
getWidgetTypesByCategory(cat)    // Filter by category
validateWidgetDimensions(type, w, h)  // Check against min dimensions
```

**Widget Renderer Interface:**
```typescript
interface WidgetRendererProps {
  instance: WidgetInstance;
  systemStates: Map<string, SystemState>;
  isEditing: boolean;
  isSelected: boolean;
  canEditData: boolean;
  onConfigChange?: (config: Record<string, unknown>) => void;
}
```

**Grid System:** 24-column grid, 25px row height (react-grid-layout)

### 12.2 State Management
- **React Query** for server state (auto-refetch, caching, mutations)
- **React Context** for app state (ShipContext, RoleContext, ToastContext)
- System states refetch every 3 seconds for real-time updates

**Common hooks:**
```typescript
// Data fetching
const { data: ship } = useShip();
const { data: panels } = usePanels();
const systemStatesMap = useSystemStatesMap();  // Map<id, SystemState>
const { data: tasks } = useTasks();

// Mutations
const updateSystemState = useUpdateSystemState();
const executeScenario = useExecuteScenario();
```

### 12.3 API Client Pattern
Location: `frontend/src/services/api.ts`

```typescript
// Namespaced API clients
export const systemStatesApi = {
  list: (shipId?) => request<SystemState[]>('/system-states', ...),
  get: (id) => request<SystemState>(`/system-states/${id}`),
  update: (id, data) => request<SystemState>(`/system-states/${id}`, { method: 'PATCH', ... }),
};

// Similar pattern for: shipsApi, panelsApi, scenariosApi, tasksApi,
// eventsApi, assetsApi, cargoApi, crewApi, contactsApi, sensorContactsApi, etc.
```

### 12.4 CSS Conventions
- One `.css` file per component (same name as `.tsx`)
- BEM-like naming: `.widget-name`, `.widget-name__element`, `.widget-name--variant`
- Status classes: `.status-optimal`, `.status-critical`, etc.
- Animation classes: `.pulse-critical`, `.flicker-degraded`, `.glitch`

**Design Tokens (in `styles/index.css`):**
```css
/* Status colors - USE THESE, don't invent new ones */
--color-optimal: #00ffcc;
--color-operational: #3fb950;
--color-degraded: #d4a72c;
--color-compromised: #db6d28;
--color-critical: #f85149;
--color-destroyed: #8b0000;
--color-offline: #6e7681;

/* Spacing */
--space-xs: 4px; --space-sm: 8px; --space-md: 12px; --space-lg: 16px; --space-xl: 24px;

/* Typography */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-sans: 'Inter', sans-serif;

/* Glows (for status indication) */
--glow-operational: 0 0 10px rgba(63, 185, 80, 0.3);
--glow-critical: 0 0 15px rgba(248, 81, 73, 0.4);
```

---

## 13) Backend Patterns

### 13.1 Pydantic Model Pattern
Location: `backend/app/models/`

```python
# Standard pattern for every domain model:
class SystemStateBase(BaseModel):
    """Read-only / shared fields"""
    name: str
    station_group: StationGroup
    max_value: float = 100.0

class SystemStateCreate(SystemStateBase):
    """Fields for creation (ship_id required)"""
    ship_id: str

class SystemStateUpdate(BaseModel):
    """All fields optional for PATCH"""
    name: Optional[str] = None
    current_value: Optional[float] = None
    status: Optional[SystemStatus] = None

class SystemState(SystemStateBase, BaseSchema):
    """Full schema with id + timestamps"""
    id: str
    ship_id: str
    current_value: float
    status: SystemStatus
    effective_status: SystemStatus
    created_at: datetime
    updated_at: datetime
```

### 13.2 API Route Pattern
Location: `backend/app/api/`

```python
# Standard REST pattern for each module:
@router.get("", response_model=list[SystemState])
async def list_system_states(ship_id: Optional[str] = Query(None), db = Depends(get_db)):
    # Query with optional ship_id filter

@router.get("/{system_id}", response_model=SystemState)
async def get_system_state(system_id: str, db = Depends(get_db)):
    # Get single item or 404

@router.post("", response_model=SystemState)
async def create_system_state(data: SystemStateCreate, db = Depends(get_db)):
    # Create and return

@router.patch("/{system_id}", response_model=SystemState)
async def update_system_state(system_id: str, data: SystemStateUpdate, db = Depends(get_db)):
    # Partial update

@router.delete("/{system_id}")
async def delete_system_state(system_id: str, db = Depends(get_db)):
    # Delete
```

### 13.3 Status Calculation
Location: `backend/app/api/system_states.py`

```python
# Thresholds for status calculation
STATUS_THRESHOLDS = {
    100: SystemStatus.OPTIMAL,
    80: SystemStatus.OPERATIONAL,
    60: SystemStatus.DEGRADED,
    40: SystemStatus.COMPROMISED,
    1: SystemStatus.CRITICAL,
    0: SystemStatus.DESTROYED,
}

# Effective status = min(own_status, parent_status) when dependencies exist
# limiting_parent field indicates which parent is capping the status
```

### 13.4 JSON Column Handling
SQLite stores JSON as text. Always parse when reading:

```python
def parse_widget(row: aiosqlite.Row) -> dict:
    result = dict(row)
    result["config"] = json.loads(result["config"])
    result["bindings"] = json.loads(result["bindings"])
    return result
```

---

## 14) Naming Conventions

### Frontend
| Context | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `StatusDisplayWidget.tsx` |
| Hooks | camelCase with `use` prefix | `useShipData.ts` |
| CSS files | Match component name | `StatusDisplayWidget.css` |
| CSS classes | kebab-case BEM-like | `.status-display__content` |
| API namespaces | camelCase | `systemStatesApi` |
| CSS variables | kebab-case with prefix | `--color-optimal`, `--space-md` |

### Backend
| Context | Convention | Example |
|---------|------------|---------|
| Modules | snake_case | `system_states.py` |
| Classes/Enums | PascalCase | `SystemStatus`, `SystemState` |
| Functions | snake_case | `calculate_status_from_percentage` |
| Database tables | snake_case plural | `system_states`, `sensor_contacts` |
| Database columns | snake_case | `ship_id`, `created_at` |

---

## 15) Core Enums (Use These Exactly)

### SystemStatus
```
OPTIMAL | OPERATIONAL | DEGRADED | COMPROMISED | CRITICAL | DESTROYED | OFFLINE
```

### StationGroup
```
COMMAND | ENGINEERING | SENSORS | TACTICAL | COMMS | NAVIGATION | MEDICAL | CARGO | CREW_QUARTERS | MISC
```

### Posture
```
GREEN | YELLOW | RED | SILENT_RUNNING | GENERAL_QUARTERS
```

### Role
```
PLAYER | GM
```

### EventSeverity
```
INFO | WARNING | CRITICAL
```

---

## 16) Common Developer Tasks

### Adding a New Widget
1. Create `frontend/src/components/widgets/NewWidget.tsx` implementing `WidgetRendererProps`
2. Create `frontend/src/components/widgets/NewWidget.css`
3. Register in `widgetRegistry.ts` with type, name, category, dimensions, Renderer
4. Done - no other files need changes

### Adding a New Data Domain (e.g., "Cargo")
1. Add TypeScript types to `frontend/src/types/index.ts`
2. Add API namespace to `frontend/src/services/api.ts`
3. Add data hooks to `frontend/src/hooks/useShipData.ts`
4. Add mutation hooks to `frontend/src/hooks/useMutations.ts`
5. Create Pydantic models in `backend/app/models/cargo.py`
6. Create API router in `backend/app/api/cargo.py`
7. Register router in `backend/app/main.py`
8. Add table to schema in `backend/app/database.py`

### Adding a New Admin Page
1. Create `frontend/src/pages/admin/AdminNewFeature.tsx`
2. Add route in `frontend/src/App.tsx` under admin section
3. Add nav link in appropriate admin component

### Modifying Database Schema
1. Update schema in `backend/app/database.py` (SCHEMA constant)
2. Add migration logic to `apply_migrations()` function
3. Update Pydantic models if needed
4. Update TypeScript types if needed

---

## 17) Status Communication Reference

**Visual Language:**
| Status | Color | Icon Shape | Animation |
|--------|-------|------------|-----------|
| optimal | cyan (#00ffcc) | ● circle | stable |
| operational | green (#3fb950) | ● circle | stable |
| degraded | amber (#d4a72c) | ▲ triangle | mild flicker |
| compromised | orange (#db6d28) | ◆ diamond | intermittent glitch |
| critical | red (#f85149) | ◆ diamond | pulsing urgency |
| destroyed | dark red (#8b0000) | ✕ x | inert/dead |
| offline | gray (#6e7681) | ○ hollow | muted/no motion |

**Always communicate status via:**
- Color (use CSS variables)
- Shape/icon (never color alone)
- Optional: animation/motion

---

## 18) Key Libraries in Use

### Frontend
- **react-query** (TanStack Query) - Server state management
- **react-router-dom** - Routing
- **react-grid-layout** - Widget grid system (24 columns, 25px rows)
- **@visx** - Data visualization
- **@dnd-kit** - Drag and drop

### Backend
- **FastAPI** - Web framework
- **aiosqlite** - Async SQLite
- **pydantic** - Data validation (v2, using `from_attributes=True`)
- **pydantic-settings** - Configuration

---
