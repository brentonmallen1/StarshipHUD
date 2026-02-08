"""
Versioned database migrations.

Each migration is a (version, description, async_function) tuple.
Migrations are applied in order. Each migration receives an aiosqlite connection.
The connection is committed after each successful migration.

The _schema_version table tracks which migrations have been applied.
For databases created before versioning was introduced, all existing
migrations are marked as applied (LEGACY_VERSION).
"""

import json
import random
import uuid

import aiosqlite


# All inline migrations from database.py before versioning was introduced
# are considered "legacy". Existing databases get stamped at this version.
LEGACY_VERSION = 20


async def get_current_version(db: aiosqlite.Connection) -> int:
    """Get current schema version. Returns -1 if no version table exists."""
    try:
        cursor = await db.execute("SELECT MAX(version) FROM _schema_version")
        row = await cursor.fetchone()
        return row[0] if row[0] is not None else 0
    except Exception:
        return -1  # Table doesn't exist


async def apply_migrations(db: aiosqlite.Connection) -> int:
    """Apply all pending migrations. Returns the final schema version."""
    current = await get_current_version(db)

    if current == -1:
        # Version table doesn't exist — create it
        await db.execute("""
            CREATE TABLE IF NOT EXISTS _schema_version (
                version INTEGER NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now')),
                description TEXT
            )
        """)
        await db.commit()

        # Detect if this is a pre-versioning database or a fresh one
        cursor = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ships'"
        )
        has_ships = await cursor.fetchone()

        if has_ships:
            # Pre-versioning database: mark all legacy migrations as already applied
            await db.execute(
                "INSERT INTO _schema_version (version, description) VALUES (?, ?)",
                (LEGACY_VERSION, "Legacy: all pre-versioning migrations"),
            )
            await db.commit()
            print(f"[migrations] Initialized version tracking for existing database at v{LEGACY_VERSION}")
            current = LEGACY_VERSION
        else:
            # Fresh database: schema was just created with CREATE TABLE IF NOT EXISTS
            # All columns/tables already exist in the SCHEMA constant, so skip legacy migrations
            await db.execute(
                "INSERT INTO _schema_version (version, description) VALUES (?, ?)",
                (LEGACY_VERSION, "Fresh database: schema includes all legacy migrations"),
            )
            await db.commit()
            print(f"[migrations] Fresh database initialized at v{LEGACY_VERSION}")
            current = LEGACY_VERSION

    # Apply pending migrations
    pending = [(v, desc, fn) for v, desc, fn in MIGRATIONS if v > current]

    for version, description, migration_fn in pending:
        print(f"[migrations] Applying v{version}: {description}")
        try:
            await migration_fn(db)
            await db.execute(
                "INSERT INTO _schema_version (version, description) VALUES (?, ?)",
                (version, description),
            )
            await db.commit()
        except Exception as e:
            await db.rollback()
            raise RuntimeError(
                f"Migration v{version} ({description}) failed: {e}"
            ) from e

    final_version = max(current, max((v for v, _, _ in MIGRATIONS), default=current))
    if pending:
        print(f"[migrations] Database is now at v{final_version}")
    else:
        print(f"[migrations] Database is up to date at v{final_version}")

    return final_version


# ---------------------------------------------------------------------------
# Legacy migrations (v1–v20)
#
# These are preserved here for reference and for the rare case where someone
# has a database that somehow missed the legacy stamp. In normal operation,
# existing databases are stamped at LEGACY_VERSION and these never run.
# New databases already have the full schema via CREATE TABLE IF NOT EXISTS.
# ---------------------------------------------------------------------------


async def _m01_events_transmitted(db: aiosqlite.Connection):
    await db.execute(
        "ALTER TABLE events ADD COLUMN transmitted INTEGER NOT NULL DEFAULT 1"
    )


async def _m02_system_states_depends_on(db: aiosqlite.Connection):
    await db.execute(
        "ALTER TABLE system_states ADD COLUMN depends_on TEXT NOT NULL DEFAULT '[]'"
    )


async def _m03_sensor_contacts_bearing_deg(db: aiosqlite.Connection):
    await db.execute("ALTER TABLE sensor_contacts ADD COLUMN bearing_deg REAL")


