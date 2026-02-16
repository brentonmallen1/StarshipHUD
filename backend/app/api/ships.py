"""
Ship API endpoints.
"""

import json
import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.ship import Ship, ShipCreate, ShipUpdate
from app.seed import create_ship_with_seed
from app.utils import safe_json_loads

router = APIRouter()


# Predefined ROE presets for each posture level
ROE_PRESETS = {
    "green": {
        "weapons_safeties": "on",
        "comms_broadcast": "open",
        "transponder": "active",
        "sensor_emissions": "standard",
    },
    "yellow": {
        "weapons_safeties": "on",
        "comms_broadcast": "encrypted",
        "transponder": "active",
        "sensor_emissions": "standard",
    },
    "red": {
        "weapons_safeties": "off",
        "comms_broadcast": "encrypted",
        "transponder": "active",
        "sensor_emissions": "standard",
    },
    "silent_running": {
        "weapons_safeties": "on",
        "comms_broadcast": "silent",
        "transponder": "off",
        "sensor_emissions": "passive_only",
    },
    "general_quarters": {
        "weapons_safeties": "off",
        "comms_broadcast": "encrypted",
        "transponder": "masked",
        "sensor_emissions": "standard",
    },
}


def parse_ship_row(row: aiosqlite.Row) -> dict:
    """Parse a ship row, deserializing JSON fields."""
    data = dict(row)
    data["attributes"] = safe_json_loads(data.get("attributes"), default={}, field_name="attributes")
    return data


@router.get("", response_model=list[Ship])
async def list_ships(db: aiosqlite.Connection = Depends(get_db)):
    """List all ships."""
    cursor = await db.execute("SELECT * FROM ships ORDER BY name")
    rows = await cursor.fetchall()
    return [parse_ship_row(row) for row in rows]


@router.get("/{ship_id}", response_model=Ship)
async def get_ship(ship_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a ship by ID."""
    cursor = await db.execute("SELECT * FROM ships WHERE id = ?", (ship_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ship not found")
    return parse_ship_row(row)


@router.post("", response_model=Ship)
async def create_ship(ship: ShipCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new ship with optional seed data."""
    ship_id = await create_ship_with_seed(
        db=db,
        ship_name=ship.name,
        seed_type=ship.seed_type,
        ship_class=ship.ship_class,
        registry=ship.registry,
        description=ship.description,
        attributes=ship.attributes,
    )

    cursor = await db.execute("SELECT * FROM ships WHERE id = ?", (ship_id,))
    return parse_ship_row(await cursor.fetchone())


@router.patch("/{ship_id}", response_model=Ship)
async def update_ship(ship_id: str, ship: ShipUpdate, db: aiosqlite.Connection = Depends(get_db)):
    """Update a ship."""
    # Check exists
    cursor = await db.execute("SELECT * FROM ships WHERE id = ?", (ship_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Ship not found")

    # Build update query
    updates = []
    values = []
    for field, value in ship.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = ?")
        # Serialize attributes as JSON
        if field == "attributes":
            values.append(json.dumps(value))
        else:
            values.append(value)

    if updates:
        values.append(datetime.now(UTC).isoformat())
        values.append(ship_id)
        await db.execute(
            f"UPDATE ships SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM ships WHERE id = ?", (ship_id,))
    return parse_ship_row(await cursor.fetchone())


@router.delete("/{ship_id}")
async def delete_ship(ship_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a ship."""
    cursor = await db.execute("SELECT * FROM ships WHERE id = ?", (ship_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Ship not found")

    await db.execute("DELETE FROM ships WHERE id = ?", (ship_id,))
    await db.commit()
    return {"deleted": True}


@router.get("/{ship_id}/posture")
async def get_posture(ship_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get ship posture state."""
    cursor = await db.execute("SELECT * FROM posture_state WHERE ship_id = ?", (ship_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ship not found")
    result = dict(row)
    result["roe"] = safe_json_loads(result["roe"], default={}, field_name="roe")
    return result


@router.patch("/{ship_id}/posture")
async def update_posture(
    ship_id: str,
    posture: str,
    reason: str = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update ship posture. Automatically applies ROE preset for the new posture."""
    valid_postures = ["green", "yellow", "red", "silent_running", "general_quarters"]
    if posture not in valid_postures:
        raise HTTPException(status_code=400, detail=f"Invalid posture: {posture}")

    now = datetime.now(UTC).isoformat()
    roe_json = json.dumps(ROE_PRESETS.get(posture, ROE_PRESETS["green"]))

    await db.execute(
        """
        UPDATE posture_state
        SET posture = ?, roe = ?, posture_set_at = ?, posture_set_by = 'gm', updated_at = ?
        WHERE ship_id = ?
        """,
        (posture, roe_json, now, now, ship_id),
    )
    await db.commit()

    # Emit event
    event_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            ship_id,
            "posture_changed",
            "warning" if posture in ["yellow", "red"] else "info",
            f"Posture changed to {posture.upper()}",
            json.dumps({"posture": posture, "reason": reason}),
            now,
        ),
    )
    await db.commit()

    return await get_posture(ship_id, db)
