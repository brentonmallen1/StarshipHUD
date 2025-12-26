"""
Asset API endpoints (weapons, drones, probes).
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import aiosqlite

from app.database import get_db
from app.models.asset import Asset, AssetCreate, AssetUpdate

router = APIRouter()


@router.get("", response_model=list[Asset])
async def list_assets(
    ship_id: Optional[str] = Query(None),
    asset_type: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List assets, optionally filtered by ship and/or type."""
    query = "SELECT * FROM assets WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if asset_type:
        query += " AND asset_type = ?"
        params.append(asset_type)

    query += " ORDER BY mount_location, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/{asset_id}", response_model=Asset)
async def get_asset(asset_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get an asset by ID."""
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    return dict(row)


@router.post("", response_model=Asset)
async def create_asset(
    asset: AssetCreate, db: aiosqlite.Connection = Depends(get_db)
):
    """Create a new asset."""
    asset_id = asset.id if asset.id else str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

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
            asset_id,
            asset.ship_id,
            asset.name,
            asset.asset_type.value,
            asset.status.value,
            asset.ammo_current,
            asset.ammo_max,
            asset.ammo_type,
            asset.range,
            asset.range_unit,
            asset.damage,
            asset.accuracy,
            asset.charge_time,
            asset.cooldown,
            asset.fire_mode.value if asset.fire_mode else None,
            1 if asset.is_armed else 0,
            1 if asset.is_ready else 0,
            asset.current_target,
            asset.mount_location.value if asset.mount_location else None,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    return dict(await cursor.fetchone())


@router.patch("/{asset_id}", response_model=Asset)
async def update_asset(
    asset_id: str,
    asset: AssetUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update an asset."""
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    current = await cursor.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = asset.model_dump(exclude_unset=True)

    # Build update query
    updates = []
    values = []

    for field, value in update_data.items():
        if field == "status" and value:
            value = value.value
        elif field == "asset_type" and value:
            value = value.value
        elif field == "fire_mode" and value:
            value = value.value
        elif field == "mount_location" and value:
            value = value.value
        elif field in ["is_armed", "is_ready"] and value is not None:
            value = 1 if value else 0

        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(asset_id)
        await db.execute(
            f"UPDATE assets SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    return dict(await cursor.fetchone())


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete an asset."""
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Asset not found")

    await db.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
    await db.commit()
    return {"deleted": True}
