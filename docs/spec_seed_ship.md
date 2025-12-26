# Seed Ship Specification (Task 0.6)

This document defines the **starter ship configuration** loaded on first run to demonstrate the HUD's capabilities.

---

## Ship Identity

```yaml
name: "ISV Constellation"
class: "Horizon-class Explorer"
registry: "ISV-7742"
description: "A versatile deep-space exploration vessel with modular systems."
```

---

## Station Groups & Panels

### Command (Bridge)

**Panel: Command Overview**
- Station Group: `command`
- Role Visibility: `player`, `gm`
- Purpose: Captain's bird's-eye view of ship status

Widgets:
- Title: "ISV Constellation - Command"
- Threat Posture + ROE widget
- Ship Log / Timeline widget (filtered to alerts + scenarios)
- Alert Feed widget
- System Overview cards:
  - Power Status (links to Engineering)
  - Hull Integrity (links to Life Support)
  - Propulsion Status (links to Engineering)
  - Sensor Status (links to Sensors)

### Engineering

**Panel: Engineering Main**
- Station Group: `engineering`
- Role Visibility: `player`, `gm`

Widgets:
- Title: "Engineering Station"
- Health Bar: Reactor Core (system_state: reactor)
- Health Bar: Power Grid (system_state: power_grid)
- Health Bar: Propulsion (system_state: engines)
- Health Bar: Fuel Reserves (system_state: fuel)
- Damage Control / Tasks Queue widget (filtered to engineering)
- System Dependency Graph (power → subsystems)

### Sensors & Communications

**Panel: Sensors**
- Station Group: `sensors`
- Role Visibility: `player`, `gm`

Widgets:
- Title: "Sensor Array"
- Sensor Sweep / Contact Tracker widget
- Health Bar: Long-Range Sensors (system_state: lr_sensors)
- Health Bar: Short-Range Sensors (system_state: sr_sensors)

**Panel: Communications**
- Station Group: `communications`
- Role Visibility: `player`, `gm`

Widgets:
- Title: "Communications Console"
- Incoming Transmission Console widget
- Health Bar: Comms Array (system_state: comms)
- Health Bar: Encryption Module (system_state: encryption)

### Life Support

**Panel: Life Support**
- Station Group: `life_support`
- Role Visibility: `player`, `gm`

Widgets:
- Title: "Environmental Control"
- Environment Summary widget
- Zone Details widget (selectable zones)
- Health Bar: Atmosphere Recyclers (system_state: atmo)
- Health Bar: Gravity Generators (system_state: gravity)
- Health Bar: Hull Integrity (system_state: hull)

### Tactical

**Panel: Tactical**
- Station Group: `tactical`
- Role Visibility: `player`, `gm`

Widgets:
- Title: "Tactical Station"
- Weapons / Assets widget
- Threat Posture indicator (read-only for non-command)
- Health Bar: Shields (system_state: shields)
- Health Bar: Point Defense (system_state: point_defense)

### Holomap (Optional)

**Panel: Deck Plan**
- Station Group: `command`
- Role Visibility: `player`, `gm`

Widgets:
- Title: "Deck Plan"
- Holomap / Deck Plan widget (background image + markers)

### Admin / GM

**Panel: GM Control**
- Station Group: `admin`
- Role Visibility: `gm`

Widgets:
- Title: "Game Master Console"
- Scenario list + execution buttons
- Quick state override controls
- Contacts / Dossiers summary
- Glitch intensity slider

---

## System States (Initial Values)

| System ID       | Name                | Status       | Value | Max  | Unit   |
|-----------------|---------------------|--------------|-------|------|--------|
| reactor         | Reactor Core        | operational  | 100   | 100  | %      |
| power_grid      | Power Grid          | operational  | 95    | 100  | %      |
| engines         | Main Engines        | operational  | 100   | 100  | %      |
| fuel            | Fuel Reserves       | operational  | 85    | 100  | %      |
| lr_sensors      | Long-Range Sensors  | operational  | 100   | 100  | %      |
| sr_sensors      | Short-Range Sensors | operational  | 100   | 100  | %      |
| comms           | Comms Array         | operational  | 100   | 100  | %      |
| encryption      | Encryption Module   | operational  | 100   | 100  | %      |
| atmo            | Atmosphere Recyclers| operational  | 100   | 100  | %      |
| gravity         | Gravity Generators  | operational  | 100   | 100  | %      |
| hull            | Hull Integrity      | operational  | 100   | 100  | %      |
| shields         | Shields             | operational  | 100   | 100  | %      |
| point_defense   | Point Defense       | operational  | 100   | 100  | %      |

