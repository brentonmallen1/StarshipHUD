"""
Sector map API endpoints for the hex grid tactical map system.

Persistence and preset seeding live in app/services/sector_map.py.
"""

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
from app.services import sector_map as svc
from app.services.authz import AuthzDep
from app.services.sector_map import GM_PRESETS, MAPS, OBJECTS, SPRITES, WAYPOINTS

router = APIRouter()


# =============================================================================
# GM Waypoint Preset Endpoints (must be before /{map_id} routes)
# =============================================================================


@router.get("/gm-presets", response_model=list[GmWaypointPreset])
async def list_gm_waypoint_presets(
    ship_id: str = Query(...),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all GM waypoint presets for a ship, ordered by pin_order. Auto-seeds defaults if empty."""
    presets, seeded = await svc.list_gm_presets(db, ship_id)
    if seeded:
        await db.commit()
    return presets


@router.post("/gm-presets", response_model=GmWaypointPreset)
async def create_gm_waypoint_preset(
    data: GmWaypointPresetCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new GM waypoint preset."""
    preset = await svc.insert(db, GM_PRESETS, data)
    await db.commit()
    return preset


@router.patch("/gm-presets/{preset_id}", response_model=GmWaypointPreset)
async def update_gm_waypoint_preset(
    preset_id: str,
    updates: GmWaypointPresetUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a GM waypoint preset."""
    _, preset = await svc.update(db, GM_PRESETS, preset_id, updates.model_dump(exclude_unset=True))
    await db.commit()
    return preset


@router.delete("/gm-presets/{preset_id}")
async def delete_gm_waypoint_preset(
    preset_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a GM waypoint preset."""
    await svc.delete(db, GM_PRESETS, preset_id)
    await db.commit()
    return {"deleted": True}


@router.post("/gm-presets/reset-defaults", response_model=list[GmWaypointPreset])
async def reset_gm_preset_defaults(
    ship_id: str = Query(...),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Reset GM waypoint presets to defaults for a ship."""
    presets = await svc.reset_gm_presets(db, ship_id)
    await db.commit()
    return presets


@router.post("/gm-presets/reorder", response_model=list[GmWaypointPreset])
async def reorder_gm_presets(
    ship_id: str = Query(...),
    order: list[str] = Body(..., description="List of preset IDs in pin order (max 6)"),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Reorder pinned presets. IDs in order get pin_order 0-5, others become unpinned."""
    presets = await svc.reorder_gm_presets(db, ship_id, order)
    await db.commit()
    return presets


# =============================================================================
# Map Endpoints
# =============================================================================


@router.get("", response_model=list[SectorMap])
async def list_sector_maps(
    ship_id: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List sector maps, optionally filtered by ship."""
    return await svc.list_rows(db, MAPS, "sort_order, name", [("ship_id", ship_id)])


@router.get("/active", response_model=SectorMapWithObjects)
async def get_active_sector_map(
    authz: AuthzDep,
    ship_id: str = Query(...),
    visible_only: bool = Query(True),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get the active sector map for a ship with its objects (player endpoint)."""
    cursor = await db.execute("SELECT * FROM sector_maps WHERE ship_id = ? AND is_active = 1", (ship_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No active sector map")
    return await svc.map_with_contents(db, dict(row), player=authz.is_player, visible_only=visible_only)


@router.get("/{map_id}", response_model=SectorMapWithObjects)
async def get_sector_map(
    authz: AuthzDep,
    map_id: str,
    visible_only: bool = Query(False),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get a sector map by ID with all its objects."""
    row = await svc.get_raw(db, MAPS, map_id)
    return await svc.map_with_contents(db, row, player=authz.is_player, visible_only=visible_only)


@router.post("", response_model=SectorMap)
async def create_sector_map(
    data: SectorMapCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new sector map."""
    sector_map = await svc.insert(db, MAPS, data)
    await db.commit()
    return sector_map


@router.patch("/{map_id}", response_model=SectorMap)
async def update_sector_map(
    map_id: str,
    updates: SectorMapUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a sector map's metadata."""
    _, sector_map = await svc.update(db, MAPS, map_id, updates.model_dump(exclude_unset=True))
    await db.commit()
    return sector_map


@router.delete("/{map_id}")
async def delete_sector_map(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a sector map (cascades to objects)."""
    await svc.delete(db, MAPS, map_id)
    await db.commit()
    return {"deleted": True}


@router.post("/{map_id}/set-active", response_model=SectorMap)
async def set_active_sector_map(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Set this map as the active map for the ship (clears other active maps)."""
    sector_map = await svc.set_active(db, map_id)
    await db.commit()
    return sector_map


@router.post("/{map_id}/deactivate", response_model=SectorMap)
async def deactivate_sector_map(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Deactivate this map (hides from players)."""
    sector_map = await svc.deactivate(db, map_id)
    await db.commit()
    return sector_map


# =============================================================================
# Sprite Endpoints
# =============================================================================


@router.get("/sprites/list", response_model=list[SectorSprite])
async def list_sector_sprites(
    ship_id: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all sprites in the sprite library."""
    return await svc.list_rows(db, SPRITES, "category, name", [("ship_id", ship_id)])


@router.post("/sprites", response_model=SectorSprite)
async def create_sector_sprite(
    data: SectorSpriteCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new sprite definition."""
    sprite = await svc.insert(db, SPRITES, data)
    await db.commit()
    return sprite


@router.patch("/sprites/{sprite_id}", response_model=SectorSprite)
async def update_sector_sprite(
    sprite_id: str,
    updates: SectorSpriteUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a sprite definition."""
    _, sprite = await svc.update(db, SPRITES, sprite_id, updates.model_dump(exclude_unset=True))
    await db.commit()
    return sprite


@router.delete("/sprites/{sprite_id}")
async def delete_sector_sprite(
    sprite_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a sprite (objects referencing it will have sprite_id set to NULL)."""
    await svc.delete(db, SPRITES, sprite_id)
    await db.commit()
    return {"deleted": True}


# =============================================================================
# Map Object Endpoints
# =============================================================================


@router.get("/{map_id}/objects", response_model=list[SectorMapObject])
async def list_map_objects(
    authz: AuthzDep,
    map_id: str,
    visible_only: bool = Query(False),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List objects placed on a map."""
    await svc.get_raw(db, MAPS, map_id)
    return await svc.fetch_objects(
        db, map_id, visible_only=visible_only or authz.is_player, redact_anomalies=authz.is_player
    )


@router.post("/{map_id}/objects", response_model=SectorMapObject)
async def create_map_object(
    map_id: str,
    data: SectorMapObjectCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Place a new object on the map."""
    await svc.get_raw(db, MAPS, map_id)
    obj = await svc.insert(db, OBJECTS, data.model_copy(update={"map_id": map_id}))
    await db.commit()
    return obj


@router.patch("/objects/{obj_id}", response_model=SectorMapObject)
async def update_map_object(
    obj_id: str,
    updates: SectorMapObjectUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a placed map object (position, label, lock, visibility, etc.)."""
    _, obj = await svc.update(db, OBJECTS, obj_id, updates.model_dump(exclude_unset=True))
    await db.commit()
    return obj


@router.delete("/objects/{obj_id}")
async def delete_map_object(
    obj_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Remove an object from the map."""
    await svc.delete(db, OBJECTS, obj_id)
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
    await svc.get_raw(db, MAPS, map_id)
    return await svc.fetch_waypoints(db, map_id)


@router.post("/{map_id}/waypoints", response_model=SectorWaypoint)
async def create_waypoint(
    map_id: str,
    data: SectorWaypointCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Place a waypoint on the map."""
    await svc.get_raw(db, MAPS, map_id)
    waypoint = await svc.insert(db, WAYPOINTS, data.model_copy(update={"map_id": map_id}))
    await db.commit()
    return waypoint


@router.patch("/waypoints/{waypoint_id}", response_model=SectorWaypoint)
async def update_waypoint(
    waypoint_id: str,
    updates: SectorWaypointUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a waypoint."""
    _, waypoint = await svc.update(db, WAYPOINTS, waypoint_id, updates.model_dump(exclude_unset=True))
    await db.commit()
    return waypoint


@router.delete("/waypoints/{waypoint_id}")
async def delete_waypoint(
    waypoint_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a waypoint."""
    await svc.delete(db, WAYPOINTS, waypoint_id)
    await db.commit()
    return {"deleted": True}


@router.delete("/{map_id}/waypoints/gm")
async def clear_gm_waypoints(
    map_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete all GM waypoints on a map."""
    await svc.get_raw(db, MAPS, map_id)
    await db.execute("DELETE FROM sector_map_waypoints WHERE map_id = ? AND created_by = 'gm'", (map_id,))
    await db.commit()
    return {"deleted": True}
