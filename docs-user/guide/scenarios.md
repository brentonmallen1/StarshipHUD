# Scenarios

Scenarios are pre-scripted narrative sequences that automate ship state changes during play. They let GMs prepare dramatic moments in advance and execute them with a single click.

## Scenario Concepts

### What Scenarios Do

A scenario is a sequence of **actions** that happen over time:

- Change system status (reactor goes critical)
- Adjust system values (shields drop to 50%)
- Spawn incidents (hull breach in cargo bay)
- Create tasks (repair the conduit)
- Send transmissions (incoming distress call)
- Emit events (for the ship log)

### When to Use Scenarios

Scenarios work best for:

- **Planned narrative beats** - The ambush you know is coming
- **Complex cascades** - Multiple systems failing in sequence
- **Timed events** - Things that happen at specific intervals
- **Reusable situations** - Common encounters you run often

For improvised moments, use direct admin controls instead.

## Creating Scenarios (Admin)

In the admin panel, navigate to **Scenarios** to manage your scripted sequences.

### Basic Structure

A scenario consists of:

1. **Name** - Identifier for the scenario
2. **Description** - What this scenario represents
3. **Actions** - The sequence of things that happen

### Action Types

| Action | What It Does |
|--------|--------------|
| `set_status` | Change a system's status (operational → critical) |
| `adjust_value` | Change a system's numeric value |
| `spawn_incident` | Create a new incident |
| `spawn_task` | Create a task for a station |
| `send_transmission` | Queue a message to players |
| `emit_event` | Add an entry to the ship log |
| `delay` | Wait before the next action |

### Example: Reactor Overload

A scenario for a reactor emergency might include:

1. **emit_event** - "Power fluctuation detected in main reactor"
2. **delay** - 5 seconds
3. **set_status** - Reactor → degraded
4. **spawn_task** - "Stabilize reactor core" (Engineering, 60s timer)
5. **delay** - 30 seconds
6. **adjust_value** - Reactor power output -20%
7. **set_status** - Reactor → compromised
8. **spawn_incident** - "Reactor instability" (major severity)

## Running Scenarios

### Direct Execution

From the Scenarios list:

1. Find the scenario you want to run
2. Click **Run**
3. Actions execute in sequence

The scenario runs in real-time. Players see status changes, tasks appear, transmissions arrive.

### Rehearsal Mode

Test scenarios before running them live:

1. Click **Rehearse** instead of Run
2. Scenario executes against a snapshot of current state
3. See what would happen without affecting the real ship
4. Exit rehearsal to discard changes

!!! tip "Always Rehearse First"
    Run new scenarios in rehearsal mode during prep to catch timing issues or unintended effects.

### Stopping a Scenario

If a scenario is running and you need to stop it:

1. Go to the active scenarios view
2. Click **Stop** on the running scenario
3. Remaining actions are cancelled

Actions already executed are not rolled back.

## Incidents and Tasks

Scenarios often spawn incidents and tasks. Understanding these systems helps design better scenarios.

### Incidents

An **incident** is an ongoing situation affecting the ship:

- Has a name, description, and severity
- Can link to affected systems
- Progresses through states: active → contained → resolved (or failed)

**Incident Severities:**

| Severity | Meaning |
|----------|---------|
| Minor | Annoyance, low priority |
| Moderate | Needs attention soon |
| Major | Significant problem |
| Critical | Immediate threat |

### Tasks

A **task** is work for the crew to complete:

- Assigned to a specific station
- Can have time limits
- Success/failure triggers consequences

**Task Flow:**

```
pending → active (claimed) → succeeded/failed/expired
```

**Task Consequences:**

Tasks can trigger effects on completion:

- **on_success** - What happens if completed successfully
- **on_failure** - What happens if failed
- **on_expire** - What happens if the timer runs out

Example: A "Seal hull breach" task might:

- On success: Set hull integrity to operational
- On failure: Spawn follow-up task, reduce atmosphere
- On expire: Set hull to critical, spawn evacuation incident

## Scenario Design Tips

### Pacing

- **Build tension gradually** - Start with warnings, escalate to crisis
- **Use delays** - Give players time to react between beats
- **Leave room for player agency** - Tasks let players affect outcomes

### Branching

Scenarios are linear, but you can create branching through task consequences:

- Task success prevents escalation
- Task failure triggers additional scenario or incident
- Multiple tasks with different stations create coordination challenges

### Reusability

Design scenarios for reuse:

- Keep them focused (one situation per scenario)
- Use generic system names that match your ship
- Document expected starting conditions

### Testing

Always test scenarios:

1. **Read through** - Do the actions make sense in order?
2. **Rehearse** - Run in rehearsal mode to see timing
3. **Adjust** - Tweak delays and values based on testing
4. **Document** - Note what state the ship should be in before running

## Example Scenarios

### Combat Encounter

**"Hostile Contact Engagement"**

1. emit_event: "Hostile contact on intercept course"
2. send_transmission: Warning from hostile vessel
3. delay: 10s
4. set_status: Shields → degraded
5. spawn_task: "Reinforce forward shields" (Ops, 30s)
6. delay: 20s
7. spawn_incident: "Taking fire" (moderate)
8. adjust_value: Hull integrity -15%

### System Failure

**"Life Support Cascade"**

1. emit_event: "Anomaly in atmospheric processors"
2. delay: 5s
3. set_status: Life support → degraded
4. spawn_task: "Diagnose life support fault" (Engineering, 45s)
5. delay: 30s
6. adjust_value: Atmosphere quality -10%
7. set_status: Life support → compromised
8. spawn_incident: "Atmospheric contamination" (major)

### Dramatic Arrival

**"Distress Signal"**

1. emit_event: "Receiving transmission on emergency frequency"
2. delay: 3s
3. send_transmission: Garbled distress call
4. spawn_task: "Clean up signal" (Operations, 20s)
5. delay: 15s
6. send_transmission: Clear distress message with coordinates
7. spawn_incident: "Rescue operation" (moderate)
