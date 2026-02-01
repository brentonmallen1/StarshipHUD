# Game Master Guide

As the GM, you control the ship behind the scenes while players see the immersive bridge console. This guide covers how to use the admin panel to run compelling sessions.

## Accessing the Admin Panel

1. Open Starship HUD in your browser
2. Click the role switcher (top right) and select **GM**
3. You'll see the admin navigation with access to all ship management tools

The admin panel is separate from the player view. You can have both open in different tabs—one to manage, one to see what players see.

## The Admin Dashboard

The GM Dashboard gives you a quick overview:

- **Ship status at a glance** - Overall health and active issues
- **Quick Scenarios** - One-click access to prepared scenarios
- **Recent events** - What's happened recently
- **Active tasks** - Work the crew is handling

## Managing Ship Systems

### Systems Page

The **Systems** page shows all ship systems with their current status and values. Here you can:

- **View system health** - See current value, status, and any limiting factors
- **Adjust values directly** - Click to edit a system's numeric value
- **Change status** - Override calculated status when needed
- **See dependencies** - Understand which systems affect others

### Status Cascade

Systems can have parent-child relationships. When a parent system degrades, its children are capped at that status:

```
Reactor (compromised)
└── Life Support (capped at compromised)
└── Shields (capped at compromised)
```

Use this to create dramatic cascading failures—damage the reactor and watch dependent systems struggle.

### Assets Page

The **Assets** page manages weapons, drones, probes, and other deployable equipment:

- **Track ammunition** - Current and maximum counts
- **Set readiness** - Armed, ready, or offline
- **Manage status** - Operational, damaged, destroyed

## Designing Panels

The **Panels** page is where you build the bridge stations your players see.

### Panel Concepts

Each panel represents a bridge station or display:

- **Command** - Captain's overview of ship status
- **Engineering** - Reactor, power distribution, damage control
- **Operations** - Sensors, contacts, task management
- **Helm** - Navigation, maneuvering, course plotting
- **Tactical** - Weapons, shields, threat assessment
- **Communications** - Transmissions, signals, contacts

You can create panels for any role your game needs.

### The Panel Editor

1. Click **Edit** on a panel to open the editor
2. Drag widgets from the palette onto the grid
3. Resize widgets by dragging their edges
4. Click a widget to configure its bindings (which data it displays)
5. Save when finished

### Widget Bindings

Widgets need to know what data to display. Common bindings include:

- **system_id** - Which system this widget monitors
- **station_group** - Which station's tasks to show
- **data_source** - Where to pull tabular data

See the [Widget Reference](../reference/widgets.md) for binding details on each widget type.

## Running Sessions

### Pre-Session Setup

Before your players arrive:

1. **Check panel layouts** - Make sure each station shows what you want
2. **Prepare scenarios** - Create or review scenarios for planned events
3. **Set initial state** - Adjust system values to your starting conditions
4. **Clear old data** - Remove stale tasks, incidents, or contacts if needed

### During Play

#### Direct Manipulation

For improvised moments, manipulate state directly:

- **Systems** - Change values and status on the fly
- **Alerts** - Create alerts that appear in the alert feed
- **Tasks** - Spawn tasks for specific stations
- **Transmissions** - Send messages that appear on consoles
- **Contacts** - Add or update sensor contacts

#### Running Scenarios

For prepared sequences:

1. Go to **Scenarios**
2. Click **Run** on your scenario
3. Watch as actions execute in sequence

Players see status changes, receive transmissions, and get tasks—all timed as you designed.

Tip: Use **Rehearse** to test scenarios before running them live.

#### Creating Tension

Build dramatic moments:

- **Start small** - A warning indicator, a minor system fluctuation
- **Escalate gradually** - More systems affected, higher severity
- **Give players agency** - Spawn tasks they can succeed or fail at
- **Use timing** - Delays between scenario actions create anticipation

### Between Sessions

After a session:

1. **Review the ship log** - See what happened for continuity notes
2. **Adjust panels** - Refine layouts based on what worked
3. **Create new scenarios** - Script upcoming plot points
4. **Reset if needed** - Use the admin to restore systems for next time

## Managing Contacts

The **Contacts** page handles other ships, stations, and entities:

- **Create contacts** - Name, type, faction, threat level
- **Set positions** - For radar display
- **Add dossiers** - Background information players can discover
- **Control visibility** - What players can see vs. classified info

Contacts appear on the radar widget and contact tracker.

## Transmissions

The **Transmissions** page manages incoming messages:

- **Create transmissions** - From contacts, stations, or unknown sources
- **Set priority** - Normal, urgent, critical
- **Queue or send immediately** - Timed delivery or instant
- **Control visibility** - Which stations receive which messages

Transmissions create narrative moments—distress calls, warnings, orders from command.

## Crew Management

The **Crew** page tracks personnel:

- **Create crew members** - Name, role, assigned station
- **Set conditions** - Healthy, injured, incapacitated
- **Track status** - On duty, off duty, in medical

The crew status widget shows this information to relevant stations (medical, command).

## Tips for GMs

### Keep It Immersive

- **Don't over-explain** - Let the interface tell the story
- **Use transmissions** - In-character messages are more engaging than narration
- **Let failures happen** - Expired tasks and failed scenarios create drama

### Manage Cognitive Load

- **Start simple** - One or two panels, basic systems
- **Add complexity gradually** - More stations as players get comfortable
- **Don't overwhelm** - Not every system needs constant attention

### Prepare but Improvise

- **Script the big moments** - Scenarios for plot beats
- **React in real-time** - Direct manipulation for everything else
- **Have fallbacks** - Scenarios for common situations (combat, damage, travel)

### Use the Right Tool

| Situation | Use This |
|-----------|----------|
| Planned dramatic moment | Scenario |
| Player rolled badly | Direct system adjustment |
| New contact arrives | Contacts page + transmission |
| Something needs crew attention | Spawn a task |
| Background event | Alert or ship log event |

## See Also

- [Scenarios](scenarios.md) - Detailed scenario authoring guide
- [Panels](panels.md) - Panel design and widget placement
- [Widget Reference](../reference/widgets.md) - All available widgets
- [Status States](../reference/status-states.md) - Status colors and meanings
