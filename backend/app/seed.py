"""
Seed data for initial ship setup.
"""

import json
import uuid
from datetime import datetime

import aiosqlite


async def seed_database(db: aiosqlite.Connection):
    """Seed the database with the ISV Constellation starter ship."""
    now = datetime.utcnow().isoformat()

    # Create ship
    ship_id = "constellation"
    ship_attributes = {
        "reputation": 75,
        "morale": "steady",
        "crew_count": 42,
    }
    await db.execute(
        """
        INSERT INTO ships (id, name, ship_class, registry, description, attributes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            ship_id,
            "ISV Constellation",
            "Horizon-class Explorer",
            "ISV-7742",
            "A versatile deep-space exploration vessel with modular systems.",
            json.dumps(ship_attributes),
            now,
            now,
        ),
    )

    # Create posture state
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
            json.dumps({
                "weapons_safeties": "on",
                "comms_broadcast": "open",
                "transponder": "active",
                "sensor_emissions": "standard",
            }),
            now,
        ),
    )

    # Create glitch state
    await db.execute(
        "INSERT INTO glitch_state (ship_id, intensity, panel_overrides, updated_at) VALUES (?, ?, ?, ?)",
        (ship_id, 0, "{}", now),
    )

    # Create system states
    systems = [
        ("reactor", "Reactor Core", "operational", 100, 100, "%", "power"),
        ("power_grid", "Power Grid", "operational", 95, 100, "%", "power"),
        ("engines", "Main Engines", "operational", 100, 100, "%", "propulsion"),
        ("fuel", "Fuel Reserves", "operational", 85, 100, "%", "propulsion"),
        ("lr_sensors", "Long-Range Sensors", "operational", 100, 100, "%", "sensors"),
        ("sr_sensors", "Short-Range Sensors", "operational", 100, 100, "%", "sensors"),
        ("comms", "Comms Array", "operational", 100, 100, "%", "communications"),
        ("encryption", "Encryption Module", "operational", 100, 100, "%", "communications"),
        ("atmo", "Atmosphere Recyclers", "operational", 100, 100, "%", "life_support"),
        ("gravity", "Gravity Generators", "operational", 100, 100, "%", "life_support"),
        ("hull", "Hull Integrity", "operational", 100, 100, "%", "structure"),
        ("shields", "Shields", "operational", 100, 100, "%", "defense"),
        ("point_defense", "Point Defense", "operational", 100, 100, "%", "defense"),
    ]

    for sys_id, name, status, value, max_val, unit, category in systems:
        await db.execute(
            """
            INSERT INTO system_states (id, ship_id, name, status, value, max_value, unit, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (sys_id, ship_id, name, status, value, max_val, unit, category, now, now),
        )

    # Create panels
    panels = [
        ("command", "Command Overview", "command", 0, "Command"),
        ("engineering", "Engineering Station", "engineering", 0, "Engineering"),
        ("sensors", "Sensor Array", "sensors", 0, "Sensors"),
        ("comms", "Communications Console", "communications", 0, "Comms"),
        ("life_support", "Environmental Control", "life_support", 0, "Life Support"),
        ("tactical", "Tactical Station", "tactical", 0, "Tactical"),
        ("gm_control", "GM Control", "admin", 0, "Admin"),
    ]

    for panel_id, name, station, sort_order, desc in panels:
        role_vis = '["player", "gm"]' if station != "admin" else '["gm"]'
        await db.execute(
            """
            INSERT INTO panels (id, ship_id, name, station_group, role_visibility, sort_order, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (panel_id, ship_id, name, station, role_vis, sort_order, desc, now, now),
        )

    # Create widgets for Command panel
    command_widgets = [
        ("title", 0, 0, 12, 2, {"text": "ISV Constellation - Command"}, {}),
        ("status_display", 0, 2, 3, 2, {"title": "Power Status"}, {"system_state_id": "power_grid"}),
        ("status_display", 3, 2, 3, 2, {"title": "Hull Status"}, {"system_state_id": "hull"}),
        ("status_display", 6, 2, 3, 2, {"title": "Propulsion"}, {"system_state_id": "engines"}),
        ("status_display", 9, 2, 3, 2, {"title": "Sensors"}, {"system_state_id": "lr_sensors"}),
        ("alert_feed", 0, 4, 6, 10, {"max_items": 10}, {}),
        ("posture_display", 6, 4, 6, 6, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in command_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), "command", wtype, x, y, w, h, json.dumps(config), json.dumps(bindings), now, now),
        )

    # Create widgets for Engineering panel
    engineering_widgets = [
        ("title", 0, 0, 12, 2, {"text": "Engineering Station"}, {}),
        ("health_bar", 0, 2, 6, 2, {"title": "Reactor Core"}, {"system_state_id": "reactor"}),
        ("health_bar", 6, 2, 6, 2, {"title": "Power Grid"}, {"system_state_id": "power_grid"}),
        ("health_bar", 0, 4, 6, 2, {"title": "Main Engines"}, {"system_state_id": "engines"}),
        ("health_bar", 6, 4, 6, 2, {"title": "Fuel Reserves"}, {"system_state_id": "fuel"}),
        ("task_queue", 0, 6, 12, 10, {"station_filter": "engineering"}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in engineering_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), "engineering", wtype, x, y, w, h, json.dumps(config), json.dumps(bindings), now, now),
        )

    # Create widgets for Sensors panel
    sensors_widgets = [
        ("title", 0, 0, 12, 2, {"text": "Sensor Array"}, {}),
        ("health_bar", 0, 2, 6, 2, {"title": "Long-Range Sensors"}, {"system_state_id": "lr_sensors"}),
        ("health_bar", 6, 2, 6, 2, {"title": "Short-Range Sensors"}, {"system_state_id": "sr_sensors"}),
        ("contact_tracker", 0, 4, 12, 8, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in sensors_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), "sensors", wtype, x, y, w, h, json.dumps(config), json.dumps(bindings), now, now),
        )

    # Create widgets for Communications panel
    comms_widgets = [
        ("title", 0, 0, 12, 2, {"text": "Communications Console"}, {}),
        ("health_bar", 0, 2, 6, 2, {"title": "Comms Array"}, {"system_state_id": "comms"}),
        ("health_bar", 6, 2, 6, 2, {"title": "Encryption Module"}, {"system_state_id": "encryption"}),
        ("transmission_console", 0, 4, 12, 8, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in comms_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), "comms", wtype, x, y, w, h, json.dumps(config), json.dumps(bindings), now, now),
        )

    # Create widgets for Life Support panel
    life_support_widgets = [
        ("title", 0, 0, 12, 2, {"text": "Environmental Control"}, {}),
        ("health_bar", 0, 2, 4, 2, {"title": "Atmosphere"}, {"system_state_id": "atmo"}),
        ("health_bar", 4, 2, 4, 2, {"title": "Gravity"}, {"system_state_id": "gravity"}),
        ("health_bar", 8, 2, 4, 2, {"title": "Hull Integrity"}, {"system_state_id": "hull"}),
        ("environment_summary", 0, 4, 12, 6, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in life_support_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), "life_support", wtype, x, y, w, h, json.dumps(config), json.dumps(bindings), now, now),
        )

    # Create widgets for Tactical panel
    tactical_widgets = [
        ("title", 0, 0, 12, 2, {"text": "Tactical Station"}, {}),
        ("health_bar", 0, 2, 6, 2, {"title": "Shields"}, {"system_state_id": "shields"}),
        ("health_bar", 6, 2, 6, 2, {"title": "Point Defense"}, {"system_state_id": "point_defense"}),
        ("weapons_list", 0, 4, 12, 8, {}, {}),
    ]

    for wtype, x, y, w, h, config, bindings in tactical_widgets:
        await db.execute(
            """
            INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height, config, bindings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), "tactical", wtype, x, y, w, h, json.dumps(config), json.dumps(bindings), now, now),
        )

    # Create sample scenarios
    scenarios = [
        (
            "power_fluctuation",
            "Power Fluctuation",
            "Minor power grid instability",
            [
                {"type": "set_status", "target": "power_grid", "value": "degraded"},
                {"type": "set_value", "target": "power_grid", "value": 75},
                {"type": "emit_event", "data": {
                    "type": "alert",
                    "severity": "warning",
                    "message": "Power grid fluctuation detected in Section 3"
                }},
            ],
        ),
        (
            "hull_breach",
            "Hull Breach - Cargo Bay",
            "Micro-meteor impact causes decompression",
            [
                {"type": "set_status", "target": "hull", "value": "compromised"},
                {"type": "set_value", "target": "hull", "value": 80},
                {"type": "emit_event", "data": {
                    "type": "alert",
                    "severity": "critical",
                    "message": "Hull breach detected in Cargo Bay 2!"
                }},
            ],
        ),
        (
            "red_alert",
            "Red Alert",
            "Set ship to red alert posture",
            [
                {"type": "set_posture", "value": "red"},
                {"type": "emit_event", "data": {
                    "type": "red_alert",
                    "severity": "critical",
                    "message": "All hands to battle stations!"
                }},
            ],
        ),
    ]

    for scen_id, name, desc, actions in scenarios:
        await db.execute(
            """
            INSERT INTO scenarios (id, ship_id, name, description, actions, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (scen_id, ship_id, name, desc, json.dumps(actions), now, now),
        )

    # Create sample contacts
    contacts_data = [
        ("dock_master", "Station Dock Master", "Frontier Station Alpha", "neutral", "Dock Authority", "Standard docking procedures", '["station", "official"]'),
        ("merchant_lee", "Captain Lee", "Independent Trader", "friendly", "Merchant Captain", "Reliable trader, fair prices", '["trader", "ally"]'),
        ("unknown_vessel", "Unknown Vessel", None, "unknown", "Unknown", "Unidentified ship, no response to hails", '["mystery"]'),
    ]

    for contact_id, name, affiliation, threat_level, role, notes, tags in contacts_data:
        await db.execute(
            """
            INSERT INTO contacts (id, ship_id, name, affiliation, threat_level, role, notes, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (contact_id, ship_id, name, affiliation, threat_level, role, notes, tags, now, now),
        )

    # Create sample sensor contact
    await db.execute(
        """
        INSERT INTO sensor_contacts (id, ship_id, label, contact_id, confidence, iff, threat, range, bearing, vector,
                                     signal_strength, first_detected_at, last_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            ship_id,
            "Contact Bravo-1",
            "unknown_vessel",
            45,
            "unknown",
            "moderate",
            "12,000 km",
            "045",
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
                asset["id"],
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
        await db.execute(
            """
            INSERT INTO cargo (
                id, ship_id, name, category, quantity, unit, description, value, location,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cargo["id"],
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
        await db.execute(
            """
            INSERT INTO holomap_layers (
                id, ship_id, name, image_url, deck_level, sort_order, visible, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                layer["id"],
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
        await db.execute(
            """
            INSERT INTO holomap_markers (
                id, layer_id, type, x, y, severity, label, description,
                linked_incident_id, linked_task_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                marker["id"],
                marker["layer_id"],
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
        INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            ship_id,
            "system_boot",
            "info",
            "ISV Constellation systems online. All stations nominal.",
            json.dumps({"source": "seed"}),
            now,
        ),
    )

    await db.commit()
    print("Database seeded with ISV Constellation")