async def _m04_sensor_contacts_range_km(db: aiosqlite.Connection):
    await db.execute("ALTER TABLE sensor_contacts ADD COLUMN range_km REAL")


async def _m05_sensor_contacts_visible(db: aiosqlite.Connection):
    await db.execute(
        "ALTER TABLE sensor_contacts ADD COLUMN visible INTEGER NOT NULL DEFAULT 0"
    )


async def _m06_sensor_contacts_visible_index(db: aiosqlite.Connection):
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_sensor_contacts_visible ON sensor_contacts(visible)"
    )


async def _m07_scenarios_position(db: aiosqlite.Connection):
    await db.execute(
        "ALTER TABLE scenarios ADD COLUMN position INTEGER NOT NULL DEFAULT 0"
    )
    # Initialize positions based on existing name order
    await db.execute("""
        UPDATE scenarios SET position = (
            SELECT COUNT(*) FROM scenarios s2
            WHERE s2.ship_id = scenarios.ship_id AND s2.name < scenarios.name
        )
    """)


async def _m08_scenarios_position_index(db: aiosqlite.Connection):
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_scenarios_position ON scenarios(ship_id, position)"
    )


async def _m09_holomap_markers_visible(db: aiosqlite.Connection):
    await db.execute(
        "ALTER TABLE holomap_markers ADD COLUMN visible INTEGER NOT NULL DEFAULT 1"
    )


async def _m10_assets_depends_on(db: aiosqlite.Connection):
    await db.execute(
        "ALTER TABLE assets ADD COLUMN depends_on TEXT NOT NULL DEFAULT '[]'"
    )


async def _m11_rename_widget_types(db: aiosqlite.Connection):
    cursor = await db.execute(
        "SELECT COUNT(*) FROM widget_instances WHERE widget_type = 'invisible_spacer'"
    )
    count = (await cursor.fetchone())[0]
    if count > 0:
        await db.execute(
            "UPDATE widget_instances SET widget_type = 'spacer_temp' WHERE widget_type = 'invisible_spacer'"
        )
        await db.execute(
            "UPDATE widget_instances SET widget_type = 'divider' WHERE widget_type = 'spacer'"
        )
        await db.execute(
            "UPDATE widget_instances SET widget_type = 'spacer' WHERE widget_type = 'spacer_temp'"
        )


async def _m12_status_fully_operational_to_optimal(db: aiosqlite.Connection):
    cursor = await db.execute(
        "SELECT COUNT(*) FROM system_states WHERE status = 'fully_operational'"
    )
    count = (await cursor.fetchone())[0]
    if count > 0:
        await db.execute(
            "UPDATE system_states SET status = 'optimal' WHERE status = 'fully_operational'"
        )

    cursor = await db.execute(
        "SELECT COUNT(*) FROM assets WHERE status = 'fully_operational'"
    )
    count = (await cursor.fetchone())[0]
    if count > 0:
        await db.execute(
            "UPDATE assets SET status = 'optimal' WHERE status = 'fully_operational'"
        )