---

## Datasets (Starter Data)

### Weapons Dataset

| Name               | Type     | Status       | Ammo | Max Ammo |
|--------------------|----------|--------------|------|----------|
| Forward Rail Gun   | Kinetic  | operational  | 120  | 150      |
| Missile Bay Alpha  | Missile  | operational  | 8    | 12       |
| Laser Array        | Energy   | operational  | -    | -        |
| Point Defense Grid | Auto     | operational  | 2000 | 2500     |

### Crew Roster (Contacts Dataset)

| Name            | Role         | Station      | Status    |
|-----------------|--------------|--------------|-----------|
| Cpt. Vasquez    | Captain      | Command      | active    |
| Lt. Chen        | Helm         | Command      | active    |
| Eng. Kowalski   | Chief Eng.   | Engineering  | active    |
| Dr. Okafor      | Medical      | Life Support | active    |
| Sgt. Reyes      | Tactical     | Tactical     | active    |
| Tech. Yamoto    | Sensors      | Sensors      | active    |

---

## Posture State (Initial)

```yaml
posture: green
roe:
  weapons_safeties: on
  comms_broadcast: open
  transponder: active
  sensor_emissions: standard
```

---

## Sample Scenarios

### Scenario: "Power Fluctuation"

```yaml
name: Power Fluctuation
description: Minor power grid instability
actions:
  - target: power_grid
    set_status: degraded
    set_value: 75
  - emit_event:
      type: alert
      severity: warning
      message: "Power grid fluctuation detected in Section 3"
```

### Scenario: "Hull Breach"

```yaml
name: Hull Breach - Cargo Bay
description: Micro-meteor impact causes decompression
actions:
  - target: hull
    set_status: compromised
    set_value: 80
  - spawn_incident:
      name: "Hull Breach - Cargo Bay 2"
      severity: critical
      linked_systems: [hull, atmo]
  - spawn_task:
      title: "Seal breach in Cargo Bay 2"
      station: engineering
      timer: 180  # seconds
      consequences_on_fail:
        - target: atmo
          set_status: degraded
          set_value: -10  # relative
  - emit_event:
      type: alert
      severity: critical
      message: "Hull breach detected in Cargo Bay 2!"
```

### Scenario: "Contact Detected"

```yaml
name: Unknown Contact
description: Sensors pick up an unidentified vessel
actions:
  - spawn_sensor_contact:
      label: "Unknown Vessel"
      confidence: 45
      iff: unknown
      threat: moderate
      range: "12,000 km"
      vector: "bearing 045, closing"
  - emit_event:
      type: alert
      severity: info
      message: "New contact detected - designating Bravo-1"
```

---

## Zones (Life Support)

| Zone ID     | Name           | Pressure | Temp | O2   | Radiation | Status      |
|-------------|----------------|----------|------|------|-----------|-------------|
| bridge      | Bridge         | 101      | 21   | 21%  | 0.1       | operational |
| engineering | Engineering    | 101      | 23   | 21%  | 0.3       | operational |
| cargo_1     | Cargo Bay 1    | 101      | 18   | 21%  | 0.1       | operational |
| cargo_2     | Cargo Bay 2    | 101      | 18   | 21%  | 0.1       | operational |
| crew_deck   | Crew Quarters  | 101      | 22   | 21%  | 0.1       | operational |
| medical     | Medical Bay    | 101      | 21   | 22%  | 0.0       | operational |

---

## Acceptance Checks

- [ ] Seed ship loads on first run
- [ ] All panels are accessible and display widgets
- [ ] System states reflect initial values
- [ ] Datasets populate table widgets
- [ ] Sample scenarios are executable by GM
- [ ] Posture state is visible on Command panel
