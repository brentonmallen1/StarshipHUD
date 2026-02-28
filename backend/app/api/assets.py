"""
Asset API endpoints (weapons, drones, probes).
"""

import json
import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.asset import Asset, AssetCreate, AssetUpdate
from app.models.base import SystemStatus
from app.utils import safe_json_loads

router = APIRouter()

# Status ordering for cascade computation (worst to best)
STATUS_ORDER = [
    SystemStatus.DESTROYED,
    SystemStatus.CRITICAL,
    SystemStatus.COMPROMISED,
    SystemStatus.DEGRADED,
    SystemStatus.OFFLINE,
    SystemStatus.OPERATIONAL,
    SystemStatus.OPTIMAL,
]


def compute_asset_effective_status(
    asset: dict,
    all_systems: dict[str, dict],
) -> SystemStatus:
    """
    Compute effective status for an asset based on its parent system dependencies.
    An asset's effective status is capped by its parent systems' effective statuses.
    """
    own_status = SystemStatus(asset["status"])

    depends_on = asset.get("depends_on", [])
    if isinstance(depends_on, str):
        depends_on = safe_json_loads(depends_on, default=[], field_name="depends_on")

    if not depends_on:
        return own_status

    # Find worst parent effective status
    worst_parent = SystemStatus.OPTIMAL
    for parent_id in depends_on:
        if parent_id in all_systems:
            parent = all_systems[parent_id]
            # Use effective_status if available, otherwise use status
            parent_status = SystemStatus(parent.get("effective_status") or parent["status"])
            if STATUS_ORDER.index(parent_status) < STATUS_ORDER.index(worst_parent):
                worst_parent = parent_status

    # Return the worse of own status vs parent cap
    if STATUS_ORDER.index(own_status) < STATUS_ORDER.index(worst_parent):
        return own_status  # Own status is already worse
    return worst_parent  # Capped by parent


def find_asset_capping_parent(
    asset: dict,
    all_systems: dict[str, dict],
) -> dict | None:
    """
    Find the system that is capping this asset's status.
    Returns info about the worst parent causing the cap.
    """
    depends_on = asset.get("depends_on", [])
    if isinstance(depends_on, str):
        depends_on = safe_json_loads(depends_on, default=[], field_name="depends_on")

    if not depends_on:
        return None

    worst_parent = None
    worst_idx = len(STATUS_ORDER)

    for parent_id in depends_on:
        if parent_id in all_systems:
            parent = all_systems[parent_id]
            parent_status = SystemStatus(parent.get("effective_status") or parent["status"])
            idx = STATUS_ORDER.index(parent_status)
            if idx < worst_idx:
                worst_idx = idx
                worst_parent = {
                    "id": parent_id,
                    "name": parent["name"],
                    "effective_status": parent_status.value,
                }

    return worst_parent


def enrich_asset_with_effective_status(asset: dict, all_systems: dict[str, dict]) -> dict:
    """Add effective_status and limiting_parent to an asset."""
    result = dict(asset)

    # Parse depends_on from JSON string if needed
    depends_on = result.get("depends_on", "[]")
    if isinstance(depends_on, str):
        result["depends_on"] = safe_json_loads(depends_on, default=[], field_name="depends_on")

    # Compute effective status
    own_status = SystemStatus(result["status"])
    effective = compute_asset_effective_status(result, all_systems)
    result["effective_status"] = effective.value

    # If effective status is worse than own status, find the limiting parent
    if STATUS_ORDER.index(effective) < STATUS_ORDER.index(own_status):
        capping_parent = find_asset_capping_parent(result, all_systems)
        if capping_parent:
            result["limiting_parent"] = capping_parent
        else:
            result["limiting_parent"] = None
    else:
        result["limiting_parent"] = None

    return result


async def get_all_systems_for_ship(ship_id: str, db: aiosqlite.Connection) -> dict[str, dict]:
    """Fetch all system states for a ship as a lookup dict."""
    cursor = await db.execute("SELECT * FROM system_states WHERE ship_id = ?", (ship_id,))
    rows = await cursor.fetchall()
    return {r["id"]: dict(r) for r in rows}


