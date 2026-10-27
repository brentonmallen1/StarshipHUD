"""
Sector map persistence: row parsing, generic CRUD over the sector map tables,
player-safe object listing, and default GM waypoint preset seeding.

Nothing here commits; routers own the transaction.
"""

import uuid
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import aiosqlite

from app.services.errors import NotFoundError


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


# ---------------------------------------------------------------------------
# Row parsing
# ---------------------------------------------------------------------------


def parse_map(row: aiosqlite.Row | dict) -> dict:
    """Parse sector map row, converting boolean fields."""
    result = dict(row)
    result["is_active"] = bool(result["is_active"])
    result["grid_visible"] = bool(result.get("grid_visible", 1))
    # Provide defaults for columns added in later migrations
    result.setdefault("grid_radius", 25)
    result.setdefault("bg_scale", 1.0)
    result.setdefault("bg_rotation", 0.0)
    result.setdefault("bg_offset_x", 0.0)
    result.setdefault("bg_offset_y", 0.0)
    return result


def parse_sprite(row: aiosqlite.Row | dict) -> dict:
    """Parse sprite row, converting boolean fields."""
    result = dict(row)
    result["default_locked"] = bool(result["default_locked"])
    return result


def parse_object(row: aiosqlite.Row | dict) -> dict:
    """Parse map object row, converting boolean fields."""
    result = dict(row)
    result["locked"] = bool(result["locked"])
    result.setdefault("visibility_state", "visible")
    result.setdefault("rotation", 0.0)
    return result


def parse_waypoint(row: aiosqlite.Row | dict) -> dict:
    """Parse waypoint row, converting boolean fields."""
    result = dict(row)
    result["show_label"] = bool(result.get("show_label", 1))
    # Provide defaults for columns added in later migrations
    result.setdefault("symbol", "◆")
    result.setdefault("text_color", "#ffffff")
    result.setdefault("background_color", None)
    return result


def parse_gm_preset(row: aiosqlite.Row | dict) -> dict:
    """Parse GM waypoint preset row, converting boolean fields."""
    result = dict(row)
    result["is_pinned"] = bool(result.get("is_pinned", 1))
    result["show_label"] = bool(result.get("show_label", 1))
    # Provide defaults for columns added in later migrations
    result.setdefault("text_color", "#ffffff")
    result.setdefault("background_color", None)
    result.setdefault("pin_order", result.get("slot_index"))
    return result


# ---------------------------------------------------------------------------
# Generic CRUD
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Table:
    """How one sector map table is stored: name, 404 message, parser, boolean columns."""

    name: str
    not_found: str
    parse: Callable[[Any], dict]
    bool_columns: frozenset[str]
    insert_columns: tuple[str, ...]


MAPS = Table(
    "sector_maps",
    "Sector map not found",
    parse_map,
    frozenset({"is_active", "grid_visible"}),
    (
        "ship_id", "name", "description", "hex_size", "grid_width", "grid_height", "grid_radius",
        "background_color", "background_image_url", "bg_scale", "bg_rotation", "bg_offset_x",
        "bg_offset_y", "grid_visible", "grid_color", "grid_opacity", "is_active", "sort_order",
    ),
)  # fmt: skip
SPRITES = Table(
    "sector_sprites",
    "Sprite not found",
    parse_sprite,
    frozenset({"default_locked"}),
    ("ship_id", "name", "category", "image_url", "default_locked"),
)
OBJECTS = Table(
    "sector_map_objects",
    "Map object not found",
    parse_object,
    frozenset({"locked"}),
    (
        "map_id", "sprite_id", "hex_q", "hex_r", "label", "description",
        "scale", "rotation", "visibility_state", "locked",
    ),
)  # fmt: skip
WAYPOINTS = Table(
    "sector_map_waypoints",
    "Waypoint not found",
    parse_waypoint,
    frozenset({"show_label"}),
    (
        "map_id", "hex_q", "hex_r", "label", "color", "symbol", "text_color",
        "background_color", "show_label", "created_by",
    ),
)  # fmt: skip
GM_PRESETS = Table(
    "gm_waypoint_presets",
    "Preset not found",
    parse_gm_preset,
    frozenset({"is_pinned", "show_label"}),
    (
        "ship_id", "name", "color", "symbol", "is_pinned", "pin_order",
        "text_color", "background_color", "show_label",
    ),
)  # fmt: skip


