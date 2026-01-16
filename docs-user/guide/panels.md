# Panels

Panels are the primary interface for players. Each panel represents a station view - a collection of widgets arranged like a physical instrument console.

## Panel Concepts

### Panels vs Widgets

- **Panels** define layout and composition - where things go on screen
- **Widgets** render data and provide interaction - what's displayed

Think of a panel as a physical console, and widgets as the individual gauges, displays, and controls mounted on it.

### No-Scroll Design

Panels are designed to fit entirely within the viewport, like a real bridge console. They never require scrolling to see all information. This constraint keeps information dense but accessible.

## Viewing Panels

### Player Navigation

Players navigate between panels using the on-screen navigator. The navigator style varies by configuration but typically appears as:

- A station selector dial
- A tabbed console interface
- A corner menu

### Panel Index

The main player view (`/`) shows available panels grouped by station. Players can:

- See which panels exist for their station
- Navigate directly to a specific panel
- View a summary of the ship's overall state

## Creating Panels (Admin)

In the admin panel, navigate to **Panels** to manage panel layouts.

### Creating a New Panel

1. Click **Add Panel**
2. Enter panel details:
    - **Name** - Display name (e.g., "Engineering Main")
    - **Station** - Which crew role sees this panel
    - **Description** - Optional description
3. Save to create an empty panel

### The Grid System

Panels use a **24-column grid** with **20px row height**. This provides fine-grained control over widget placement.

- Widgets snap to grid cells
- Each widget has minimum size requirements
- The grid ensures consistent spacing

### Adding Widgets

1. Open a panel in edit mode
2. Click **Add Widget** or drag from the widget catalog
3. Select widget type from the categorized list
4. Position and resize the widget on the grid
5. Configure widget settings (bindings, labels, etc.)

### Widget Bindings

Most widgets need to be "bound" to data sources:

| Binding Type | Purpose | Example |
|--------------|---------|---------|
| `system_state_id` | Single system | Health bar showing reactor status |
| `system_state_ids` | Multiple systems | Dependencies graph |
| `dataset_id` | Tabular data | Data table widget |
| None | Self-contained | Title, divider, spacer |

### Positioning Tips

- **Group related information** - Keep status displays near their controls
- **Use visual hierarchy** - Important info at eye level (upper portion)
- **Leave breathing room** - Don't pack every pixel; spacers help
- **Test at target resolution** - Ensure nothing clips or overlaps

## Panel Best Practices

### Station-Specific Design

Design panels for their audience:

- **Bridge** - High-level overview, posture controls, alert feed
- **Engineering** - Detailed system status, health bars, dependencies
- **Operations** - Sensors, contacts, communications
- **Helm** - Navigation data, radar, maneuvering status

### Information Density

Balance density with readability:

- Use compact widgets for secondary information
- Reserve larger widgets for critical displays
- Leverage layout widgets (dividers, spacers) to create visual sections

### Responsive Considerations

Panels are designed for a target resolution (typically 1920x1080). If players use different screen sizes:

- Smaller screens may require simplified panels
- Consider creating variant panels for different display sizes
- Test on actual player hardware before sessions

## Panel Examples

### Engineering Overview

A typical engineering panel might include:

- **Title** - "Engineering Station"
- **Health Bars** - Reactor, power grid, life support
- **Status Displays** - Individual system states
- **System Dependencies** - Visual graph of system relationships
- **Task Queue** - Engineering-assigned tasks
- **Alert Feed** - Recent alerts

### Tactical Display

A tactical panel might include:

- **Radar** - Polar display of sensor contacts
- **Contact Tracker** - Detailed contact list
- **Posture Display** - Current threat posture
- **Alert Feed** - Combat-relevant alerts

## Troubleshooting

### Widgets Overlap

- Check widget positions in edit mode
- Ensure no widgets share the same grid cells
- Resize widgets to fit their content

### Panel Doesn't Fit Screen

- Panel may be designed for a larger resolution
- Remove or shrink widgets to fit
- Consider creating a compact variant

### Widget Shows "No Data"

- Check widget bindings in edit mode
- Ensure the bound system state exists
- Verify the system state has data
