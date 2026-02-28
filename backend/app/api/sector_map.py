"""
Sector map API endpoints for the hex grid tactical map system.
"""

import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.database import get_db
from app.models.sector_map import (
    GmWaypointPreset,
    GmWaypointPresetCreate,
    GmWaypointPresetUpdate,
    SectorMap,
    SectorMapCreate,
    SectorMapObject,
    SectorMapObjectCreate,
    SectorMapObjectUpdate,
    SectorMapUpdate,
    SectorMapWithObjects,
    SectorSprite,
    SectorSpriteCreate,
    SectorSpriteUpdate,
    SectorWaypoint,
    SectorWaypointCreate,
    SectorWaypointUpdate,
)

router = APIRouter()


def parse_map(row: aiosqlite.Row) -> dict:
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


def parse_sprite(row: aiosqlite.Row) -> dict:
    """Parse sprite row, converting boolean fields."""
    result = dict(row)
    result["default_locked"] = bool(result["default_locked"])
    return result


def parse_object(row: aiosqlite.Row) -> dict:
    """Parse map object row, converting boolean fields."""
    result = dict(row)
    result["locked"] = bool(result["locked"])
    # visibility_state is stored as text — no conversion needed
    result.setdefault("visibility_state", "visible")
    result.setdefault("rotation", 0.0)
    return result


def parse_waypoint(row: aiosqlite.Row) -> dict:
    """Parse waypoint row, converting boolean fields."""
    result = dict(row)
    result["show_label"] = bool(result.get("show_label", 1))
    # Provide defaults for columns added in later migrations
    result.setdefault("symbol", "◆")
    result.setdefault("text_color", "#ffffff")
    result.setdefault("background_color", None)
    return result


def parse_gm_preset(row: aiosqlite.Row) -> dict:
    """Parse GM waypoint preset row, converting boolean fields."""
    result = dict(row)
    result["is_pinned"] = bool(result.get("is_pinned", 1))
    result["show_label"] = bool(result.get("show_label", 1))
    # Provide defaults for columns added in later migrations
    result.setdefault("text_color", "#ffffff")
    result.setdefault("background_color", None)
    result.setdefault("pin_order", result.get("slot_index"))
    return result


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


# =============================================================================
# GM Waypoint Preset Endpoints (must be before /{map_id} routes)
# =============================================================================


GM_PRESET_DEFAULTS = [
    {"name": "Alpha", "color": "#ff6b6b", "symbol": "◆", "pin_order": 0},
    {"name": "Bravo", "color": "#ffd93d", "symbol": "▲", "pin_order": 1},
    {"name": "Charlie", "color": "#6bcb77", "symbol": "●", "pin_order": 2},
    {"name": "Delta", "color": "#4d96ff", "symbol": "■", "pin_order": 3},
    {"name": "Echo", "color": "#9b59b6", "symbol": "★", "pin_order": 4},
    {"name": "Foxtrot", "color": "#e17055", "symbol": "◇", "pin_order": 5},
]


async def _auto_seed_gm_presets(db: aiosqlite.Connection, ship_id: str) -> list[dict]:
    """Auto-seed default GM presets if none exist for the ship."""
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
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM gm_waypoint_presets WHERE ship_id = ? ORDER BY pin_order",
        (ship_id,),
    )
    return [parse_gm_preset(row) for row in await cursor.fetchall()]