async def _m13_recreate_system_states_for_optimal(db: aiosqlite.Connection):
    cursor = await db.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='system_states'"
    )
    row = await cursor.fetchone()
    if row and row[0]:
        table_sql = row[0]
        if "fully_operational" in table_sql and "optimal" not in table_sql:
            await db.execute("PRAGMA foreign_keys = OFF")
            await db.execute("""
                CREATE TABLE system_states_new (
                    id TEXT PRIMARY KEY,
                    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'operational' CHECK(status IN ('optimal', 'operational', 'degraded', 'compromised', 'critical', 'destroyed', 'offline')),
                    value REAL NOT NULL DEFAULT 100,
                    max_value REAL NOT NULL DEFAULT 100,
                    unit TEXT DEFAULT '%',
                    category TEXT,
                    depends_on TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await db.execute("""
                INSERT INTO system_states_new (id, ship_id, name, status, value, max_value, unit, category, depends_on, created_at, updated_at)
                SELECT id, ship_id, name,
                    CASE WHEN status = 'fully_operational' THEN 'optimal' ELSE status END,
                    value, max_value, unit, category, depends_on, created_at, updated_at
                FROM system_states
            """)
            await db.execute("DROP TABLE system_states")
            await db.execute(
                "ALTER TABLE system_states_new RENAME TO system_states"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_system_states_ship ON system_states(ship_id)"
            )
            await db.execute("PRAGMA foreign_keys = ON")


async def _m14_recreate_assets_for_optimal(db: aiosqlite.Connection):
    cursor = await db.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='assets'"
    )
    row = await cursor.fetchone()
    if row and row[0]:
        table_sql = row[0]
        if "fully_operational" in table_sql and "optimal" not in table_sql:
            await db.execute("PRAGMA foreign_keys = OFF")
            await db.execute("""
                CREATE TABLE assets_new (
                    id TEXT PRIMARY KEY,
                    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    asset_type TEXT NOT NULL CHECK(asset_type IN ('energy_weapon', 'torpedo', 'missile', 'railgun', 'laser', 'particle_beam', 'drone', 'probe')),
                    status TEXT NOT NULL DEFAULT 'operational' CHECK(status IN ('optimal', 'operational', 'degraded', 'compromised', 'critical', 'destroyed', 'offline')),
                    ammo_current INTEGER NOT NULL DEFAULT 0,
                    ammo_max INTEGER NOT NULL DEFAULT 0,
                    ammo_type TEXT,
                    range REAL NOT NULL DEFAULT 0,
                    range_unit TEXT NOT NULL DEFAULT 'km',
                    damage REAL,
                    accuracy REAL,
                    charge_time REAL,
                    cooldown REAL,
                    fire_mode TEXT CHECK(fire_mode IN ('single', 'burst', 'sustained', 'auto')),
                    is_armed INTEGER NOT NULL DEFAULT 0,
                    is_ready INTEGER NOT NULL DEFAULT 1,
                    current_target TEXT,
                    mount_location TEXT CHECK(mount_location IN ('port', 'starboard', 'dorsal', 'ventral', 'fore', 'aft')),
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await db.execute("""
                INSERT INTO assets_new
                SELECT id, ship_id, name, asset_type,
                    CASE WHEN status = 'fully_operational' THEN 'optimal' ELSE status END,
                    ammo_current, ammo_max, ammo_type, range, range_unit, damage, accuracy,
                    charge_time, cooldown, fire_mode, is_armed, is_ready, current_target,
                    mount_location, created_at, updated_at
                FROM assets
            """)
            await db.execute("DROP TABLE assets")
            await db.execute("ALTER TABLE assets_new RENAME TO assets")
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_assets_ship ON assets(ship_id)"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type)"
            )
            await db.execute("PRAGMA foreign_keys = ON")


async def _m15_cargo_size_class(db: aiosqlite.Connection):
    await db.execute(
        "ALTER TABLE cargo ADD COLUMN size_class TEXT NOT NULL DEFAULT 'small'"
    )


async def _m16_cargo_shape_variant(db: aiosqlite.Connection):
    await db.execute(
        "ALTER TABLE cargo ADD COLUMN shape_variant INTEGER NOT NULL DEFAULT 0"
    )


async def _m17_create_cargo_bays(db: aiosqlite.Connection):
    await db.execute("""
        CREATE TABLE IF NOT EXISTS cargo_bays (
            id TEXT PRIMARY KEY,
            ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            bay_size TEXT NOT NULL DEFAULT 'medium' CHECK(bay_size IN ('small', 'medium', 'large', 'custom')),
            width INTEGER NOT NULL DEFAULT 8,
            height INTEGER NOT NULL DEFAULT 6,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_cargo_bays_ship ON cargo_bays(ship_id)"
    )


async def _m18_create_cargo_placements(db: aiosqlite.Connection):
    await db.execute("""
        CREATE TABLE IF NOT EXISTS cargo_placements (
            id TEXT PRIMARY KEY,
            cargo_id TEXT NOT NULL REFERENCES cargo(id) ON DELETE CASCADE,
            bay_id TEXT NOT NULL REFERENCES cargo_bays(id) ON DELETE CASCADE,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            rotation INTEGER NOT NULL DEFAULT 0 CHECK(rotation IN (0, 90, 180, 270)),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(cargo_id)
        )
    """)
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_cargo_placements_bay ON cargo_placements(bay_id)"
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_cargo_placements_cargo ON cargo_placements(cargo_id)"
    )


async def _m19_cargo_category_fields(db: aiosqlite.Connection):
    # Add category_id, notes, color columns
    try:
        await db.execute(
            "ALTER TABLE cargo ADD COLUMN category_id TEXT REFERENCES cargo_categories(id)"
        )
    except Exception:
        pass  # Column may already exist from partial migration

    try:
        await db.execute("ALTER TABLE cargo ADD COLUMN notes TEXT")
    except Exception:
        pass

    try:
        await db.execute("ALTER TABLE cargo ADD COLUMN color TEXT")
    except Exception:
        pass

    # Migrate existing category strings to cargo_categories
    cursor = await db.execute("""
        SELECT DISTINCT ship_id, category FROM cargo
        WHERE category IS NOT NULL AND category != '' AND category_id IS NULL
    """)
    rows = await cursor.fetchall()

    for row in rows:
        ship_id, category_name = row[0], row[1]
        cursor = await db.execute(
            "SELECT id FROM cargo_categories WHERE ship_id = ? AND name = ?",
            (ship_id, category_name),
        )
        existing = await cursor.fetchone()

        if existing:
            cat_id = existing[0]
        else:
            cat_id = str(uuid.uuid4())
            color = f"#{random.randint(0, 0xFFFFFF):06x}"
            await db.execute(
                """INSERT INTO cargo_categories (id, ship_id, name, color, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))""",
                (cat_id, ship_id, category_name, color),
            )

        await db.execute(
            """UPDATE cargo SET category_id = ?
            WHERE ship_id = ? AND category = ? AND category_id IS NULL""",
            (cat_id, ship_id, category_name),
        )


async def _m20_cargo_compose_notes(db: aiosqlite.Connection):
    cursor = await db.execute("""
        SELECT id, quantity, unit, value, description
        FROM cargo
        WHERE notes IS NULL AND (quantity > 0 OR value > 0 OR description IS NOT NULL)
    """)
    rows = await cursor.fetchall()

    for row in rows:
        row_id, quantity, unit, value, description = row[0], row[1], row[2], row[3], row[4]
        parts = []
        if description:
            parts.append(description)
        if quantity and quantity > 0:
            unit_str = unit or "units"
            parts.append(f"Quantity: {quantity:g} {unit_str}")
        if value and value > 0:
            parts.append(f"Value: ${value:g}/unit")

        new_notes = "\n".join(parts) if parts else None
        if new_notes:
            await db.execute(
                "UPDATE cargo SET notes = ? WHERE id = ?", (new_notes, row_id)
            )


# ---------------------------------------------------------------------------
# Migration registry — add new migrations here
# ---------------------------------------------------------------------------

MIGRATIONS: list[tuple[int, str, ...]] = [
    (1, "Add transmitted column to events", _m01_events_transmitted),
    (2, "Add depends_on to system_states", _m02_system_states_depends_on),
    (3, "Add bearing_deg to sensor_contacts", _m03_sensor_contacts_bearing_deg),
    (4, "Add range_km to sensor_contacts", _m04_sensor_contacts_range_km),
    (5, "Add visible to sensor_contacts", _m05_sensor_contacts_visible),
    (6, "Create sensor_contacts visibility index", _m06_sensor_contacts_visible_index),
    (7, "Add position to scenarios + initialize order", _m07_scenarios_position),
    (8, "Create scenarios position index", _m08_scenarios_position_index),
    (9, "Add visible to holomap_markers", _m09_holomap_markers_visible),
    (10, "Add depends_on to assets", _m10_assets_depends_on),
    (11, "Rename widget types (invisible_spacer->spacer, spacer->divider)", _m11_rename_widget_types),
    (12, "Migrate fully_operational to optimal status values", _m12_status_fully_operational_to_optimal),
    (13, "Recreate system_states table for optimal CHECK constraint", _m13_recreate_system_states_for_optimal),
    (14, "Recreate assets table for optimal CHECK constraint", _m14_recreate_assets_for_optimal),
    (15, "Add size_class to cargo", _m15_cargo_size_class),
    (16, "Add shape_variant to cargo", _m16_cargo_shape_variant),
    (17, "Create cargo_bays table", _m17_create_cargo_bays),
    (18, "Create cargo_placements table", _m18_create_cargo_placements),
    (19, "Add cargo category fields + migrate category strings", _m19_cargo_category_fields),
    (20, "Compose cargo quantity/unit/value/description into notes", _m20_cargo_compose_notes),
]
