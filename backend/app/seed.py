"""
Seed data for ship setup.

Provides functions to create ships with optional demo data.
"""

import json
import uuid
from datetime import datetime
from typing import Literal, Optional

import aiosqlite


async def seed_database(db: aiosqlite.Connection):
    """Seed the database with the ISV Constellation starter ship on first boot."""
    await create_ship_with_seed(
        db=db,
        ship_id="constellation",
        ship_name="ISV Constellation",
        seed_type="full",
        ship_class="Horizon-class Explorer",
        registry="ISV-7742",
        description="A versatile deep-space exploration vessel with modular systems.",
        attributes={
            "reputation": 75,
            "morale": "steady",
            "crew_count": 42,
        },
    )


async def create_ship_with_seed(
    db: aiosqlite.Connection,
    ship_name: str,
    seed_type: Literal["blank", "full"],
    ship_id: Optional[str] = None,
    ship_class: Optional[str] = None,
    registry: Optional[str] = None,
    description: Optional[str] = None,
    attributes: Optional[dict] = None,
) -> str:
    """
    Create a new ship with optional seed data.

    Args:
        db: Database connection
        ship_name: Display name for the ship
        seed_type: "blank" for empty ship, "full" for demo data
        ship_id: Unique identifier (generated UUID if not provided)
        ship_class: Ship class/type
        registry: Ship registry number
        description: Ship description
        attributes: Additional ship attributes as JSON

    Returns:
        The created ship's ID
    """
    now = datetime.utcnow().isoformat()

    # Generate ship ID if not provided
    if ship_id is None:
        ship_id = str(uuid.uuid4())

    # Default attributes
    if attributes is None:
        attributes = {}

    # Create ship record
    await db.execute(
        """
        INSERT INTO ships (id, name, ship_class, registry, description, attributes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            ship_id,
            ship_name,
            ship_class,
            registry,
            description,
            json.dumps(attributes),
            now,
            now,
        ),
    )

    # Create posture state (required for all ships)
    await db.execute(
        """
        INSERT INTO posture_state (ship_id, posture, posture_set_at, posture_set_by, roe, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            ship_id,
            "green",
            now,
            "system",
            json.dumps(
                {
                    "weapons_safeties": "on",
                    "comms_broadcast": "open",
                    "transponder": "active",
                    "sensor_emissions": "standard",
                }
            ),
            now,
        ),
    )

    # Create glitch state (required for all ships)
    await db.execute(
        "INSERT INTO glitch_state (ship_id, intensity, panel_overrides, updated_at) VALUES (?, ?, ?, ?)",
        (ship_id, 0, "{}", now),
    )

    # If blank seed, we're done
    if seed_type == "blank":
        await db.commit()
        print(f"Created blank ship: {ship_name} ({ship_id})")
        return ship_id

    # Full seed: create all demo data
    await _seed_full_ship_data(db, ship_id, ship_name, now)

    await db.commit()
    print(f"Created ship with full seed: {ship_name} ({ship_id})")
    return ship_id


