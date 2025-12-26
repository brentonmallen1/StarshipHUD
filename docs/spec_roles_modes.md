# Roles & Modes Specification (Task 0.4)

This document defines the **role system** and **operational modes** for the Starship HUD.

---

## Roles

### Role Definitions

| Role     | Description                                      | Access Level |
|----------|--------------------------------------------------|--------------|
| `player` | Crew member viewing/interacting with their station | Read + limited actions |
| `gm`     | Game Master with full control over ship state    | Full access  |

### Role Capabilities

#### Player Role

**Can:**
- View panels with `role_visibility` including `player`
- See widgets bound to visible systems
- Perform widget actions marked as `player_allowed`
- Receive alerts and events
- Navigate between accessible panels

**Cannot:**
- Create/edit panels or widgets
- Modify system states directly
- View GM-only panels
- Execute scenarios
- Access admin UI

#### GM Role

**Can:**
- Everything a player can do
- Create, edit, delete panels and widgets
- Modify all system states
- Execute scenarios
- View all panels regardless of visibility
- Access admin UI
- Override any restriction

---

## Operational Modes

### Player App Modes

```typescript
type PlayerMode = 'view' | 'interact';
```

| Mode      | Description                                    |
|-----------|------------------------------------------------|
| `view`    | Read-only observation (default)                |
| `interact`| Actions enabled (widget buttons, etc.)         |

Mode can be toggled by:
- GM setting (force read-only for dramatic moments)
- Role assignment (some stations are view-only)

### Admin App Modes

```typescript
type AdminMode = 'manage' | 'preview';
```

| Mode      | Description                                    |
|-----------|------------------------------------------------|
| `manage`  | Full editing capabilities                      |
| `preview` | See what players see (role simulation)         |

---

## Edit Mode (Panel Editing)

Within the admin app, panels have an edit mode:

```typescript
type EditMode = 'locked' | 'editing';
```

| Mode      | Behavior                                       |
|-----------|------------------------------------------------|
| `locked`  | Panel renders normally, no layout changes      |
| `editing` | Grid visible, widgets draggable/resizable      |

### Edit Mode Session

- Only one user should edit a panel at a time (advisory lock)
- Unsaved changes prompt before navigation
- Auto-save after 5 seconds of inactivity (configurable)
- Explicit save/discard buttons available

---

## Role Detection

### MVP: URL-Based

For MVP simplicity:
- `/admin/*` routes require GM role
- `/panel/*` routes available to all roles
- Role passed via query param or header for development: `?role=gm`

### Future: Token-Based

```typescript
interface Session {
  id: string;
  role: Role;
  device_id?: string;
  station_lock?: StationGroup;  // Optional station assignment
  created_at: string;
}
```

---

## Station Lock (Optional Feature)

A device can be "locked" to a station group:

```typescript
interface DeviceAssignment {
  device_id: string;
  ship_id: string;
  station_group: StationGroup;
  locked: boolean;  // If true, navigation restricted
}
```

When locked:
- Default view is the assigned station's primary panel
- Navigation shows other panels but with visual distinction
- GM can override from admin

---

## Permission Matrix

| Action                    | Player | GM  |
|---------------------------|--------|-----|
| View player panels        | Yes    | Yes |
| View GM-only panels       | No     | Yes |
| Navigate between panels   | Yes    | Yes |
| Perform widget actions    | Limited| Yes |
| Modify system states      | No     | Yes |
| Edit panel layouts        | No     | Yes |
| Create/delete widgets     | No     | Yes |
| Execute scenarios         | No     | Yes |
| Access admin UI           | No     | Yes |
| Reset ship state          | No     | Yes |

---

## API Authorization

All API endpoints check role:

```typescript
// Middleware pseudocode
function requireRole(minRole: Role) {
  return (req, res, next) => {
    const userRole = getRole(req);
    if (!hasPermission(userRole, minRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Usage
app.patch('/api/system-states/:id', requireRole('gm'), updateSystemState);
app.get('/api/panels/:id', requireRole('player'), getPanel);
```

---

## Acceptance Checks

- [ ] Player cannot access admin routes
- [ ] GM can view all panels
- [ ] Widget actions respect role permissions
- [ ] Edit mode is GM-only
- [ ] Role is detectable from request context