def _to_db(table: Table, column: str, value: Any) -> Any:
    if column in table.bool_columns:
        return 1 if value else 0
    return value


async def get_raw(db: aiosqlite.Connection, table: Table, row_id: str) -> dict:
    """The stored row, or NotFoundError."""
    cursor = await db.execute(f"SELECT * FROM {table.name} WHERE id = ?", (row_id,))
    row = await cursor.fetchone()
    if not row:
        raise NotFoundError(table.not_found)
    return dict(row)


async def get(db: aiosqlite.Connection, table: Table, row_id: str) -> dict:
    """The parsed row, or NotFoundError."""
    return table.parse(await get_raw(db, table, row_id))


async def insert(db: aiosqlite.Connection, table: Table, data: Any, row_id: str | None = None) -> dict:
    """Insert ``table.insert_columns`` read from ``data`` (a Create model); returns the parsed row."""
    row_id = row_id or getattr(data, "id", None) or str(uuid.uuid4())
    ts = now_iso()
    columns = ["id", *table.insert_columns, "created_at", "updated_at"]
    values = [row_id, *(_to_db(table, c, getattr(data, c)) for c in table.insert_columns), ts, ts]
    await db.execute(
        f"INSERT INTO {table.name} ({', '.join(columns)}) VALUES ({', '.join('?' * len(columns))})",
        values,
    )
    return await get(db, table, row_id)


async def update(db: aiosqlite.Connection, table: Table, row_id: str, update_data: dict) -> tuple[dict, dict]:
    """Apply a partial update; returns ``(before_raw, after_parsed)``. No-op updates don't touch updated_at."""
    before = await get_raw(db, table, row_id)
    if update_data:
        assignments = [f"{key} = ?" for key in update_data] + ["updated_at = ?"]
        values = [_to_db(table, k, v) for k, v in update_data.items()] + [now_iso(), row_id]
        await db.execute(f"UPDATE {table.name} SET {', '.join(assignments)} WHERE id = ?", values)
    return before, await get(db, table, row_id)


async def delete(db: aiosqlite.Connection, table: Table, row_id: str) -> dict:
    """Delete a row; returns what was deleted."""
    before = await get_raw(db, table, row_id)
    await db.execute(f"DELETE FROM {table.name} WHERE id = ?", (row_id,))
    return before


async def list_rows(
    db: aiosqlite.Connection, table: Table, order_by: str, filters: Iterable[tuple[str, Any]] = ()
) -> list[dict]:
    """Parsed rows matching ``column = value`` filters (None values are ignored)."""
    clauses, params = [], []
    for column, value in filters:
        if value is not None:
            clauses.append(f"{column} = ?")
            params.append(value)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    cursor = await db.execute(f"SELECT * FROM {table.name}{where} ORDER BY {order_by}", params)
    return [table.parse(row) for row in await cursor.fetchall()]


# ---------------------------------------------------------------------------
# Maps
# ---------------------------------------------------------------------------


async def fetch_objects(
    db: aiosqlite.Connection, map_id: str, visible_only: bool = False, redact_anomalies: bool = False
) -> list[dict]:
    """Fetch all objects for a map. visible_only includes anomaly objects (player sees as unknown)."""
    if visible_only:
        cursor = await db.execute(
            "SELECT * FROM sector_map_objects"
            " WHERE map_id = ? AND visibility_state IN ('visible', 'anomaly') ORDER BY created_at",
            (map_id,),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM sector_map_objects WHERE map_id = ? ORDER BY created_at",
            (map_id,),
        )
    objects = [parse_object(row) for row in await cursor.fetchall()]
    if redact_anomalies:
        # Players see anomalies as unidentified contacts; don't send what they are
        for obj in objects:
            if obj["visibility_state"] == "anomaly":
                obj.update(label=None, description=None, sprite_id=None)
    return objects


async def fetch_waypoints(db: aiosqlite.Connection, map_id: str) -> list[dict]:
    """Fetch all waypoints for a map."""
    try:
        return await list_rows(db, WAYPOINTS, "created_at", [("map_id", map_id)])
    except Exception:
        # Table may not exist on old databases before migration v29 runs
        return []


