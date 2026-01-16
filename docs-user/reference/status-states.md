# Status States

Every system in Starship HUD uses a consistent status model. This page documents all status states, their visual representation, and behavior.

## Status Overview

| Status | Color | Icon Shape | Motion | Meaning |
|--------|-------|------------|--------|---------|
| **Operational** | Green | Circle | Stable | System functioning normally |
| **Degraded** | Amber/Yellow-Green | Triangle | Mild flicker | Reduced capacity, attention needed |
| **Compromised** | Orange | Diamond | Intermittent glitch | Significant issues, action required |
| **Critical** | Red | Diamond | Pulsing | Imminent failure, immediate action |
| **Destroyed** | Deep Red | X | Inert | Non-functional, cannot be repaired |
| **Offline** | Gray | Hollow Circle | None | Intentionally disabled |

## Visual Design

### Color + Shape

Status is **never** communicated by color alone. Each status has a distinct icon shape as a fallback for colorblind users:

- **Circle** = good (operational)
- **Triangle** = warning (degraded)
- **Diamond** = danger (compromised, critical)
- **X** = dead (destroyed)
- **Hollow** = inactive (offline)

### Motion Semantics

Animation reinforces status meaning:

- **Stable** - No motion, steady state
- **Mild flicker** - Occasional subtle flicker, something's not quite right
- **Intermittent glitch** - More pronounced, irregular disruption
- **Pulsing** - Rhythmic urgency, demands attention
- **Inert** - No animation, system is dead

### Glow Effects

Status colors also affect ambient glow around widgets:

- Operational: subtle cyan/green glow
- Degraded: amber glow
- Critical: red pulsing glow
- Offline/Destroyed: no glow

## Status Transitions

### Normal Flow

```
operational ↔ degraded ↔ compromised ↔ critical → destroyed
```

Systems can move up or down in severity based on:

- Damage events
- Repair actions
- Cascade effects from dependencies
- Scenario actions

### Terminal State

**Destroyed** is a terminal state. Once a system is destroyed, it cannot transition to any other state without GM override.

### Offline

Any non-destroyed system can be taken offline and brought back online:

```
operational → offline → operational
degraded → offline → degraded
```

Offline represents intentional deactivation, not damage.

## Alert Thresholds

Status affects how alerts are generated and displayed:

| Status | Alert Level | Visibility |
|--------|-------------|------------|
| Operational | None | - |
| Degraded | Info | Station only |
| Compromised | Warning | Station-level |
| Critical | Critical | Ship-wide |
| Destroyed | Critical | Ship-wide |
| Offline | Info | Station only |

## Status in Widgets

### Status Display Widget

Shows the status directly with color, icon, and label:

```
┌─────────────────────┐
│ ● REACTOR           │  ← Green circle = operational
└─────────────────────┘

┌─────────────────────┐
│ ▲ REACTOR           │  ← Amber triangle = degraded
└─────────────────────┘

┌─────────────────────┐
│ ◆ REACTOR           │  ← Red diamond = critical
└─────────────────────┘
```

### Health Bar Widget

Color changes based on the underlying value:

- 70-100%: Green
- 40-69%: Amber
- 0-39%: Red

The bar also reflects system status through border glow.

### System Dependencies Widget

Shows status cascade - when a parent system degrades, children show their effective status accounting for the degradation.

## CSS Reference

For advanced customization, status colors are defined as CSS custom properties:

```css
--status-operational: #3fb950;
--status-degraded: #d4a72c;
--status-compromised: #db6d28;
--status-critical: #f85149;
--status-destroyed: #8b0000;
--status-offline: #6e7681;
```

Status-specific CSS classes:

```css
.status-operational { }
.status-degraded { }
.status-compromised { }
.status-critical { }
.status-destroyed { }
.status-offline { }
```

## Best Practices

### For GMs

- **Use the full range** - Don't jump straight to critical; build tension through degraded → compromised
- **Combine status with narrative** - A status change is more impactful with a transmission or event
- **Consider dependencies** - Degrading a core system affects everything that depends on it

### For Panel Design

- **Show key systems prominently** - Critical systems deserve larger widgets
- **Group related systems** - Engineering panel shows power systems together
- **Include a mix** - Show both status indicators and health bars for important systems
