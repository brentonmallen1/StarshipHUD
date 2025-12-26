# Threat Posture & ROE Specification (Task 0.9)

This document defines the **posture system** and **Rules of Engagement (ROE)** — ship-wide stance that affects behavior and appearance.

---

## Posture Levels

Posture is a single source-of-truth state for the ship's operational stance.

| Posture  | Color Tint | Description                           | Typical Trigger          |
|----------|------------|---------------------------------------|--------------------------|
| `green`  | None/Cyan  | Normal operations, all clear          | Default / stand-down     |
| `yellow` | Amber      | Elevated readiness, potential threat  | Contact detected         |
| `red`    | Red        | Combat ready, imminent danger         | Hostile contact / attack |

### Special Postures (Optional Extensions)

| Posture         | Color Tint  | Description                              |
|-----------------|-------------|------------------------------------------|
| `silent_running`| Dark Blue   | Minimal emissions, stealth mode          |
| `general_quarters`| Red + Pulse | All hands to stations, emergency       |

---

## Posture State Model

```typescript
interface PostureState {
  ship_id: string;

  // Current posture
  posture: Posture;
  posture_set_at: string;
  posture_set_by: string;  // 'gm', 'scenario', or player ID

  // ROE toggles
  roe: RulesOfEngagement;

  // Metadata
  updated_at: string;
}

type Posture = 'green' | 'yellow' | 'red' | 'silent_running' | 'general_quarters';

interface RulesOfEngagement {
  weapons_safeties: 'on' | 'off';
  comms_broadcast: 'open' | 'encrypted' | 'silent';
  transponder: 'active' | 'masked' | 'off';
  sensor_emissions: 'standard' | 'reduced' | 'passive_only';
}
```

---

## ROE Toggles

Each ROE toggle has specific effects:

### Weapons Safeties

| Value | Effect                                                |
|-------|-------------------------------------------------------|
| `on`  | Weapons cannot fire (confirmation required to disable)|
| `off` | Weapons hot, ready to fire                            |

### Comms Broadcast

| Value       | Effect                                             |
|-------------|----------------------------------------------------|
| `open`      | Standard communications                            |
| `encrypted` | Transmissions encrypted, slight delay              |
| `silent`    | No transmissions (receive only)                    |

### Transponder

| Value    | Effect                                              |
|----------|-----------------------------------------------------|
| `active` | Ship identity broadcast normally                    |
| `masked` | False/generic identity (may draw suspicion)         |
| `off`    | No transponder signal (highly suspicious)           |

### Sensor Emissions

| Value         | Effect                                           |
|---------------|--------------------------------------------------|
| `standard`    | Full active scanning                             |
| `reduced`     | Limited active scanning, harder to detect        |
| `passive_only`| No emissions, receive only (reduced capability)  |

---

## Effects on Systems

### Visual Theming

Posture affects global UI chrome:

```typescript
interface PostureTheme {
  posture: Posture;
  borderColor: string;
  glowColor: string;
  backgroundColor: string;
  alertBarStyle: 'normal' | 'pulsing' | 'urgent';
  ambientAnimation: 'calm' | 'active' | 'urgent';
}

const postureThemes: Record<Posture, PostureTheme> = {
  green: {
    borderColor: '#00ffcc',
    glowColor: 'rgba(0, 255, 204, 0.1)',
    backgroundColor: '#0a1a1a',
    alertBarStyle: 'normal',
    ambientAnimation: 'calm'
  },
  yellow: {
    borderColor: '#ffcc00',
    glowColor: 'rgba(255, 204, 0, 0.15)',
    backgroundColor: '#1a1500',
    alertBarStyle: 'pulsing',
    ambientAnimation: 'active'
  },
  red: {
    borderColor: '#ff3300',
    glowColor: 'rgba(255, 51, 0, 0.2)',
    backgroundColor: '#1a0800',
    alertBarStyle: 'urgent',
    ambientAnimation: 'urgent'
  },
  silent_running: {
    borderColor: '#3366ff',
    glowColor: 'rgba(51, 102, 255, 0.05)',
    backgroundColor: '#050810',
    alertBarStyle: 'normal',
    ambientAnimation: 'calm'
  },
  general_quarters: {
    borderColor: '#ff0000',
    glowColor: 'rgba(255, 0, 0, 0.25)',
    backgroundColor: '#1a0000',
    alertBarStyle: 'urgent',
    ambientAnimation: 'urgent'
  }
};
```

### Widget Behavior Changes

| Widget Type      | Posture Effect                                    |
|------------------|---------------------------------------------------|
| Alert Feed       | Filters/prioritizes by posture                    |
| Sensor Tracker   | Noise level changes with emissions profile        |
| Comms Console    | Encryption indicator, transmission delays         |
| Weapons Widget   | Safety indicator prominent, affects actions       |
| Threat Posture   | Current stance display, toggle controls           |

