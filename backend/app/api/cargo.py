"""
Cargo inventory endpoints.
"""

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models.cargo import Cargo, CargoCreate, CargoUpdate

router = APIRouter()


@router.get("", response_model=list[Cargo])
async def list_cargo(
    ship_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    unplaced: Optional[bool] = Query(None, description="Filter to items not placed in any bay"),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List cargo items, optionally filtered by ship, category, or placement status."""
    query = "SELECT * FROM cargo WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)

    if category:
        query += " AND category = ?"
        params.append(category)

    if category_id:
        query += " AND category_id = ?"
        params.append(category_id)

    if unplaced is True:
        query += " AND id NOT IN (SELECT cargo_id FROM cargo_placements)"
    elif unplaced is False:
        query += " AND id IN (SELECT cargo_id FROM cargo_placements)"

    query += " ORDER BY name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    return [dict(row) for row in rows]


@router.get("/{cargo_id}", response_model=Cargo)
async def get_cargo(cargo_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a specific cargo item by ID."""
    cursor = await db.execute("SELECT * FROM cargo WHERE id = ?", (cargo_id,))
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Cargo item not found")

    return dict(row)


@router.post("", response_model=Cargo)
async def create_cargo(cargo: CargoCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new cargo item."""
    cargo_id = cargo.id or str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO cargo (
            id, ship_id, name, category_id, notes, color,
            size_class, shape_variant, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            cargo_id,
            cargo.ship_id,
            cargo.name,
            cargo.category_id,
            cargo.notes,
            cargo.color,
            cargo.size_class.value if hasattr(cargo.size_class, 'value') else cargo.size_class,
            cargo.shape_variant,
            now,
            now,
        ),
    )
    await db.commit()

    return await get_cargo(cargo_id, db)


@router.patch("/{cargo_id}", response_model=Cargo)
async def update_cargo(
    cargo_id: str, cargo: CargoUpdate, db: aiosqlite.Connection = Depends(get_db)
):
    """Update a cargo item."""
    # Check if cargo exists
    cursor = await db.execute("SELECT id FROM cargo WHERE id = ?", (cargo_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Cargo item not found")

    # Build dynamic update query
    updates = []
    params = []

    for field, value in cargo.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = ?")
        # Handle enum values
        if hasattr(value, 'value'):
            params.append(value.value)
        else:
            params.append(value)

    if updates:
        updates.append("updated_at = ?")
        params.append(datetime.utcnow().isoformat())
        params.append(cargo_id)

        query = f"UPDATE cargo SET {', '.join(updates)} WHERE id = ?"
        await db.execute(query, params)
        await db.commit()

    return await get_cargo(cargo_id, db)


@router.delete("/{cargo_id}")
async def delete_cargo(cargo_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a cargo item."""
    cursor = await db.execute("SELECT id FROM cargo WHERE id = ?", (cargo_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Cargo item not found")

    await db.execute("DELETE FROM cargo WHERE id = ?", (cargo_id,))
    await db.commit()

    return {"deleted": True}