@router.get("/gm-presets", response_model=list[GmWaypointPreset])
async def list_gm_waypoint_presets(
    ship_id: str = Query(...),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all GM waypoint presets for a ship, ordered by pin_order. Auto-seeds defaults if empty."""
    cursor = await db.execute(
        "SELECT * FROM gm_waypoint_presets WHERE ship_id = ? ORDER BY COALESCE(pin_order, 999), created_at",
        (ship_id,),
    )
    rows = await cursor.fetchall()

    # Auto-seed if no presets exist for this ship
    if not rows:
        return await _auto_seed_gm_presets(db, ship_id)

    return [parse_gm_preset(row) for row in rows]


@router.post("/gm-presets", response_model=GmWaypointPreset)
async def create_gm_waypoint_preset(
    data: GmWaypointPresetCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new GM waypoint preset."""
    preset_id = data.id or str(uuid.uuid4())
    ts = now_iso()

    await db.execute(
        """INSERT INTO gm_waypoint_presets
           (id, ship_id, name, color, symbol, is_pinned, pin_order,
            text_color, background_color, show_label, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            preset_id,
            data.ship_id,
            data.name,
            data.color,
            data.symbol,
            1 if data.is_pinned else 0,
            data.pin_order,
            data.text_color,
            data.background_color,
            1 if data.show_label else 0,
            ts,
            ts,
        ),
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM gm_waypoint_presets WHERE id = ?",
        (preset_id,),
    )
    return parse_gm_preset(await cursor.fetchone())


@router.patch("/gm-presets/{preset_id}", response_model=GmWaypointPreset)
async def update_gm_waypoint_preset(
    preset_id: str,
    updates: GmWaypointPresetUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a GM waypoint preset."""
    cursor = await db.execute(
        "SELECT id FROM gm_waypoint_presets WHERE id = ?", (preset_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Preset not found")

    fields = []
    values = []
    update_data = updates.model_dump(exclude_unset=True)

    for key, val in update_data.items():
        if key in ("is_pinned", "show_label"):
            fields.append(f"{key} = ?")
            values.append(1 if val else 0)
        else:
            fields.append(f"{key} = ?")
            values.append(val)

    if not fields:
        cursor = await db.execute(
            "SELECT * FROM gm_waypoint_presets WHERE id = ?", (preset_id,)
        )
        return parse_gm_preset(await cursor.fetchone())

    fields.append("updated_at = ?")
    values.append(now_iso())
    values.append(preset_id)

    await db.execute(
        f"UPDATE gm_waypoint_presets SET {', '.join(fields)} WHERE id = ?", values
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM gm_waypoint_presets WHERE id = ?", (preset_id,)
    )
    return parse_gm_preset(await cursor.fetchone())


@router.delete("/gm-presets/{preset_id}")
async def delete_gm_waypoint_preset(
    preset_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a GM waypoint preset."""
    cursor = await db.execute(
        "SELECT id FROM gm_waypoint_presets WHERE id = ?", (preset_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Preset not found")

    await db.execute("DELETE FROM gm_waypoint_presets WHERE id = ?", (preset_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/gm-presets/reset-defaults", response_model=list[GmWaypointPreset])
async def reset_gm_preset_defaults(
    ship_id: str = Query(...),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Reset GM waypoint presets to defaults for a ship."""
    await db.execute("DELETE FROM gm_waypoint_presets WHERE ship_id = ?", (ship_id,))
    await db.commit()
    return await _auto_seed_gm_presets(db, ship_id)


@router.post("/gm-presets/reorder", response_model=list[GmWaypointPreset])
async def reorder_gm_presets(
    ship_id: str = Query(...),
    order: list[str] = Body(..., description="List of preset IDs in pin order (max 6)"),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Reorder pinned presets. IDs in order get pin_order 0-5, others become unpinned."""
    ts = now_iso()

    # Unpin all presets for this ship first
    await db.execute(
        "UPDATE gm_waypoint_presets SET is_pinned = 0, pin_order = NULL, updated_at = ? WHERE ship_id = ?",
        (ts, ship_id),
    )

    # Pin the ones in order (max 6)
    for i, preset_id in enumerate(order[:6]):
        await db.execute(
            "UPDATE gm_waypoint_presets SET is_pinned = 1, pin_order = ?, updated_at = ? WHERE id = ? AND ship_id = ?",
            (i, ts, preset_id, ship_id),
        )

    await db.commit()

    # Return updated list
    cursor = await db.execute(
        "SELECT * FROM gm_waypoint_presets WHERE ship_id = ? ORDER BY COALESCE(pin_order, 999), created_at",
        (ship_id,),
    )
    return [parse_gm_preset(row) for row in await cursor.fetchall()]


# =============================================================================
# Map Endpoints
# =============================================================================


@router.get("", response_model=list[SectorMap])
async def list_sector_maps(
    ship_id: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List sector maps, optionally filtered by ship."""
    query = "SELECT * FROM sector_maps WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)

    query += " ORDER BY sort_order, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_map(row) for row in rows]


@router.get("/active", response_model=SectorMapWithObjects)
async def get_active_sector_map(
    ship_id: str = Query(...),
    visible_only: bool = Query(True),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get the active sector map for a ship with its objects (player endpoint)."""
    cursor = await db.execute(
        "SELECT * FROM sector_maps WHERE ship_id = ? AND is_active = 1",
        (ship_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No active sector map")

    map_data = parse_map(row)
    map_id = map_data["id"]

    objects = await _fetch_objects(db, map_id, visible_only=visible_only)
    sprites = await _fetch_sprites_for_map(db, map_data["ship_id"])
    waypoints = await _fetch_waypoints(db, map_id)

    return {**map_data, "objects": objects, "sprites": sprites, "waypoints": waypoints}


@router.get("/{map_id}", response_model=SectorMapWithObjects)
async def get_sector_map(
    map_id: str,
    visible_only: bool = Query(False),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get a sector map by ID with all its objects."""
    cursor = await db.execute("SELECT * FROM sector_maps WHERE id = ?", (map_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Sector map not found")

    map_data = parse_map(row)
    objects = await _fetch_objects(db, map_id, visible_only=visible_only)
    sprites = await _fetch_sprites_for_map(db, map_data["ship_id"])
    waypoints = await _fetch_waypoints(db, map_id)

    return {**map_data, "objects": objects, "sprites": sprites, "waypoints": waypoints}


@router.post("", response_model=SectorMap)
async def create_sector_map(
    data: SectorMapCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new sector map."""
    map_id = data.id or str(uuid.uuid4())
    ts = now_iso()

    await db.execute(
        """INSERT INTO sector_maps
           (id, ship_id, name, description, hex_size, grid_width, grid_height, grid_radius,
            background_color, background_image_url, bg_scale, bg_rotation, bg_offset_x, bg_offset_y,
            grid_visible, grid_color, grid_opacity, is_active, sort_order,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            map_id,
            data.ship_id,
            data.name,
            data.description,
            data.hex_size,
            data.grid_width,
            data.grid_height,
            data.grid_radius,
            data.background_color,
            data.background_image_url,
            data.bg_scale,
            data.bg_rotation,
            data.bg_offset_x,
            data.bg_offset_y,
            1 if data.grid_visible else 0,
            data.grid_color,
            data.grid_opacity,
            1 if data.is_active else 0,
            data.sort_order,
            ts,
            ts,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_maps WHERE id = ?", (map_id,))
    return parse_map(await cursor.fetchone())


@router.patch("/{map_id}", response_model=SectorMap)
async def update_sector_map(
    map_id: str,
    updates: SectorMapUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a sector map's metadata."""
    cursor = await db.execute("SELECT id FROM sector_maps WHERE id = ?", (map_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sector map not found")

    fields = []
    values = []
    update_data = updates.model_dump(exclude_unset=True)

    for key, val in update_data.items():
        if key in ("is_active", "grid_visible"):
            fields.append(f"{key} = ?")
            values.append(1 if val else 0)
        else:
            fields.append(f"{key} = ?")
            values.append(val)

    if not fields:
        cursor = await db.execute("SELECT * FROM sector_maps WHERE id = ?", (map_id,))
        return parse_map(await cursor.fetchone())

    fields.append("updated_at = ?")
    values.append(now_iso())
    values.append(map_id)

    await db.execute(f"UPDATE sector_maps SET {', '.join(fields)} WHERE id = ?", values)
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_maps WHERE id = ?", (map_id,))
    return parse_map(await cursor.fetchone())


@router.delete("/{map_id}")
async def delete_sector_map(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a sector map (cascades to objects)."""
    cursor = await db.execute("SELECT id FROM sector_maps WHERE id = ?", (map_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sector map not found")

    await db.execute("DELETE FROM sector_maps WHERE id = ?", (map_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/{map_id}/set-active", response_model=SectorMap)
async def set_active_sector_map(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Set this map as the active map for the ship (clears other active maps)."""
    cursor = await db.execute("SELECT ship_id FROM sector_maps WHERE id = ?", (map_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Sector map not found")

    ship_id = row[0]
    ts = now_iso()

    # Clear all active maps for this ship
    await db.execute(
        "UPDATE sector_maps SET is_active = 0, updated_at = ? WHERE ship_id = ?",
        (ts, ship_id),
    )
    # Set this map active
    await db.execute(
        "UPDATE sector_maps SET is_active = 1, updated_at = ? WHERE id = ?",
        (ts, map_id),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_maps WHERE id = ?", (map_id,))
    return parse_map(await cursor.fetchone())


@router.post("/{map_id}/deactivate", response_model=SectorMap)
async def deactivate_sector_map(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Deactivate this map (hides from players)."""
    cursor = await db.execute("SELECT id FROM sector_maps WHERE id = ?", (map_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sector map not found")

    ts = now_iso()
    await db.execute(
        "UPDATE sector_maps SET is_active = 0, updated_at = ? WHERE id = ?",
        (ts, map_id),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_maps WHERE id = ?", (map_id,))
    return parse_map(await cursor.fetchone())


# =============================================================================
# Sprite Endpoints
# =============================================================================


@router.get("/sprites/list", response_model=list[SectorSprite])
async def list_sector_sprites(
    ship_id: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all sprites in the sprite library."""
    query = "SELECT * FROM sector_sprites WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)

    query += " ORDER BY category, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_sprite(row) for row in rows]


@router.post("/sprites", response_model=SectorSprite)
async def create_sector_sprite(
    data: SectorSpriteCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new sprite definition."""
    sprite_id = data.id or str(uuid.uuid4())
    ts = now_iso()

    await db.execute(
        """INSERT INTO sector_sprites
           (id, ship_id, name, category, image_url, default_locked, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            sprite_id,
            data.ship_id,
            data.name,
            data.category,
            data.image_url,
            1 if data.default_locked else 0,
            ts,
            ts,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_sprites WHERE id = ?", (sprite_id,))
    return parse_sprite(await cursor.fetchone())


@router.patch("/sprites/{sprite_id}", response_model=SectorSprite)
async def update_sector_sprite(
    sprite_id: str,
    updates: SectorSpriteUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a sprite definition."""
    cursor = await db.execute("SELECT id FROM sector_sprites WHERE id = ?", (sprite_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sprite not found")

    fields = []
    values = []
    update_data = updates.model_dump(exclude_unset=True)

    for key, val in update_data.items():
        if key == "default_locked":
            fields.append("default_locked = ?")
            values.append(1 if val else 0)
        else:
            fields.append(f"{key} = ?")
            values.append(val)

    if not fields:
        cursor = await db.execute("SELECT * FROM sector_sprites WHERE id = ?", (sprite_id,))
        return parse_sprite(await cursor.fetchone())

    fields.append("updated_at = ?")
    values.append(now_iso())
    values.append(sprite_id)

    await db.execute(f"UPDATE sector_sprites SET {', '.join(fields)} WHERE id = ?", values)
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_sprites WHERE id = ?", (sprite_id,))
    return parse_sprite(await cursor.fetchone())


@router.delete("/sprites/{sprite_id}")
async def delete_sector_sprite(
    sprite_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a sprite (objects referencing it will have sprite_id set to NULL)."""
    cursor = await db.execute("SELECT id FROM sector_sprites WHERE id = ?", (sprite_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sprite not found")

    await db.execute("DELETE FROM sector_sprites WHERE id = ?", (sprite_id,))
    await db.commit()
    return {"deleted": True}


# =============================================================================
# Map Object Endpoints
# =============================================================================


@router.get("/{map_id}/objects", response_model=list[SectorMapObject])
async def list_map_objects(
    map_id: str,
    visible_only: bool = Query(False),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List objects placed on a map."""
    cursor = await db.execute("SELECT id FROM sector_maps WHERE id = ?", (map_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sector map not found")

    return await _fetch_objects(db, map_id, visible_only=visible_only)


@router.post("/{map_id}/objects", response_model=SectorMapObject)
async def create_map_object(
    map_id: str,
    data: SectorMapObjectCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Place a new object on the map."""
    cursor = await db.execute("SELECT id FROM sector_maps WHERE id = ?", (map_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sector map not found")

    obj_id = data.id or str(uuid.uuid4())
    ts = now_iso()

    await db.execute(
        """INSERT INTO sector_map_objects
           (id, map_id, sprite_id, hex_q, hex_r, label, description,
            scale, rotation, visibility_state, locked, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            obj_id,
            map_id,
            data.sprite_id,
            data.hex_q,
            data.hex_r,
            data.label,
            data.description,
            data.scale,
            data.rotation,
            data.visibility_state,
            1 if data.locked else 0,
            ts,
            ts,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_map_objects WHERE id = ?", (obj_id,))
    return parse_object(await cursor.fetchone())


@router.patch("/objects/{obj_id}", response_model=SectorMapObject)
async def update_map_object(
    obj_id: str,
    updates: SectorMapObjectUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a placed map object (position, label, lock, visibility, etc.)."""
    cursor = await db.execute("SELECT id FROM sector_map_objects WHERE id = ?", (obj_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Map object not found")

    fields = []
    values = []
    update_data = updates.model_dump(exclude_unset=True)

    for key, val in update_data.items():
        if key == "locked":
            fields.append("locked = ?")
            values.append(1 if val else 0)
        else:
            fields.append(f"{key} = ?")
            values.append(val)

    if not fields:
        cursor = await db.execute("SELECT * FROM sector_map_objects WHERE id = ?", (obj_id,))
        return parse_object(await cursor.fetchone())

    fields.append("updated_at = ?")
    values.append(now_iso())
    values.append(obj_id)

    await db.execute(f"UPDATE sector_map_objects SET {', '.join(fields)} WHERE id = ?", values)
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_map_objects WHERE id = ?", (obj_id,))
    return parse_object(await cursor.fetchone())


@router.delete("/objects/{obj_id}")
async def delete_map_object(
    obj_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Remove an object from the map."""
    cursor = await db.execute("SELECT id FROM sector_map_objects WHERE id = ?", (obj_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Map object not found")

    await db.execute("DELETE FROM sector_map_objects WHERE id = ?", (obj_id,))
    await db.commit()
    return {"deleted": True}


# =============================================================================
# Waypoint Endpoints
# =============================================================================


@router.get("/{map_id}/waypoints", response_model=list[SectorWaypoint])
async def list_waypoints(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all waypoints on a map."""
    cursor = await db.execute("SELECT id FROM sector_maps WHERE id = ?", (map_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sector map not found")

    return await _fetch_waypoints(db, map_id)


@router.post("/{map_id}/waypoints", response_model=SectorWaypoint)
async def create_waypoint(
    map_id: str,
    data: SectorWaypointCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Place a waypoint on the map."""
    cursor = await db.execute("SELECT id FROM sector_maps WHERE id = ?", (map_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sector map not found")

    wp_id = data.id or str(uuid.uuid4())
    ts = now_iso()

    await db.execute(
        """INSERT INTO sector_map_waypoints
           (id, map_id, hex_q, hex_r, label, color, symbol, text_color, background_color,
            show_label, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            wp_id,
            map_id,
            data.hex_q,
            data.hex_r,
            data.label,
            data.color,
            data.symbol,
            data.text_color,
            data.background_color,
            1 if data.show_label else 0,
            data.created_by,
            ts,
            ts,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_map_waypoints WHERE id = ?", (wp_id,))
    return parse_waypoint(await cursor.fetchone())


@router.patch("/waypoints/{waypoint_id}", response_model=SectorWaypoint)
async def update_waypoint(
    waypoint_id: str,
    updates: SectorWaypointUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a waypoint."""
    cursor = await db.execute(
        "SELECT id FROM sector_map_waypoints WHERE id = ?", (waypoint_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Waypoint not found")

    fields = []
    values = []
    update_data = updates.model_dump(exclude_unset=True)

    for key, val in update_data.items():
        if key == "show_label":
            fields.append(f"{key} = ?")
            values.append(1 if val else 0)
        else:
            fields.append(f"{key} = ?")
            values.append(val)

    if not fields:
        cursor = await db.execute(
            "SELECT * FROM sector_map_waypoints WHERE id = ?", (waypoint_id,)
        )
        return parse_waypoint(await cursor.fetchone())

    fields.append("updated_at = ?")
    values.append(now_iso())
    values.append(waypoint_id)

    await db.execute(
        f"UPDATE sector_map_waypoints SET {', '.join(fields)} WHERE id = ?", values
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM sector_map_waypoints WHERE id = ?", (waypoint_id,))
    return parse_waypoint(await cursor.fetchone())


@router.delete("/waypoints/{waypoint_id}")
async def delete_waypoint(
    waypoint_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a waypoint."""
    cursor = await db.execute(
        "SELECT id FROM sector_map_waypoints WHERE id = ?", (waypoint_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Waypoint not found")

    await db.execute("DELETE FROM sector_map_waypoints WHERE id = ?", (waypoint_id,))
    await db.commit()
    return {"deleted": True}


@router.delete("/{map_id}/waypoints/gm")
async def clear_gm_waypoints(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete all GM waypoints on a map."""
    cursor = await db.execute("SELECT id FROM sector_maps WHERE id = ?", (map_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sector map not found")

    await db.execute(
        "DELETE FROM sector_map_waypoints WHERE map_id = ? AND created_by = 'gm'",
        (map_id,),
    )
    await db.commit()
    return {"deleted": True}


# =============================================================================
# Helpers
# =============================================================================


async def _fetch_objects(
    db: aiosqlite.Connection, map_id: str, visible_only: bool = False
) -> list[dict]:
    """Fetch all objects for a map. visible_only includes anomaly objects (player sees as unknown)."""
    if visible_only:
        cursor = await db.execute(
            "SELECT * FROM sector_map_objects WHERE map_id = ? AND visibility_state IN ('visible', 'anomaly') ORDER BY created_at",
            (map_id,),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM sector_map_objects WHERE map_id = ? ORDER BY created_at",
            (map_id,),
        )
    rows = await cursor.fetchall()
    return [parse_object(row) for row in rows]


async def _fetch_sprites_for_map(db: aiosqlite.Connection, ship_id: str) -> list[dict]:
    """Fetch all sprites available for a ship."""
    cursor = await db.execute(
        "SELECT * FROM sector_sprites WHERE ship_id = ? ORDER BY category, name",
        (ship_id,),
    )
    rows = await cursor.fetchall()
    return [parse_sprite(row) for row in rows]


async def _fetch_waypoints(db: aiosqlite.Connection, map_id: str) -> list[dict]:
    """Fetch all waypoints for a map."""
    try:
        cursor = await db.execute(
            "SELECT * FROM sector_map_waypoints WHERE map_id = ? ORDER BY created_at",
            (map_id,),
        )
        rows = await cursor.fetchall()
        return [parse_waypoint(row) for row in rows]
    except Exception:
        # Table may not exist on old databases before migration v29 runs
        return []