### Mini-Game Modifiers

| Posture  | Modifier                                           |
|----------|---------------------------------------------------|
| `yellow` | stress: 0.3 (mild time pressure feeling)          |
| `red`    | stress: 0.6 (significant pressure)                |
| `silent_running` | low_power: 0.3 (dimmed displays)           |
| `general_quarters` | stress: 0.8 (maximum pressure)            |

---

## Alert Threshold Adjustments

Posture affects what triggers ship-wide alerts:

```typescript
interface AlertThresholds {
  // Value thresholds that trigger alerts
  critical_below: number;
  warning_below: number;
}

const thresholdsByPosture: Record<Posture, AlertThresholds> = {
  green: { critical_below: 20, warning_below: 40 },
  yellow: { critical_below: 25, warning_below: 50 },
  red: { critical_below: 30, warning_below: 60 },
  silent_running: { critical_below: 15, warning_below: 35 },
  general_quarters: { critical_below: 35, warning_below: 70 }
};
```

---

## Database Schema

```sql
CREATE TABLE posture_state (
  ship_id TEXT PRIMARY KEY REFERENCES ships(id),
  posture TEXT NOT NULL DEFAULT 'green' CHECK(posture IN ('green', 'yellow', 'red', 'silent_running', 'general_quarters')),
  posture_set_at TEXT NOT NULL DEFAULT (datetime('now')),
  posture_set_by TEXT NOT NULL DEFAULT 'gm',
  roe TEXT NOT NULL DEFAULT '{"weapons_safeties":"on","comms_broadcast":"open","transponder":"active","sensor_emissions":"standard"}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## API Endpoints

```
# Posture state
GET    /api/ships/:id/posture         # Get current posture and ROE
PATCH  /api/ships/:id/posture         # Update posture
PATCH  /api/ships/:id/roe             # Update ROE toggles

# Quick actions
POST   /api/ships/:id/posture/red-alert     # Set red alert
POST   /api/ships/:id/posture/stand-down    # Return to green
```

### Update Posture Request

```typescript
{
  posture: Posture;
  reason?: string;  // Optional note for log
}
```

### Update ROE Request

```typescript
{
  weapons_safeties?: 'on' | 'off';
  comms_broadcast?: 'open' | 'encrypted' | 'silent';
  transponder?: 'active' | 'masked' | 'off';
  sensor_emissions?: 'standard' | 'reduced' | 'passive_only';
}
```

---

## Event Emissions

| Event Type       | When                    | Payload                       |
|------------------|-------------------------|-------------------------------|
| `posture_changed`| Posture level changed   | old, new, reason, set_by      |
| `roe_changed`    | Any ROE toggle changed  | toggle_name, old, new, set_by |
| `red_alert`      | Posture set to red      | reason, set_by                |
| `stand_down`     | Posture returned to green| from_posture, set_by         |

---

## Posture Widget Spec

The Threat Posture + ROE widget displays:

**Read-Only Mode (Players on non-command stations)**:
- Current posture indicator (large, prominent)
- ROE status summary (icons or text)

**Interactive Mode (Command station / GM)**:
- Posture selector (buttons or dial)
- ROE toggles (switches or buttons)
- Confirmation for critical changes (weapons off, red alert)

```
┌─────────────────────────────────────────┐
│  THREAT POSTURE                         │
├─────────────────────────────────────────┤
│                                         │
│    ┌───────┐  ┌───────┐  ┌───────┐     │
│    │ GREEN │  │YELLOW │  │  RED  │     │
│    │  ●    │  │       │  │       │     │
│    └───────┘  └───────┘  └───────┘     │
│                                         │
├─────────────────────────────────────────┤
│  RULES OF ENGAGEMENT                    │
├─────────────────────────────────────────┤
│  Weapons:      [■ SAFE]  [ ] HOT        │
│  Comms:        [■ OPEN] [ENC] [SILENT]  │
│  Transponder:  [■ ACTIVE] [MASK] [OFF]  │
│  Sensors:      [■ STD] [REDUCED] [PASS] │
└─────────────────────────────────────────┘
```

---

## Posture Transitions

### Automatic Suggestions (GM decides)

The system can suggest posture changes:
- Contact detected with threat > moderate → suggest yellow
- Contact IFF hostile → suggest red
- All hostiles cleared → suggest stand-down

These are suggestions, not automatic changes.

### Scenario Actions

```yaml
actions:
  - set_posture: red
    emit_event:
      type: red_alert
      message: "All hands to battle stations!"
```

---

## Acceptance Checks

- [ ] Posture is a single source-of-truth state
- [ ] Changing posture updates global chrome (tint, animations)
- [ ] ROE toggles are independently controllable
- [ ] Posture change emits events
- [ ] Widgets reflect posture state
- [ ] GM can override posture from any panel
