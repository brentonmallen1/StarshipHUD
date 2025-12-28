"""
Database connection and initialization.
"""

import aiosqlite
from pathlib import Path

from app.config import settings

# Extract the file path from the database URL
DB_PATH = settings.database_url.replace("sqlite+aiosqlite:///", "")


async def get_db():
    """Get database connection as async context manager."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def init_db():
    """Initialize database with schema."""
    # Ensure data directory exists
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(DB_PATH) as db:
        # Enable foreign keys
        await db.execute("PRAGMA foreign_keys = ON")

        # Create tables
        await db.executescript(SCHEMA)
        await db.commit()

        # Migration: Add transmitted column to events table if it doesn't exist
        try:
            await db.execute("ALTER TABLE events ADD COLUMN transmitted INTEGER NOT NULL DEFAULT 1")
            await db.commit()
        except Exception:
            pass  # Column already exists

        # Check if we need to seed
        cursor = await db.execute("SELECT COUNT(*) FROM ships")
        count = (await cursor.fetchone())[0]
        if count == 0:
            from app.seed import seed_database
            await seed_database(db)


SCHEMA = """
-- Ships table
CREATE TABLE IF NOT EXISTS ships (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ship_class TEXT,
    registry TEXT,
    description TEXT,
    attributes TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Panels table
CREATE TABLE IF NOT EXISTS panels (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    station_group TEXT NOT NULL CHECK(station_group IN ('command', 'engineering', 'sensors', 'tactical', 'life_support', 'communications', 'operations', 'admin')),
    role_visibility TEXT NOT NULL DEFAULT '["player", "gm"]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    icon_id TEXT,
    description TEXT,
    grid_columns INTEGER NOT NULL DEFAULT 12,
    grid_rows INTEGER NOT NULL DEFAULT 8,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- System states table
CREATE TABLE IF NOT EXISTS system_states (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'operational' CHECK(status IN ('fully_operational', 'operational', 'degraded', 'compromised', 'critical', 'destroyed', 'offline')),
    value REAL NOT NULL DEFAULT 100,
    max_value REAL NOT NULL DEFAULT 100,
    unit TEXT DEFAULT '%',
    category TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Widget instances table
CREATE TABLE IF NOT EXISTS widget_instances (
    id TEXT PRIMARY KEY,
    panel_id TEXT NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
    widget_type TEXT NOT NULL,
    x INTEGER NOT NULL DEFAULT 0,
    y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 2,
    height INTEGER NOT NULL DEFAULT 1,
    config TEXT NOT NULL DEFAULT '{}',
    bindings TEXT NOT NULL DEFAULT '{}',
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    transmitted INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    actions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Posture state table
CREATE TABLE IF NOT EXISTS posture_state (
    ship_id TEXT PRIMARY KEY REFERENCES ships(id) ON DELETE CASCADE,
    posture TEXT NOT NULL DEFAULT 'green' CHECK(posture IN ('green', 'yellow', 'red', 'silent_running', 'general_quarters')),
    posture_set_at TEXT NOT NULL DEFAULT (datetime('now')),
    posture_set_by TEXT NOT NULL DEFAULT 'gm',
    roe TEXT NOT NULL DEFAULT '{"weapons_safeties":"on","comms_broadcast":"open","transponder":"active","sensor_emissions":"standard"}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK(severity IN ('minor', 'moderate', 'major', 'critical')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'contained', 'resolved', 'failed')),
    linked_system_ids TEXT NOT NULL DEFAULT '[]',
    effects TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'manual',
    source_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    incident_id TEXT REFERENCES incidents(id),
    title TEXT NOT NULL,
    description TEXT,
    station TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'succeeded', 'failed', 'expired')),
    time_limit INTEGER,
    expires_at TEXT,
    minigame_id TEXT,
    minigame_difficulty INTEGER,
    on_success TEXT NOT NULL DEFAULT '[]',
    on_failure TEXT NOT NULL DEFAULT '[]',
    on_expire TEXT NOT NULL DEFAULT '[]',
    claimed_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Glitch state table
CREATE TABLE IF NOT EXISTS glitch_state (
    ship_id TEXT PRIMARY KEY REFERENCES ships(id) ON DELETE CASCADE,
    intensity REAL NOT NULL DEFAULT 0,
    panel_overrides TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schema TEXT NOT NULL DEFAULT '{}',
    data TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Contacts table (NPC dossiers)
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    affiliation TEXT,
    threat_level TEXT CHECK(threat_level IN ('friendly', 'neutral', 'suspicious', 'hostile', 'unknown')),
    role TEXT,
    notes TEXT,
    image_url TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    last_contacted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sensor contacts table (detected vessels/objects)
CREATE TABLE IF NOT EXISTS sensor_contacts (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    contact_id TEXT REFERENCES contacts(id),
    confidence INTEGER NOT NULL DEFAULT 50 CHECK(confidence >= 0 AND confidence <= 100),
    iff TEXT NOT NULL DEFAULT 'unknown' CHECK(iff IN ('friendly', 'hostile', 'neutral', 'unknown')),
    threat TEXT NOT NULL DEFAULT 'unknown' CHECK(threat IN ('none', 'low', 'moderate', 'high', 'critical', 'unknown')),
    range TEXT,
    bearing TEXT,
    vector TEXT,
    signal_strength INTEGER,
    notes TEXT,
    first_detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    lost_contact_at TEXT
);

-- Holomap layers table
CREATE TABLE IF NOT EXISTS holomap_layers (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    deck_level TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    image_scale REAL NOT NULL DEFAULT 1.0,
    image_offset_x REAL NOT NULL DEFAULT 0.0,
    image_offset_y REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Holomap markers table
CREATE TABLE IF NOT EXISTS holomap_markers (
    id TEXT PRIMARY KEY,
    layer_id TEXT NOT NULL REFERENCES holomap_layers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('breach', 'fire', 'hazard', 'crew', 'objective', 'damage', 'other')),
    x REAL NOT NULL,
    y REAL NOT NULL,
    severity TEXT CHECK(severity IN ('info', 'warning', 'critical')),
    label TEXT,
    description TEXT,
    linked_incident_id TEXT REFERENCES incidents(id),
    linked_task_id TEXT REFERENCES tasks(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mini-game definitions table
CREATE TABLE IF NOT EXISTS minigame_defs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    station TEXT NOT NULL,
    difficulty_params TEXT NOT NULL DEFAULT '{}',
    outcomes TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mini-game results table
CREATE TABLE IF NOT EXISTS minigame_results (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    minigame_type TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK(outcome IN ('success', 'partial', 'failure', 'abort')),
    score INTEGER,
    time_taken INTEGER NOT NULL,
    side_effects TEXT NOT NULL DEFAULT '[]',
    modifiers TEXT NOT NULL DEFAULT '[]',
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Timeline bookmarks table
CREATE TABLE IF NOT EXISTS timeline_bookmarks (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES events(id),
    label TEXT NOT NULL,
    description TEXT,
    bookmark_type TEXT NOT NULL DEFAULT 'manual' CHECK(bookmark_type IN ('manual', 'auto', 'milestone')),
    created_by TEXT NOT NULL DEFAULT 'gm',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Task spawn rules table
CREATE TABLE IF NOT EXISTS task_spawn_rules (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    task_template TEXT NOT NULL,
    cooldown INTEGER,
    last_triggered_at TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assets table (weapons, drones, probes)
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK(asset_type IN ('energy_weapon', 'torpedo', 'missile', 'railgun', 'laser', 'particle_beam', 'drone', 'probe')),
    status TEXT NOT NULL DEFAULT 'operational' CHECK(status IN ('fully_operational', 'operational', 'degraded', 'compromised', 'critical', 'destroyed', 'offline')),

    -- Ammo/Resources
    ammo_current INTEGER NOT NULL DEFAULT 0,
    ammo_max INTEGER NOT NULL DEFAULT 0,
    ammo_type TEXT,

    -- Combat Stats
    range REAL NOT NULL DEFAULT 0,
    range_unit TEXT NOT NULL DEFAULT 'km',
    damage REAL,
    accuracy REAL,

    -- Timing
    charge_time REAL,
    cooldown REAL,

    -- Weapon Mode
    fire_mode TEXT CHECK(fire_mode IN ('single', 'burst', 'sustained', 'auto')),

    -- State
    is_armed INTEGER NOT NULL DEFAULT 0,
    is_ready INTEGER NOT NULL DEFAULT 1,
    current_target TEXT,

    -- Mount/Location
    mount_location TEXT CHECK(mount_location IN ('port', 'starboard', 'dorsal', 'ventral', 'fore', 'aft')),

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cargo inventory table
CREATE TABLE IF NOT EXISTS cargo (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'units',
    description TEXT,
    value REAL,
    location TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_panels_ship ON panels(ship_id);
CREATE INDEX IF NOT EXISTS idx_system_states_ship ON system_states(ship_id);
CREATE INDEX IF NOT EXISTS idx_widget_instances_panel ON widget_instances(panel_id);
CREATE INDEX IF NOT EXISTS idx_events_ship ON events(ship_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenarios_ship ON scenarios(ship_id);
CREATE INDEX IF NOT EXISTS idx_incidents_ship_status ON incidents(ship_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_ship_station ON tasks(ship_id, station);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_contacts_ship ON contacts(ship_id);
CREATE INDEX IF NOT EXISTS idx_sensor_contacts_ship ON sensor_contacts(ship_id);
CREATE INDEX IF NOT EXISTS idx_sensor_contacts_iff ON sensor_contacts(iff);
CREATE INDEX IF NOT EXISTS idx_holomap_layers_ship ON holomap_layers(ship_id);
CREATE INDEX IF NOT EXISTS idx_holomap_markers_layer ON holomap_markers(layer_id);
CREATE INDEX IF NOT EXISTS idx_minigame_results_task ON minigame_results(task_id);
CREATE INDEX IF NOT EXISTS idx_timeline_bookmarks_ship ON timeline_bookmarks(ship_id);
CREATE INDEX IF NOT EXISTS idx_task_spawn_rules_ship ON task_spawn_rules(ship_id);
CREATE INDEX IF NOT EXISTS idx_assets_ship ON assets(ship_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_cargo_ship ON cargo(ship_id);
CREATE INDEX IF NOT EXISTS idx_cargo_category ON cargo(category);
"""
