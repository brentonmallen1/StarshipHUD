"""
Cargo bay endpoints for polyomino cargo management.
"""

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models.cargo_bay import CargoBay, CargoBayCreate, CargoBayUpdate

router = APIRouter()


# Bay size presets (width x height)
BAY_SIZE_PRESETS = {
    "small": (6, 4),
    "medium": (8, 6),
    "large": (10, 8),
}


@router.get("", response_model=list[CargoBay])
async def list_cargo_bays(
    ship_id: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List cargo bays, optionally filtered by ship."""
    query = "SELECT * FROM cargo_bays WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)

    query += " ORDER BY sort_order, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    return [dict(row) for row in rows]


@router.get("/{bay_id}", response_model=CargoBay)
async def get_cargo_bay(bay_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a specific cargo bay by ID."""
    cursor = await db.execute("SELECT * FROM cargo_bays WHERE id = ?", (bay_id,))
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Cargo bay not found")

    return dict(row)


@router.get("/{bay_id}/with-placements")
async def get_cargo_bay_with_placements(
    bay_id: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Get a cargo bay with all its placements and cargo details."""
    # Get the bay
    cursor = await db.execute("SELECT * FROM cargo_bays WHERE id = ?", (bay_id,))
    bay_row = await cursor.fetchone()

    if not bay_row:
        raise HTTPException(status_code=404, detail="Cargo bay not found")

    bay = dict(bay_row)

    # Get placements with cargo data and category info
    cursor = await db.execute(
        """
        SELECT
            cp.id, cp.cargo_id, cp.bay_id, cp.x, cp.y, cp.rotation,
            cp.created_at, cp.updated_at,
            c.name, c.category, c.category_id, c.notes, c.color as cargo_color,
            c.quantity, c.unit, c.description, c.value, c.location,
            c.size_class, c.shape_variant,
            cc.name as category_name, cc.color as category_color
        FROM cargo_placements cp
        JOIN cargo c ON cp.cargo_id = c.id
        LEFT JOIN cargo_categories cc ON c.category_id = cc.id
        WHERE cp.bay_id = ?
        ORDER BY cp.y, cp.x
        """,
        (bay_id,),
    )
    placement_rows = await cursor.fetchall()

    placements = []
    for row in placement_rows:
        row_dict = dict(row)
        placements.append(
            {
                "id": row_dict["id"],
                "cargo_id": row_dict["cargo_id"],
                "bay_id": row_dict["bay_id"],
                "x": row_dict["x"],
                "y": row_dict["y"],
                "rotation": row_dict["rotation"],
                "created_at": row_dict["created_at"],
                "updated_at": row_dict["updated_at"],
                "cargo": {
                    "id": row_dict["cargo_id"],
                    "name": row_dict["name"],
                    "category": row_dict["category"],
                    "category_id": row_dict["category_id"],
                    "category_name": row_dict["category_name"],
                    "category_color": row_dict["category_color"],
                    "notes": row_dict["notes"],
                    "color": row_dict["cargo_color"],
                    "quantity": row_dict["quantity"],
                    "unit": row_dict["unit"],
                    "description": row_dict["description"],
                    "value": row_dict["value"],
                    "location": row_dict["location"],
                    "size_class": row_dict["size_class"],
                    "shape_variant": row_dict["shape_variant"],
                },
            }
        )

    bay["placements"] = placements
    return bay


@router.post("", response_model=CargoBay)
async def create_cargo_bay(
    bay: CargoBayCreate, db: aiosqlite.Connection = Depends(get_db)
):
    """Create a new cargo bay."""
    bay_id = bay.id or str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Apply preset dimensions if using a preset size
    width = bay.width
    height = bay.height
    if bay.bay_size != "custom" and bay.bay_size in BAY_SIZE_PRESETS:
        preset = BAY_SIZE_PRESETS[bay.bay_size]
        width = preset[0]
        height = preset[1]

    await db.execute(
        """
        INSERT INTO cargo_bays (
            id, ship_id, name, bay_size, width, height, sort_order,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            bay_id,
            bay.ship_id,
            bay.name,
            bay.bay_size,
            width,
            height,
            bay.sort_order,
            now,
            now,
        ),
    )
    await db.commit()

    return await get_cargo_bay(bay_id, db)


@router.patch("/{bay_id}", response_model=CargoBay)
async def update_cargo_bay(
    bay_id: str, bay: CargoBayUpdate, db: aiosqlite.Connection = Depends(get_db)
):
    """Update a cargo bay."""
    # Check if bay exists
    cursor = await db.execute("SELECT id FROM cargo_bays WHERE id = ?", (bay_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Cargo bay not found")

    # Build dynamic update query
    updates = []
    params = []

    update_data = bay.model_dump(exclude_unset=True)

    # If changing to a preset size, update dimensions automatically
    if "bay_size" in update_data and update_data["bay_size"] in BAY_SIZE_PRESETS:
        preset = BAY_SIZE_PRESETS[update_data["bay_size"]]
        if "width" not in update_data:
            update_data["width"] = preset[0]
        if "height" not in update_data:
            update_data["height"] = preset[1]

    for field, value in update_data.items():
        updates.append(f"{field} = ?")
        params.append(value)

    if updates:
        updates.append("updated_at = ?")
        params.append(datetime.utcnow().isoformat())
        params.append(bay_id)

        query = f"UPDATE cargo_bays SET {', '.join(updates)} WHERE id = ?"
        await db.execute(query, params)
        await db.commit()

    return await get_cargo_bay(bay_id, db)


@router.delete("/{bay_id}")
async def delete_cargo_bay(bay_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a cargo bay. This will also delete all placements in the bay."""
    cursor = await db.execute("SELECT id FROM cargo_bays WHERE id = ?", (bay_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Cargo bay not found")

    # Placements will be cascade deleted by FK constraint
    await db.execute("DELETE FROM cargo_bays WHERE id = ?", (bay_id,))
    await db.commit()

    return {"deleted": True}
