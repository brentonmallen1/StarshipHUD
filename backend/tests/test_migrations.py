"""
Migration parity: an upgraded legacy database must end up with the same
schema as a database created fresh from SCHEMA.

Databases that predate version tracking are stamped at LEGACY_VERSION (v34)
and then receive migrations v35+. The legacy state is reconstructed from
SCHEMA by undoing exactly what those later migrations add.
"""

import re

import aiosqlite

from app.database import SCHEMA
from app.migrations import LEGACY_VERSION, MIGRATIONS, apply_migrations

# What migrations after LEGACY_VERSION add, per table (columns to strip).
POST_LEGACY_COLUMNS = {
    "system_states": ["status_thresholds", "category_id"],  # v35, v42
    "posture_state": ["hail_active"],  # v36
    "crew": ["user_id", "default_panel_id"],  # v38
}
# Tables created after LEGACY_VERSION (v42)
POST_LEGACY_TABLES = ["system_categories"]

# timers as created by v34, before v39-v41 reshaped it
V34_TIMERS = """CREATE TABLE IF NOT EXISTS timers (
    id TEXT PRIMARY KEY,
    ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    end_time TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('info', 'warning', 'critical')),
    scenario_id TEXT REFERENCES scenarios(id) ON DELETE SET NULL,
    visible INTEGER NOT NULL DEFAULT 1,
    paused_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)"""

_CREATE_TABLE_RE = re.compile(r"CREATE TABLE IF NOT EXISTS (\w+) \((.*?)\n\)", re.S)


def legacy_v34_schema() -> str:
    """SCHEMA as it looked at LEGACY_VERSION (before migrations v35+)."""

    def rewrite(match: re.Match) -> str:
        table, body = match.group(1), match.group(2)
        if table == "timers":
            return V34_TIMERS
        if table in POST_LEGACY_TABLES:
            return "SELECT 1"
        drop = POST_LEGACY_COLUMNS.get(table, [])
        lines = [ln for ln in body.split("\n") if not any(ln.strip().startswith(f"{c} ") for c in drop)]
        return f"CREATE TABLE IF NOT EXISTS {table} ({chr(10).join(lines)}\n)"

    schema = _CREATE_TABLE_RE.sub(rewrite, SCHEMA)
    # Indexes on things that don't exist yet at v34
    kept = []
    for stmt in schema.split(";"):
        if re.search(r"CREATE INDEX .* ON (system_categories)\b", stmt):
            continue
        kept.append(stmt)
    return ";".join(kept)


async def describe(db: aiosqlite.Connection) -> dict:
    """Tables -> columns/foreign keys, plus index names (excluding internals)."""
    rows = await db.execute_fetchall(
        "SELECT type, name, tbl_name FROM sqlite_master "
        "WHERE name NOT LIKE 'sqlite_%' AND name != '_schema_version'"
    )
    tables = sorted(name for typ, name, _ in rows if typ == "table")
    result = {"indexes": sorted((name, tbl) for typ, name, tbl in rows if typ == "index")}
    for table in tables:
        cols = await db.execute_fetchall(f"PRAGMA table_info({table})")
        fks = await db.execute_fetchall(f"PRAGMA foreign_key_list({table})")
        result[table] = {
            # (name, type, notnull, default, pk); column order is irrelevant
            "columns": sorted((c[1], c[2], c[3], c[4], c[5]) for c in cols),
            "fks": sorted((f[2], f[3], f[4], f[5], f[6]) for f in fks),
        }
    return result


async def _fresh_db(path) -> dict:
    async with aiosqlite.connect(path) as db:
        await db.executescript(SCHEMA)
        await db.commit()
        await apply_migrations(db)
        return await describe(db)


async def _upgraded_legacy_db(path) -> dict:
    async with aiosqlite.connect(path) as db:
        await db.executescript(legacy_v34_schema())
        await db.commit()
        # Same sequence as init_db() on an existing pre-versioning database
        await db.executescript(SCHEMA)
        await db.commit()
        version = await apply_migrations(db)
        assert version == max(v for v, _, _ in MIGRATIONS)
        return await describe(db)


async def test_legacy_schema_is_really_legacy(tmp_path):
    """Guard the fixture: the reconstructed v34 schema lacks the v35+ additions."""
    async with aiosqlite.connect(tmp_path / "legacy.db") as db:
        await db.executescript(legacy_v34_schema())
        legacy = await describe(db)
    assert "system_categories" not in legacy
    for table, cols in POST_LEGACY_COLUMNS.items():
        names = {c[0] for c in legacy[table]["columns"]}
        assert not names & set(cols), table
    timer_cols = {c[0]: c for c in legacy["timers"]["columns"]}
    assert "direction" not in timer_cols
    assert timer_cols["end_time"][2] == 1  # NOT NULL before v40


async def test_upgraded_legacy_db_matches_fresh_schema(tmp_path):
    fresh = await _fresh_db(tmp_path / "fresh.db")
    upgraded = await _upgraded_legacy_db(tmp_path / "legacy.db")

    assert sorted(upgraded) == sorted(fresh), "table sets differ"
    for key in fresh:
        assert upgraded[key] == fresh[key], f"schema drift in {key}"


async def test_every_migration_is_a_noop_on_fresh_schema(tmp_path):
    """
    Running every migration (legacy ones included) against SCHEMA must not
    change it. A difference means a migration adds something SCHEMA lacks,
    i.e. fresh databases are missing it (this caught sector_maps.bg_opacity).
    """
    fresh = await _fresh_db(tmp_path / "fresh.db")
    async with aiosqlite.connect(tmp_path / "all.db") as db:
        await db.executescript(SCHEMA)
        await db.commit()
        for _version, _description, migration_fn in MIGRATIONS:
            await migration_fn(db)
            await db.commit()
        everything = await describe(db)

    assert sorted(everything) == sorted(fresh)
    for key in fresh:
        assert everything[key] == fresh[key], f"SCHEMA is missing what migrations add to {key}"


async def test_fresh_v42_database_gains_bg_opacity(tmp_path):
    """Databases created fresh before the SCHEMA fix are repaired by v43."""
    schema_without = SCHEMA.replace("    bg_opacity REAL NOT NULL DEFAULT 1.0,\n", "")
    assert schema_without != SCHEMA
    async with aiosqlite.connect(tmp_path / "old_fresh.db") as db:
        await db.executescript(schema_without)
        await db.execute(
            "CREATE TABLE _schema_version (version INTEGER NOT NULL, "
            "applied_at TEXT NOT NULL DEFAULT (datetime('now')), description TEXT)"
        )
        await db.execute("INSERT INTO _schema_version (version) VALUES (42)")
        await db.commit()
        await apply_migrations(db)
        cols = {row[1] for row in await db.execute_fetchall("PRAGMA table_info(sector_maps)")}
    assert "bg_opacity" in cols


async def test_fresh_db_is_stamped_at_latest(tmp_path):
    async with aiosqlite.connect(tmp_path / "fresh.db") as db:
        await db.executescript(SCHEMA)
        version = await apply_migrations(db)
    assert version >= LEGACY_VERSION
    assert version == max(v for v, _, _ in MIGRATIONS)