async def _seed_full_ship_data(
    db: aiosqlite.Connection,
    ship_id: str,
    ship_name: str,
    now: str,
):
    """Seed full demo data for a ship."""

    # Create system states with dependencies
    # Format: (id, name, status, value, max_val, unit, category, depends_on)
    systems = [
        ("reactor", "Reactor Core", "fully_operational", 100, 100, "%", "power", []),
        ("power_grid", "Power Grid", "operational", 95, 100, "%", "power", ["reactor"]),
        (
            "engines",
            "Main Engines",
            "fully_operational",
            100,
            100,
            "%",
            "propulsion",
            ["power_grid"],
        ),
        ("fuel", "Fuel Reserves", "operational", 85, 100, "%", "propulsion", []),
        (
            "lr_sensors",
            "Long-Range Sensors",
            "fully_operational",
            100,
            100,
            "%",
            "sensors",
            ["power_grid"],
        ),
        (
            "sr_sensors",
            "Short-Range Sensors",
            "fully_operational",
            100,
            100,
            "%",
            "sensors",
            ["power_grid"],
        ),
        ("comms", "Comms Array", "operational", 100, 100, "%", "communications", ["power_grid"]),
        (
            "encryption",
            "Encryption Module",
            "fully_operational",
            100,
            100,
            "%",
            "communications",
            ["comms"],
        ),
        (
            "atmo",
            "Atmosphere Recyclers",
            "fully_operational",
            100,
            100,
            "%",
            "life_support",
            ["power_grid"],
        ),
        (
            "gravity",
            "Gravity Generators",
            "fully_operational",
            100,
            100,
            "%",
            "life_support",
            ["power_grid"],
        ),
        ("hull", "Hull Integrity", "fully_operational", 100, 100, "%", "structure", []),
        ("shields", "Shields", "fully_operational", 100, 100, "%", "defense", ["power_grid"]),
        (
            "point_defense",
            "Point Defense",
            "fully_operational",
            100,
            100,
            "%",
            "defense",
            ["power_grid"],
        ),
    ]

    for sys_id, name, status, value, max_val, unit, category, depends_on in systems:
        # Use ship_id prefix to ensure unique IDs per ship
        full_sys_id = f"{ship_id}_{sys_id}"
        await db.execute(
            """
            INSERT INTO system_states (id, ship_id, name, status, value, max_value, unit, category, depends_on, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_sys_id,
                ship_id,
                name,
                status,
                value,
                max_val,
                unit,
                category,
                json.dumps([f"{ship_id}_{dep}" for dep in depends_on] if depends_on else []),
                now,
                now,
            ),
        )

    # Create panels
    panels = [
        ("command", "Command Overview", "command", 0, "Command"),
        ("engineering", "Engineering Station", "engineering", 0, "Engineering"),
        ("sensors", "Sensor Array", "sensors", 0, "Sensors"),
        ("comms", "Communications Console", "communications", 0, "Comms"),
        ("life_support", "Environmental Control", "life_support", 0, "Life Support"),
        ("tactical", "Tactical Station", "tactical", 0, "Tactical"),
        ("operations", "Ship Operations", "operations", 0, "Operations"),
    ]

    for panel_id, name, station, sort_order, desc in panels:
        # Use ship_id prefix for panel IDs
        full_panel_id = f"{ship_id}_{panel_id}"
        role_vis = '["player", "gm"]' if station != "admin" else '["gm"]'
        await db.execute(
            """
            INSERT INTO panels (id, ship_id, name, station_group, role_visibility, sort_order, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (full_panel_id, ship_id, name, station, role_vis, sort_order, desc, now, now),
        )

    # Create widgets for Command panel
    command_widgets = [
        ("title", 0, 0, 24, 2, {"text": f"{ship_name} - Command"}, {}),
        (
            "status_display",
            3,
            20,
            6,
            4,
            {"title": "Power Status"},
            {"system_state_id": f"{ship_id}_power_grid"},
        ),
        ("status_display", 5, 16, 6, 4, {"title": "Hull Status"}, {"system_state_id": f"{ship_id}_hull"}),
        ("status_display", 15, 20, 6, 4, {"title": "Propulsion"}, {"system_state_id": f"{ship_id}_engines"}),
        (
            "status_display",
            13,
            24,
            6,
            4,
            {"title": "Long-Range Sensors"},
            {"system_state_id": f"{ship_id}_lr_sensors"},
        ),
        (
            "status_display",
            5,
            24,
            6,
            4,
            {"title": "Short-Range Sensors"},
            {"system_state_id": f"{ship_id}_sr_sensors"},
        ),
        ("status_display", 13, 16, 6, 4, {"title": "Shields"}, {"system_state_id": f"{ship_id}_shields"}),
        ("alert_feed", 0, 2, 13, 12, {"max_items": 10}, {}),
        ("posture_display", 13, 2, 11, 12, {}, {}),
        ("spacer", 0, 14, 24, 2, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in command_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                f"{ship_id}_command",
                wtype,
                x,
                y,
                w,
                h,
                json.dumps(config),
                json.dumps(bindings),
                now,
                now,
            ),
        )

    # Create widgets for Engineering panel
    engineering_widgets = [
        ("title", 0, 0, 24, 2, {"text": "Engineering Station"}, {}),
        ("health_bar", 0, 2, 12, 4, {"title": "Reactor Core"}, {"system_state_id": f"{ship_id}_reactor"}),
        (
            "status_display",
            12,
            2,
            12,
            4,
            {"title": "Power Grid"},
            {"system_state_id": f"{ship_id}_power_grid"},
        ),
        ("health_bar", 0, 6, 12, 4, {"title": "Main Engines"}, {"system_state_id": f"{ship_id}_engines"}),
        ("health_bar", 12, 6, 12, 4, {"title": "Fuel Reserves"}, {"system_state_id": f"{ship_id}_fuel"}),
        ("system_dependencies", 5, 10, 14, 16, {"station_filter": "engineering"}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in engineering_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                f"{ship_id}_engineering",
                wtype,
                x,
                y,
                w,
                h,
                json.dumps(config),
                json.dumps(bindings),
                now,
                now,
            ),
        )

    # Create widgets for Operations panel
    operation_widgets = [
        ("title", 0, 0, 24, 2, {"text": "Operations"}, {}),
        ("holomap", 14, 2, 10, 14, {}, {}),
        ("data_table", 0, 2, 14, 14, {"dataSource": "cargo"}, {}),
        (
            "task_queue",
            0,
            16,
            12,
            10,
            {},
            {},
        ),
        ("ship_log", 12, 16, 12, 10, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in operation_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                f"{ship_id}_operations",
                wtype,
                x,
                y,
                w,
                h,
                json.dumps(config),
                json.dumps(bindings),
                now,
                now,
            ),
        )

    # Create widgets for Sensors panel
    sensors_widgets = [
        ("title", 0, 0, 24, 2, {"text": "Sensor Array"}, {}),
        (
            "status_display",
            0,
            2,
            12,
            4,
            {"title": "Long-Range Sensors"},
            {"system_state_id": f"{ship_id}_lr_sensors"},
        ),
        (
            "status_display",
            12,
            2,
            12,
            4,
            {"title": "Short-Range Sensors"},
            {"system_state_id": f"{ship_id}_sr_sensors"},
        ),
        ("contact_tracker", 0, 6, 24, 16, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in sensors_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                f"{ship_id}_sensors",
                wtype,
                x,
                y,
                w,
                h,
                json.dumps(config),
                json.dumps(bindings),
                now,
                now,
            ),
        )

    # Create widgets for Communications panel
    comms_widgets = [
        ("title", 0, 0, 24, 2, {"text": "Communications Console"}, {}),
        ("status_display", 9, 2, 7, 4, {"title": "Comms Array"}, {"system_state_id": f"{ship_id}_comms"}),
        (
            "status_display",
            9,
            6,
            7,
            4,
            {"title": "Encryption Module"},
            {"system_state_id": f"{ship_id}_encryption"},
        ),
        ("transmission_console", 8, 10, 16, 16, {"pinnedContactIds": [f"{ship_id}_merchant_lee"]}, {}),
        ("contact_tracker", 0, 2, 8, 24, {"pinnedContactIds": [f"{ship_id}_merchant_lee"]}, {}),
        ("status_display", 17, 2, 6, 4, {}, {"system_state_id": f"{ship_id}_sr_sensors"}),
        ("status_display", 17, 6, 6, 4, {}, {"system_state_id": f"{ship_id}_lr_sensors"}),
    ]

    for wtype, x, y, w, h, config, bindings in comms_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                f"{ship_id}_comms",
                wtype,
                x,
                y,
                w,
                h,
                json.dumps(config),
                json.dumps(bindings),
                now,
                now,
            ),
        )

    # Create widgets for Life Support panel
    life_support_widgets = [
        ("title", 0, 0, 24, 2, {"text": "Environmental Control"}, {}),
        ("status_display", 0, 4, 8, 4, {"title": "Atmosphere"}, {"system_state_id": f"{ship_id}_atmo"}),
        ("status_display", 8, 4, 8, 4, {"title": "Gravity"}, {"system_state_id": f"{ship_id}_gravity"}),
        ("health_bar", 16, 4, 8, 4, {"title": "Hull Integrity"}, {"system_state_id": f"{ship_id}_hull"}),
        ("environment_summary", 0, 8, 24, 12, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in life_support_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                f"{ship_id}_life_support",
                wtype,
                x,
                y,
                w,
                h,
                json.dumps(config),
                json.dumps(bindings),
                now,
                now,
            ),
        )

    # Create widgets for Tactical panel
    tactical_widgets = [
        ("title", 0, 0, 24, 2, {"text": "Tactical Station"}, {}),
        ("health_bar", 0, 2, 8, 4, {"title": "Shields"}, {"system_state_id": f"{ship_id}_shields"}),
        (
            "status_display",
            16,
            2,
            8,
            4,
            {"title": "Point Defense"},
            {"system_state_id": f"{ship_id}_point_defense"},
        ),
        (
            "health_bar",
            8,
            2,
            8,
            4,
            {"title": "Hull Integrity"},
            {"system_state_id": f"{ship_id}_hull"},
        ),
        (
            "asset_display",
            2,
            6,
            10,
            7,
            {},
            {"asset_id": f"{ship_id}_asset_plasma_lance"},
        ),
        ("asset_display", 12, 6, 10, 7, {}, {"asset_id": f"{ship_id}_asset_torpedoes_fore"}),
        (
            "asset_display",
            2,
            14,
            10,
            7,
            {},
            {"asset_id": f"{ship_id}_asset_pdc_port"},
        ),
        (
            "asset_display",
            12,
            14,
            10,
            7,
            {},
            {"asset_id": f"{ship_id}_asset_pdc_starboard"},
        ),
        (
            "data_table",
            0,
            22,
            24,
            12,
            {"dataSource": "assets"},
            {},
        ),
    ]

    for wtype, x, y, w, h, config, bindings in tactical_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                f"{ship_id}_tactical",
                wtype,
                x,
                y,
                w,
                h,
                json.dumps(config),
                json.dumps(bindings),
                now,
                now,
            ),
        )

    # Create sample scenarios
    scenarios = [
        (
            "power_fluctuation",
            "Power Fluctuation",
            "Minor power grid instability",
            [
                {"type": "set_status", "target": f"{ship_id}_power_grid", "value": "degraded"},
                {"type": "set_value", "target": f"{ship_id}_power_grid", "value": 75},
                {
                    "type": "emit_event",
                    "data": {
                        "type": "alert",
                        "severity": "warning",
                        "message": "Power grid fluctuation detected in Section 3",
                    },
                },
            ],
        ),
        (
            "hull_breach",
            "Hull Breach - Cargo Bay",
            "Micro-meteor impact causes decompression",
            [
                {"type": "set_status", "target": f"{ship_id}_hull", "value": "compromised"},
                {"type": "set_value", "target": f"{ship_id}_hull", "value": 80},
                {
                    "type": "emit_event",
                    "data": {
                        "type": "alert",
                        "severity": "critical",
                        "message": "Hull breach detected in Cargo Bay 2!",
                    },
                },
            ],
        ),
        (
            "red_alert",
            "Red Alert",
            "Set ship to red alert posture",
            [
                {"type": "set_posture", "value": "red"},
                {
                    "type": "emit_event",
                    "data": {
                        "type": "red_alert",
                        "severity": "critical",
                        "message": "All hands to battle stations!",
                    },
                },
            ],
        ),
    ]

    for scen_id, name, desc, actions in scenarios:
        full_scen_id = f"{ship_id}_{scen_id}"
        await db.execute(
            """
            INSERT INTO scenarios (id, ship_id, name, description, actions, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (full_scen_id, ship_id, name, desc, json.dumps(actions), now, now),
        )

    # Create sample contacts
    contacts_data = [
        (
            "dock_master",
            "Station Dock Master",
            "Frontier Station Alpha",
            "neutral",
            "Dock Authority",
            "Standard docking procedures",
            '["station", "official"]',
        ),
        (
            "merchant_lee",
            "Captain Lee",
            "Independent Trader",
            "friendly",
            "Merchant Captain",
            "Reliable trader, fair prices",
            '["trader", "ally"]',
        ),
        (
            "unknown_vessel",
            "Unknown Vessel",
            None,
            "unknown",
            "Unknown",
            "Unidentified ship, no response to hails",
            '["mystery"]',
        ),
    ]

    for contact_id, name, affiliation, threat_level, role, notes, tags in contacts_data:
        full_contact_id = f"{ship_id}_{contact_id}"
        await db.execute(
            """
            INSERT INTO contacts (id, ship_id, name, affiliation, threat_level, role, notes, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (full_contact_id, ship_id, name, affiliation, threat_level, role, notes, tags, now, now),
        )

    # Create crew members
    crew_members = [
        {
            "id": "crew_captain_zhang",
            "name": "Captain Mei Zhang",
            "role": "Captain",
            "status": "fit_for_duty",
            "player_name": None,
            "is_npc": 1,
            "notes": f"Commanding officer of {ship_name}. Former UNN Navy, 15 years experience.",
            "condition_tags": [],
        },
        {
            "id": "crew_chief_engineer",
            "name": "Chief Engineer Kowalski",
            "role": "Chief Engineer",
            "status": "fit_for_duty",
            "player_name": None,
            "is_npc": 1,
            "notes": "Responsible for reactor and propulsion systems. Known for creative solutions.",
            "condition_tags": [],
        },
        {
            "id": "crew_pilot_chen",
            "name": "Lt. David Chen",
            "role": "Pilot",
            "status": "fit_for_duty",
            "player_name": "Alex",
            "is_npc": 0,
            "notes": "Primary helmsman. Exceptional reflexes, trained in combat maneuvers.",
            "condition_tags": [],
        },
        {
            "id": "crew_medic_okonkwo",
            "name": "Dr. Amara Okonkwo",
            "role": "Chief Medical Officer",
            "status": "light_duty",
            "player_name": "Sam",
            "is_npc": 0,
            "notes": "Ship's surgeon and medical lead. Currently recovering from minor injury.",
            "condition_tags": ["recovering"],
        },
        {
            "id": "crew_sensors_park",
            "name": "Ensign Ji-Yeon Park",
            "role": "Sensors Operator",
            "status": "fit_for_duty",
            "player_name": None,
            "is_npc": 1,
            "notes": "Fresh from the Academy. Eager and detail-oriented.",
            "condition_tags": [],
        },
        {
            "id": "crew_security_reyes",
            "name": "Sgt. Marcus Reyes",
            "role": "Security Chief",
            "status": "incapacitated",
            "player_name": None,
            "is_npc": 1,
            "notes": "Head of ship security. Currently in medical bay after EVA accident.",
            "condition_tags": ["concussed", "broken_ribs"],
        },
    ]

    for crew in crew_members:
        full_crew_id = f"{ship_id}_{crew['id']}"
        await db.execute(
            """
            INSERT INTO crew (id, ship_id, name, role, status, player_name, is_npc, notes, condition_tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_crew_id,
                ship_id,
                crew["name"],
                crew["role"],
                crew["status"],
                crew["player_name"],
                crew["is_npc"],
                crew["notes"],
                json.dumps(crew["condition_tags"]),
                now,
                now,
            ),
        )

    # Create sample sensor contact
    await db.execute(
        """
        INSERT INTO sensor_contacts (id, ship_id, label, contact_id, confidence, iff, threat, range_km, bearing_deg, vector,
                                     signal_strength, first_detected_at, last_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            ship_id,
            "Contact Bravo-1",
            f"{ship_id}_unknown_vessel",
            45,
            "unknown",
            "moderate",
            12000.0,
            45.0,
            "closing, 0.2c",
            72,
            now,
            now,
        ),
    )

    # Create assets (weapons, drones, probes)
    assets = [
        {
            "id": "asset_pdc_port",
            "name": "Port PDC Array",
            "asset_type": "railgun",
            "status": "operational",
            "ammo_current": 2400,
            "ammo_max": 3000,
            "ammo_type": "20mm",
            "range": 5.0,
            "range_unit": "km",
            "damage": 45.0,
            "accuracy": 85.0,
            "charge_time": 0.1,
            "cooldown": 0.05,
            "fire_mode": "auto",
            "is_armed": 0,
            "is_ready": 1,
            "mount_location": "port",
        },
        {
            "id": "asset_pdc_starboard",
            "name": "Starboard PDC Array",
            "asset_type": "railgun",
            "status": "operational",
            "ammo_current": 2850,
            "ammo_max": 3000,
            "ammo_type": "20mm",
            "range": 5.0,
            "range_unit": "km",
            "damage": 45.0,
            "accuracy": 85.0,
            "charge_time": 0.1,
            "cooldown": 0.05,
            "fire_mode": "auto",
            "is_armed": 0,
            "is_ready": 1,
            "mount_location": "starboard",
        },
        {
            "id": "asset_plasma_lance",
            "name": "Plasma Lance Alpha",
            "asset_type": "particle_beam",
            "status": "operational",
            "ammo_current": 0,
            "ammo_max": 0,
            "ammo_type": None,
            "range": 50.0,
            "range_unit": "km",
            "damage": 850.0,
            "accuracy": 92.0,
            "charge_time": 8.0,
            "cooldown": 15.0,
            "fire_mode": "single",
            "is_armed": 0,
            "is_ready": 1,
            "mount_location": "dorsal",
        },
        {
            "id": "asset_torpedoes_fore",
            "name": "Fore Torpedo Bay",
            "asset_type": "torpedo",
            "status": "operational",
            "ammo_current": 8,
            "ammo_max": 12,
            "ammo_type": "Mk-VII",
            "range": 2000.0,
            "range_unit": "km",
            "damage": 1200.0,
            "accuracy": 78.0,
            "charge_time": 3.0,
            "cooldown": 12.0,
            "fire_mode": "burst",
            "is_armed": 0,
            "is_ready": 1,
            "mount_location": "fore",
        },
        {
            "id": "asset_drone_01",
            "name": "Scout Drone Alpha",
            "asset_type": "drone",
            "status": "operational",
            "ammo_current": 0,
            "ammo_max": 0,
            "ammo_type": None,
            "range": 500.0,
            "range_unit": "km",
            "damage": None,
            "accuracy": None,
            "charge_time": None,
            "cooldown": None,
            "fire_mode": None,
            "is_armed": 0,
            "is_ready": 1,
            "mount_location": None,
        },
        {
            "id": "asset_probe_01",
            "name": "Deep Space Probe",
            "asset_type": "probe",
            "status": "operational",
            "ammo_current": 0,
            "ammo_max": 0,
            "ammo_type": None,
            "range": 10000.0,
            "range_unit": "AU",
            "damage": None,
            "accuracy": None,
            "charge_time": None,
            "cooldown": None,
            "fire_mode": None,
            "is_armed": 0,
            "is_ready": 1,
            "mount_location": None,
        },
    ]

    for asset in assets:
        full_asset_id = f"{ship_id}_{asset['id']}"
        await db.execute(
            """
            INSERT INTO assets (
                id, ship_id, name, asset_type, status,
                ammo_current, ammo_max, ammo_type,
                range, range_unit, damage, accuracy,
                charge_time, cooldown, fire_mode,
                is_armed, is_ready, current_target,
                mount_location, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_asset_id,
                ship_id,
                asset["name"],
                asset["asset_type"],
                asset["status"],
                asset["ammo_current"],
                asset["ammo_max"],
                asset["ammo_type"],
                asset["range"],
                asset["range_unit"],
                asset["damage"],
                asset["accuracy"],
                asset["charge_time"],
                asset["cooldown"],
                asset["fire_mode"],
                asset["is_armed"],
                asset["is_ready"],
                None,  # current_target
                asset["mount_location"],
                now,
                now,
            ),
        )

    # Create cargo inventory
    cargo_items = [
        {
            "id": "cargo_fuel_cells",
            "name": "Fusion Fuel Cells",
            "category": "Fuel & Energy",
            "quantity": 450,
            "unit": "cells",
            "description": "High-density deuterium fuel cells for reactor",
            "value": 1250.0,
            "location": "Cargo Bay 1",
        },
        {
            "id": "cargo_food_rations",
            "name": "Emergency Rations",
            "category": "Life Support",
            "quantity": 2800,
            "unit": "units",
            "description": "Long-term emergency food supplies",
            "value": 15.0,
            "location": "Cargo Bay 2",
        },
        {
            "id": "cargo_spare_parts",
            "name": "Engineering Spare Parts",
            "category": "Maintenance",
            "quantity": 185,
            "unit": "crates",
            "description": "General mechanical and electronic components",
            "value": 850.0,
            "location": "Engineering Storage",
        },
        {
            "id": "cargo_medical",
            "name": "Medical Supplies",
            "category": "Medical",
            "quantity": 95,
            "unit": "kits",
            "description": "Trauma kits and pharmaceuticals",
            "value": 420.0,
            "location": "Medical Bay",
        },
        {
            "id": "cargo_water",
            "name": "Water Reserves",
            "category": "Life Support",
            "quantity": 12500,
            "unit": "liters",
            "description": "Purified water for life support and reactor cooling",
            "value": 5.0,
            "location": "Tanks A-D",
        },
        {
            "id": "cargo_ammunition",
            "name": "PDC Ammunition",
            "category": "Ordnance",
            "quantity": 18000,
            "unit": "rounds",
            "description": "20mm tungsten rounds for point defense cannons",
            "value": 12.0,
            "location": "Armory",
        },
        {
            "id": "cargo_torpedoes",
            "name": "Mk-VII Torpedoes",
            "category": "Ordnance",
            "quantity": 4,
            "unit": "torpedoes",
            "description": "Ship-to-ship torpedoes in storage",
            "value": 85000.0,
            "location": "Torpedo Magazine",
        },
        {
            "id": "cargo_coolant",
            "name": "Reactor Coolant",
            "category": "Fuel & Energy",
            "quantity": 3200,
            "unit": "liters",
            "description": "Specialized coolant for reactor systems",
            "value": 45.0,
            "location": "Engineering",
        },
        {
            "id": "cargo_trade_goods",
            "name": "Colonial Trade Goods",
            "category": "Trade",
            "quantity": 50,
            "unit": "containers",
            "description": "Miscellaneous goods for trade at stations",
            "value": 2200.0,
            "location": "Cargo Bay 3",
        },
        {
            "id": "cargo_oxygen",
            "name": "Oxygen Canisters",
            "category": "Life Support",
            "quantity": 280,
            "unit": "canisters",
            "description": "Compressed oxygen for life support backup",
            "value": 65.0,
            "location": "Life Support",
        },
    ]

    for cargo in cargo_items:
        full_cargo_id = f"{ship_id}_{cargo['id']}"
        await db.execute(
            """
            INSERT INTO cargo (
                id, ship_id, name, category, quantity, unit, description, value, location,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_cargo_id,
                ship_id,
                cargo["name"],
                cargo["category"],
                cargo["quantity"],
                cargo["unit"],
                cargo["description"],
                cargo["value"],
                cargo["location"],
                now,
                now,
            ),
        )

    # Create holomap layers and markers
    holomap_layers = [
        {
            "id": "layer_deck_1",
            "name": "Deck 1 - Command",
            "deck_level": "1",
            "sort_order": 1,
        },
        {
            "id": "layer_deck_2",
            "name": "Deck 2 - Operations",
            "deck_level": "2",
            "sort_order": 2,
        },
        {
            "id": "layer_deck_3",
            "name": "Deck 3 - Engineering",
            "deck_level": "3",
            "sort_order": 3,
        },
        {
            "id": "layer_deck_4",
            "name": "Deck 4 - Cargo",
            "deck_level": "4",
            "sort_order": 4,
        },
    ]

    for layer in holomap_layers:
        full_layer_id = f"{ship_id}_{layer['id']}"
        await db.execute(
            """
            INSERT INTO holomap_layers (
                id, ship_id, name, image_url, deck_level, sort_order, visible, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_layer_id,
                ship_id,
                layer["name"],
                "placeholder",
                layer["deck_level"],
                layer["sort_order"],
                1,
                now,
                now,
            ),
        )

    holomap_markers = [
        {
            "id": "marker_bridge",
            "layer_id": "layer_deck_1",
            "type": "crew",
            "x": 0.5,
            "y": 0.15,
            "severity": None,
            "label": "Bridge",
            "description": "Command and control center",
        },
        {
            "id": "marker_sensor_station",
            "layer_id": "layer_deck_1",
            "type": "objective",
            "x": 0.25,
            "y": 0.35,
            "severity": "info",
            "label": "Sensor Array",
            "description": "Primary sensor control station",
        },
        {
            "id": "marker_cargo_hazard",
            "layer_id": "layer_deck_4",
            "type": "hazard",
            "x": 0.3,
            "y": 0.5,
            "severity": "warning",
            "label": "Unstable Cargo",
            "description": "Magnetic containment fluctuation detected in container 7-Alpha",
        },
        {
            "id": "marker_reactor",
            "layer_id": "layer_deck_3",
            "type": "objective",
            "x": 0.5,
            "y": 0.3,
            "severity": None,
            "label": "Main Reactor",
            "description": "Fusion reactor core access",
        },
        {
            "id": "marker_crew_quarters",
            "layer_id": "layer_deck_1",
            "type": "crew",
            "x": 0.5,
            "y": 0.6,
            "severity": None,
            "label": "Crew Quarters",
            "description": "Primary crew sleeping quarters",
        },
    ]

    for marker in holomap_markers:
        full_marker_id = f"{ship_id}_{marker['id']}"
        full_layer_id = f"{ship_id}_{marker['layer_id']}"
        await db.execute(
            """
            INSERT INTO holomap_markers (
                id, layer_id, type, x, y, severity, label, description,
                linked_incident_id, linked_task_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_marker_id,
                full_layer_id,
                marker["type"],
                marker["x"],
                marker["y"],
                marker["severity"],
                marker["label"],
                marker["description"],
                None,
                None,
                now,
                now,
            ),
        )

    # Create initial event
    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, transmitted, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            ship_id,
            "system_boot",
            "info",
            f"{ship_name} systems online. All stations nominal.",
            json.dumps({"source": "seed"}),
            1,  # transmitted = true
            now,
        ),
    )

    # Create sample transmission events
    transmissions = [
        {
            "sender_name": "Station Epsilon",
            "channel": "hail",
            "encrypted": False,
            "signal_strength": 95,
            "frequency": "127.3 MHz",
            "text": f"{ship_name.split()[-1]}, this is Station Epsilon. Docking clearance approved for Bay 7. Transmitting approach vector now.",
        },
        {
            "sender_name": "ISV Normandy",
            "channel": "hail",
            "encrypted": False,
            "signal_strength": 82,
            "frequency": "127.3 MHz",
            "text": f"{ship_name.split()[-1]}, requesting formation alignment. Ready to proceed to waypoint Delta on your mark.",
        },
        {
            "sender_name": "Unknown Vessel",
            "channel": "encrypted",
            "encrypted": True,
            "signal_strength": 67,
            "frequency": "Classified",
            "text": "[ENCRYPTED TRANSMISSION]",
        },
        {
            "sender_name": "Deep Space Relay 7",
            "channel": "broadcast",
            "encrypted": False,
            "signal_strength": 45,
            "frequency": "Standard Beacon",
            "text": "Attention all vessels: Solar flare activity detected in sectors 7 through 12. Recommend reduced sensor emissions.",
        },
        {
            "sender_name": "Outpost Sigma",
            "channel": "distress",
            "encrypted": False,
            "signal_strength": 38,
            "frequency": "Emergency",
            "text": "Mayday, mayday! This is Outpost Sigma. Reactor breach imminent. Requesting immediate evacuation assistance. Repeat, reactor breach imminent!",
        },
    ]

    for idx, tx in enumerate(transmissions):
        await db.execute(
            """
            INSERT INTO events (id, ship_id, type, severity, message, data, transmitted, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"{ship_id}_tx-{idx + 1}",
                ship_id,
                "transmission_received",
                "critical" if tx["channel"] == "distress" else "info",
                f"Incoming transmission from {tx['sender_name']}",
                json.dumps(tx),
                1,  # transmitted = true (visible to players)
                now,
            ),
        )
