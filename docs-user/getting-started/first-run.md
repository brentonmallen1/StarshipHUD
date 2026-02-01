# First Run

After installing Starship HUD, here's how to get oriented and start using it.

## Accessing the HUD

Open your browser to `http://localhost:7891` (or your server's IP if running remotely).

The HUD has two modes:

| Mode | How to Access | Purpose |
|------|---------------|---------|
| **Player** | Default view | Station panels and the immersive HUD |
| **GM** | Click role switcher (top right) | Admin controls and configuration |

## The Demo Ship

On first run, Starship HUD creates a demo ship called **ISV Constellation** with:

- Pre-configured system states (reactor, life support, shields, weapons, etc.)
- Sample panels for different stations (Command, Engineering, Operations, Tactical, Comms)
- Example contacts and transmissions
- Demonstration scenarios you can run

This gives you a working example to explore before building your own ship.

## Player View Walkthrough

### Navigation

The player view shows panels organized by station. Use the panel selector to switch between available panels:

- **Command** - Captain's overview and posture controls
- **Engineering** - Reactor, power, and system dependencies
- **Operations** - Sensors, radar, and contacts
- **Tactical** - Weapons, shields, and threat assessment
- **Comms** - Transmissions and communications

### Reading the Interface

Panels display ship status through widgets. Key things to notice:

- **Colors indicate status** - Green is good, amber needs attention, red is critical
- **Shapes provide redundancy** - Status is never communicated by color alone (circles, triangles, diamonds)
- **Motion has meaning** - Flickering or pulsing indicates degraded/critical states

### Interacting

Some widgets are interactive:

- **Task Queue** - Claim tasks assigned to your station, mark them complete
- **Posture Display** - Change ship threat posture (if permitted)
- **Contact Tracker** - Pin contacts, expand dossiers for more information

## GM Mode Walkthrough

Click the role switcher in the top right and select **GM** to access admin controls.

### Dashboard

The GM dashboard shows:

- Ship overview with quick status summary
- Quick scenario buttons for one-click drama
- Active tasks and recent events

### Key Admin Sections

Access these from the admin navigation:

**Systems** - Direct control of ship systems

- View all systems and their current status
- Change status (operational, degraded, critical, etc.)
- Adjust numeric values

**Panels** - View and edit panel layouts

- Add, remove, and resize widgets
- Configure widget bindings to system states
- Preview how panels look

**Scenarios** - Pre-scripted narrative sequences

- Create scenarios with timed actions
- Test with rehearsal mode before running live
- Execute during sessions for dramatic moments

**Transmissions** - Send messages to players

- Create transmissions from contacts or unknown sources
- Control timing and priority

**Contacts** - Manage sensor contacts and dossiers

- Create ships, stations, and other entities
- Set threat levels and affiliations
- Add background information

**Crew** - Track personnel aboard

- Create crew members with roles and status
- Track conditions (injured, incapacitated, etc.)

## Try It Out

Here's a quick way to see the system in action:

1. **Open the Command panel** in player mode
2. **Switch to GM mode** in another browser tab
3. **Go to Scenarios** in the admin panel
4. **Run the "Reactor Warning" scenario** (or similar)
5. **Watch the Command panel** update with alerts and status changes

## Verification Checklist

After setup, verify everything works:

- [ ] Homepage loads and shows panels
- [ ] You can switch between panels
- [ ] Widgets display data (not empty or errored)
- [ ] GM mode is accessible via role switcher
- [ ] System states update when modified in admin
- [ ] Data persists after stopping and starting containers

## Next Steps

1. **[Read the GM Guide](../guide/gm-guide.md)** - Learn how to run sessions
2. **[Read the Player Guide](../guide/player-guide.md)** - Understand the interface
3. **[Learn about panels](../guide/panels.md)** - Design your own station layouts
4. **[Explore widgets](../reference/widgets.md)** - See all 22 available widget types
5. **[Set up scenarios](../guide/scenarios.md)** - Create narrative sequences
