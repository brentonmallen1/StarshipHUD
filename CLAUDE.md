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
  - `operational` → green
  - `degraded` → yellow-green / amber
  - `compromised` → amber / orange
  - `critical` → red-orange / red
  - `destroyed` → deep red (or red + muted)
  - `offline` → gray
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
