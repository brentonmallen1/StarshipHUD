# First Run

After installing Starship HUD, here's how to get oriented and start using it.

## Accessing the HUD

Starship HUD has two main interfaces:

| URL | Purpose |
|-----|---------|
| `http://your-server:8000` | **Player View** - Station panels and the main HUD |
| `http://your-server:8000/admin` | **Admin Panel** - GM controls and configuration |

## The Demo Ship

On first run, Starship HUD creates a demo ship called **"ISS Horizon"** with:

- Pre-configured system states (reactor, life support, engines, etc.)
- Sample panels for different stations
- Example contacts and transmissions
- Demonstration scenarios

This gives you a working example to explore before building your own ship.

## Player View Walkthrough

### Navigation

The player view shows panels organized by station. Use the navigator (typically in a corner) to switch between available panels:

- **Bridge** - Command overview and posture controls
- **Engineering** - Reactor, power, and system health
- **Operations** - Sensors, communications, and contacts
- **Helm** - Navigation and maneuvering

### Reading the Interface

Panels display ship status through widgets. Key things to notice:

- **Colors indicate status** - Green is good, yellow needs attention, red is critical
- **Icons provide redundancy** - Status is never communicated by color alone
- **Motion has meaning** - Flickering or pulsing indicates degraded/critical states

### Interacting

Some widgets are interactive:

- **Task Queue** - Claim tasks assigned to your station, mark them complete
- **Posture Display** - Change ship threat posture (if permitted)
- **Contact Tracker** - Pin contacts, expand dossiers

## Admin Panel Walkthrough

Access the admin panel at `/admin`. You'll need to enter your `ADMIN_TOKEN`.

### Dashboard

The admin dashboard shows:

- Ship overview with all system states
- Active incidents and tasks
- Quick actions for common operations

### Key Admin Sections

**Panels** - View and edit panel layouts

- Add, remove, and resize widgets
- Configure widget bindings to system states
- Preview how panels look at different sizes

**System States** - Direct control of ship systems

- Change status (operational → degraded → critical, etc.)
- Adjust numeric values
- Apply glitch effects

**Scenarios** - Pre-scripted narrative sequences

- Create scenarios with timed actions
- Test with rehearsal mode
- Run live during sessions

**Transmissions** - Send messages to players

- Queue transmissions for dramatic timing
- Mark as read/unread

**Contacts** - Manage sensor contacts

- Create ships, stations, and anomalies
- Set threat levels and affiliations
- Add dossier information

## Verification Checklist

After setup, verify everything works:

- [ ] Homepage loads at `/`
- [ ] Panel index shows available stations
- [ ] At least one panel displays widgets correctly
- [ ] Admin dashboard is accessible at `/admin`
- [ ] System states update when modified in admin
- [ ] Data persists after container restart

## Next Steps

1. **[Learn about panels](../guide/panels.md)** - Understand how to design your own station layouts
2. **[Explore widgets](../guide/widgets.md)** - See all available widget types
3. **[Set up scenarios](../guide/scenarios.md)** - Create narrative sequences for your sessions