async def map_with_contents(db: aiosqlite.Connection, map_row: dict, *, player: bool, visible_only: bool) -> dict:
    """A parsed map plus its objects (player-filtered), the ship's sprites and the map's waypoints."""
    map_data = parse_map(map_row)
    objects = await fetch_objects(db, map_data["id"], visible_only=visible_only or player, redact_anomalies=player)
    sprites = await list_rows(db, SPRITES, "category, name", [("ship_id", map_data["ship_id"])])
    waypoints = await fetch_waypoints(db, map_data["id"])
    return {**map_data, "objects": objects, "sprites": sprites, "waypoints": waypoints}


async def set_active(db: aiosqlite.Connection, map_id: str) -> dict:
    """Make this the ship's only active map; returns the parsed map."""
    current = await get_raw(db, MAPS, map_id)
    ts = now_iso()
    await db.execute("UPDATE sector_maps SET is_active = 0, updated_at = ? WHERE ship_id = ?", (ts, current["ship_id"]))
    await db.execute("UPDATE sector_maps SET is_active = 1, updated_at = ? WHERE id = ?", (ts, map_id))
    return await get(db, MAPS, map_id)


async def deactivate(db: aiosqlite.Connection, map_id: str) -> dict:
    await get_raw(db, MAPS, map_id)
    await db.execute("UPDATE sector_maps SET is_active = 0, updated_at = ? WHERE id = ?", (now_iso(), map_id))
    return await get(db, MAPS, map_id)


# ---------------------------------------------------------------------------
# GM waypoint presets
# ---------------------------------------------------------------------------

GM_PRESET_DEFAULTS = [
    {"name": "Alpha", "color": "#ff6b6b", "symbol": "◆", "pin_order": 0},
    {"name": "Bravo", "color": "#ffd93d", "symbol": "▲", "pin_order": 1},
    {"name": "Charlie", "color": "#6bcb77", "symbol": "●", "pin_order": 2},
    {"name": "Delta", "color": "#4d96ff", "symbol": "■", "pin_order": 3},
    {"name": "Echo", "color": "#9b59b6", "symbol": "★", "pin_order": 4},
    {"name": "Foxtrot", "color": "#e17055", "symbol": "◇", "pin_order": 5},
]

PRESET_ORDER = "COALESCE(pin_order, 999), created_at"


async def seed_default_gm_presets(db: aiosqlite.Connection, ship_id: str) -> list[dict]:
    """Insert the default GM presets for a ship; returns them in pin order."""
    ts = now_iso()
    for preset in GM_PRESET_DEFAULTS:
        await db.execute(
            """INSERT INTO gm_waypoint_presets
               (id, ship_id, name, color, symbol, is_pinned, pin_order,
                text_color, background_color, show_label, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, ?, '#ffffff', NULL, 1, ?, ?)""",
            (
                str(uuid.uuid4()),
                ship_id,
                preset["name"],
                preset["color"],
                preset["symbol"],
                preset["pin_order"],
                ts,
                ts,
            ),
        )
    return await list_rows(db, GM_PRESETS, "pin_order", [("ship_id", ship_id)])


async def list_gm_presets(db: aiosqlite.Connection, ship_id: str) -> tuple[list[dict], bool]:
    """The ship's presets in pin order, seeding defaults first if it has none. Returns (presets, seeded)."""
    presets = await list_rows(db, GM_PRESETS, PRESET_ORDER, [("ship_id", ship_id)])
    if presets:
        return presets, False
    return await seed_default_gm_presets(db, ship_id), True


async def reset_gm_presets(db: aiosqlite.Connection, ship_id: str) -> list[dict]:
    await db.execute("DELETE FROM gm_waypoint_presets WHERE ship_id = ?", (ship_id,))
    return await seed_default_gm_presets(db, ship_id)


async def reorder_gm_presets(db: aiosqlite.Connection, ship_id: str, order: list[str]) -> list[dict]:
    """IDs in ``order`` (max 6) get pin_order 0-5; every other preset is unpinned."""
    ts = now_iso()
    await db.execute(
        "UPDATE gm_waypoint_presets SET is_pinned = 0, pin_order = NULL, updated_at = ? WHERE ship_id = ?",
        (ts, ship_id),
    )
    for i, preset_id in enumerate(order[:6]):
        await db.execute(
            "UPDATE gm_waypoint_presets SET is_pinned = 1, pin_order = ?, updated_at = ? WHERE id = ? AND ship_id = ?",
            (i, ts, preset_id, ship_id),
        )
    return await list_rows(db, GM_PRESETS, PRESET_ORDER, [("ship_id", ship_id)])
