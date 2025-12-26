# Status Model Specification (Task 0.1)

This document defines the **canonical status model** for all system states in the Starship HUD.

---

## Status Enum

All system states use a consistent status enumeration:

| Status       | Severity | Color        | Motion Semantic      | Description                          |
|--------------|----------|--------------|----------------------|--------------------------------------|
| `operational`| 0        | Green        | Stable               | System functioning normally          |
| `degraded`   | 1        | Yellow-Green | Mild flicker         | Reduced capacity, attention needed   |
| `compromised`| 2        | Amber/Orange | Intermittent glitch  | Significant issues, action required  |
| `critical`   | 3        | Red-Orange   | Pulsing urgency      | Imminent failure, immediate action   |
| `destroyed`  | 4        | Deep Red     | Inert/dead           | System non-functional, unrepairable  |
| `offline`    | 5        | Gray         | Muted/no motion      | Intentionally disabled or unavailable|

---

## Status Transition Rules

### Valid Transitions

```
operational <-> degraded <-> compromised <-> critical -> destroyed
     ^              ^              ^             |
     |              |              |             v
     +----------- offline <--------+-------------+
```

### Constraints

1. **Terminal States**: `destroyed` is terminal; no transitions out without GM override
2. **Offline**: Any non-terminal state can transition to `offline` and back
3. **Severity Direction**: States can move in any severity direction based on events
4. **Transition Events**: All status changes MUST emit a `status_change` event

---

## Status-Derived Behaviors

### Alert Thresholds

| Status       | Alert Level | Global Visibility |
|--------------|-------------|-------------------|
| `operational`| None        | No                |
| `degraded`   | Info        | No                |
| `compromised`| Warning     | Station-level     |
| `critical`   | Critical    | Ship-wide         |
| `destroyed`  | Critical    | Ship-wide         |
| `offline`    | Info        | Station-level     |

### Widget Rendering

Widgets displaying status MUST:
1. Use the canonical color for the status
2. Apply appropriate motion semantics (CSS class or animation)
3. Include a text label or icon fallback (never color alone)

---

## Status Representation

### Database Schema

```sql
-- status stored as TEXT enum
status TEXT CHECK(status IN ('operational', 'degraded', 'compromised', 'critical', 'destroyed', 'offline')) NOT NULL DEFAULT 'operational'
```

### API Contract

```typescript
type SystemStatus =
  | 'operational'
  | 'degraded'
  | 'compromised'
  | 'critical'
  | 'destroyed'
  | 'offline';

interface StatusTransition {
  from: SystemStatus;
  to: SystemStatus;
  reason: string;
  timestamp: string; // ISO 8601
}
```

---

## Acceptance Checks

- [ ] All system states use the canonical status enum
- [ ] Status transitions emit events
- [ ] UI components render status with correct color + motion
- [ ] Color is never the only status indicator
