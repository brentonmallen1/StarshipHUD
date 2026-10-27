"""
Ship API endpoints.
"""

import json
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from nanoid import generate

from app.database import get_db
from app.models.base import Posture
from app.models.ship import Ship, ShipCreate, ShipUpdate
from app.seed import create_ship_with_seed
from app.services.authz import AuthzDep, accessible_ship_ids
from app.services.posture import apply_posture
from app.utils import safe_json_loads

router = APIRouter()

# 5-char alphanumeric nanoid (URL-safe, no ambiguous chars like 0/O, 1/l/I)
NANOID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"


def generate_ship_id() -> str:
    """Generate a 5-character nanoid for ship IDs."""
    return generate(NANOID_ALPHABET, 5)


def parse_ship_row(row: aiosqlite.Row) -> dict:
    """Parse a ship row, deserializing JSON fields."""
    data = dict(row)
    data["attributes"] = safe_json_loads(data.get("attributes"), default={}, field_name="attributes")
    return data


@router.get("", response_model=list[Ship])
async def list_ships(authz: AuthzDep, db: aiosqlite.Connection = Depends(get_db)):
    """List ships. Players only see ships they have been granted access to."""
    allowed = await accessible_ship_ids(db, authz.user)
    cursor = await db.execute("SELECT * FROM ships ORDER BY name")
    rows = await cursor.fetchall()
    return [parse_ship_row(row) for row in rows if allowed is None or row["id"] in allowed]


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
    if posture not in set(Posture):
        raise HTTPException(status_code=400, detail=f"Invalid posture: {posture}")

    await apply_posture(db, ship_id, Posture(posture), set_by="gm", reason=reason)
    await db.commit()

    return await get_posture(ship_id, db)


@router.post("/{ship_id}/hail")
async def send_hail(ship_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Send a hail notification (sets hail_active to true)."""
    cursor = await db.execute("SELECT * FROM posture_state WHERE ship_id = ?", (ship_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Ship not found")

    now = datetime.now(UTC).isoformat()
    await db.execute(
        "UPDATE posture_state SET hail_active = 1, updated_at = ? WHERE ship_id = ?",
        (now, ship_id),
    )
    await db.commit()

    return await get_posture(ship_id, db)


@router.delete("/{ship_id}/hail")
async def clear_hail(ship_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Clear the hail notification (sets hail_active to false)."""
    cursor = await db.execute("SELECT * FROM posture_state WHERE ship_id = ?", (ship_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Ship not found")

    now = datetime.now(UTC).isoformat()
    await db.execute(
        "UPDATE posture_state SET hail_active = 0, updated_at = ? WHERE ship_id = ?",
        (now, ship_id),
    )
    await db.commit()

    return await get_posture(ship_id, db)