@router.get("", response_model=list[Asset])
async def list_assets(
    ship_id: str | None = Query(None),
    asset_type: str | None = Query(None),
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

    # Build lookup of all systems for cascade computation
    if ship_id:
        all_systems = await get_all_systems_for_ship(ship_id, db)
    else:
        # If no ship filter, get all systems
        sys_cursor = await db.execute("SELECT * FROM system_states")
        sys_rows = await sys_cursor.fetchall()
        all_systems = {r["id"]: dict(r) for r in sys_rows}

    return [enrich_asset_with_effective_status(dict(row), all_systems) for row in rows]


@router.get("/{asset_id}", response_model=Asset)
async def get_asset(asset_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get an asset by ID."""
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset = dict(row)

    # Fetch all systems from same ship for cascade computation
    all_systems = await get_all_systems_for_ship(asset["ship_id"], db)

    return enrich_asset_with_effective_status(asset, all_systems)


@router.post("", response_model=Asset)
async def create_asset(asset: AssetCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new asset."""
    asset_id = asset.id if asset.id else str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    # Validate depends_on references valid system states (not assets)
    if asset.depends_on:
        placeholders = ",".join("?" * len(asset.depends_on))
        cursor = await db.execute(
            f"SELECT id FROM system_states WHERE id IN ({placeholders})",
            asset.depends_on,
        )
        valid_ids = {row["id"] for row in await cursor.fetchall()}
        invalid_ids = set(asset.depends_on) - valid_ids
        if invalid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid depends_on references (must be system states): {list(invalid_ids)}",
            )

    await db.execute(
        """
        INSERT INTO assets (
            id, ship_id, name, asset_type, status,
            ammo_current, ammo_max, ammo_type,
            range, range_unit, damage, accuracy,
            charge_time, cooldown, fire_mode,
            is_armed, is_ready, current_target,
            mount_location, depends_on, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            json.dumps(asset.depends_on),
            now,
            now,
        ),
    )
    await db.commit()

    # Fetch and return enriched asset
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    created = dict(await cursor.fetchone())

    all_systems = await get_all_systems_for_ship(asset.ship_id, db)

    return enrich_asset_with_effective_status(created, all_systems)


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

    current_dict = dict(current)
    update_data = asset.model_dump(exclude_unset=True)

    # Validate depends_on if being updated
    if "depends_on" in update_data and update_data["depends_on"]:
        placeholders = ",".join("?" * len(update_data["depends_on"]))
        cursor = await db.execute(
            f"SELECT id FROM system_states WHERE id IN ({placeholders})",
            update_data["depends_on"],
        )
        valid_ids = {row["id"] for row in await cursor.fetchall()}
        invalid_ids = set(update_data["depends_on"]) - valid_ids
        if invalid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid depends_on references (must be system states): {list(invalid_ids)}",
            )

    # AMMO/READY STATE LOGIC: If ammo_current is being set to 0, force is_ready to false
    if "ammo_current" in update_data:
        new_ammo = update_data["ammo_current"]
        # Only apply if this is a weapon that uses ammo
        if current_dict["ammo_max"] > 0 and new_ammo <= 0:
            update_data["is_ready"] = False

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
        elif field == "depends_on":
            value = json.dumps(value) if value is not None else "[]"

        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.now(UTC).isoformat())
        values.append(asset_id)
        await db.execute(
            f"UPDATE assets SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    # Fetch and return enriched asset
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    updated = dict(await cursor.fetchone())

    all_systems = await get_all_systems_for_ship(current_dict["ship_id"], db)

    return enrich_asset_with_effective_status(updated, all_systems)


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete an asset."""
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Asset not found")

    await db.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/{asset_id}/fire", response_model=Asset)
async def fire_asset(
    asset_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Fire a weapon asset.
    - Decrements ammo_current by 1 (for weapons that use ammo)
    - Sets is_ready to false (starts cooldown)
    - Emits a weapon_fired event to the ship log
    - Returns error if weapon cannot fire
    """
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    current = await cursor.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Asset not found")

    current_dict = dict(current)
    ship_id = current_dict["ship_id"]

    # Get systems for effective status check
    all_systems = await get_all_systems_for_ship(ship_id, db)
    enriched = enrich_asset_with_effective_status(current_dict, all_systems)

    # Check firing conditions
    if not current_dict["is_armed"]:
        raise HTTPException(status_code=400, detail="Weapon is not armed")

    if not current_dict["is_ready"]:
        raise HTTPException(status_code=400, detail="Weapon is not ready (on cooldown)")

    # Check ammo (only for weapons that use ammo)
    uses_ammo = current_dict["ammo_max"] > 0
    if uses_ammo and current_dict["ammo_current"] <= 0:
        raise HTTPException(status_code=400, detail="No ammunition remaining")

    # Check effective status - cannot fire if destroyed or offline
    effective_status = enriched.get("effective_status", current_dict["status"])
    if effective_status in ["destroyed", "offline"]:
        raise HTTPException(status_code=400, detail=f"Weapon cannot fire: status is {effective_status}")

    # Perform the fire action
    from datetime import timedelta

    now_dt = datetime.now(UTC)
    now = now_dt.isoformat()
    ammo_before = current_dict["ammo_current"]
    new_ammo = ammo_before

    # Decrement ammo if weapon uses ammo
    if uses_ammo:
        new_ammo = max(0, ammo_before - 1)

    # Calculate cooldown_until (when weapon will be ready again)
    cooldown_seconds = current_dict.get("cooldown") or 0
    cooldown_until = None
    if cooldown_seconds > 0:
        cooldown_until = (now_dt + timedelta(seconds=cooldown_seconds)).isoformat()

    # Set is_ready to false and cooldown_until
    await db.execute(
        """
        UPDATE assets
        SET ammo_current = ?, is_ready = 0, cooldown_until = ?, updated_at = ?
        WHERE id = ?
        """,
        (new_ammo, cooldown_until, now, asset_id),
    )

    # Look up target info if current_target is set
    target_id = current_dict.get("current_target")
    target_name = None
    if target_id:
        target_cursor = await db.execute(
            "SELECT label FROM sensor_contacts WHERE id = ?", (target_id,)
        )
        target_row = await target_cursor.fetchone()
        if target_row:
            target_name = target_row["label"]

    # Emit weapon_fired event
    event_id = str(uuid.uuid4())
    asset_name = current_dict["name"]

    if target_name:
        message = f"{asset_name} fired at {target_name}"
    else:
        message = f"{asset_name} fired"

    event_data = {
        "asset_id": asset_id,
        "asset_name": asset_name,
        "asset_type": current_dict["asset_type"],
        "mount_location": current_dict.get("mount_location"),
        "ammo_before": ammo_before if uses_ammo else None,
        "ammo_after": new_ammo if uses_ammo else None,
    }
    if target_id:
        event_data["target_id"] = target_id
        event_data["target_name"] = target_name

    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, transmitted, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            ship_id,
            "weapon_fired",
            "info",
            message,
            json.dumps(event_data),
            1,  # transmitted = visible to players
            "system",
            now,
        ),
    )

    await db.commit()

    # Return enriched updated asset
    cursor = await db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    updated = dict(await cursor.fetchone())

    return enrich_asset_with_effective_status(updated, all_systems)
