"""
Cargo category endpoints.
"""

import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.cargo_category import CargoCategory, CargoCategoryCreate, CargoCategoryUpdate

router = APIRouter()


@router.get("", response_model=list[CargoCategory])
async def list_cargo_categories(
    ship_id: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List cargo categories, optionally filtered by ship."""
    query = "SELECT * FROM cargo_categories WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)

    query += " ORDER BY name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    return [dict(row) for row in rows]


@router.get("/{category_id}", response_model=CargoCategory)
async def get_cargo_category(category_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a specific cargo category by ID."""
    cursor = await db.execute("SELECT * FROM cargo_categories WHERE id = ?", (category_id,))
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Cargo category not found")

    return dict(row)


@router.post("", response_model=CargoCategory)
async def create_cargo_category(category: CargoCategoryCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new cargo category."""
    category_id = category.id or str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    # Check for duplicate name within ship
    cursor = await db.execute(
        "SELECT id FROM cargo_categories WHERE ship_id = ? AND name = ?",
        (category.ship_id, category.name),
    )
    if await cursor.fetchone():
        raise HTTPException(status_code=400, detail="Category with this name already exists")

    await db.execute(
        """
        INSERT INTO cargo_categories (
            id, ship_id, name, color, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            category_id,
            category.ship_id,
            category.name,
            category.color,
            now,
            now,
        ),
    )
    await db.commit()

    return await get_cargo_category(category_id, db)


@router.patch("/{category_id}", response_model=CargoCategory)
async def update_cargo_category(
    category_id: str, category: CargoCategoryUpdate, db: aiosqlite.Connection = Depends(get_db)
):
    """Update a cargo category."""
    # Check if category exists
    cursor = await db.execute("SELECT * FROM cargo_categories WHERE id = ?", (category_id,))
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Cargo category not found")

    # Build dynamic update query
    updates = []
    params = []

    update_data = category.model_dump(exclude_unset=True)

    # Check for duplicate name if name is being changed
    if "name" in update_data and update_data["name"] != existing["name"]:
        cursor = await db.execute(
            "SELECT id FROM cargo_categories WHERE ship_id = ? AND name = ? AND id != ?",
            (existing["ship_id"], update_data["name"], category_id),
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Category with this name already exists")

    for field, value in update_data.items():
        updates.append(f"{field} = ?")
        params.append(value)

    if updates:
        updates.append("updated_at = ?")
        params.append(datetime.now(UTC).isoformat())
        params.append(category_id)

        query = f"UPDATE cargo_categories SET {', '.join(updates)} WHERE id = ?"
        await db.execute(query, params)
        await db.commit()

    return await get_cargo_category(category_id, db)


@router.delete("/{category_id}")
async def delete_cargo_category(category_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a cargo category. Cargo items referencing this category will have their category_id set to null."""
    cursor = await db.execute("SELECT id FROM cargo_categories WHERE id = ?", (category_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Cargo category not found")

    # Set category_id to null for all cargo items referencing this category
    await db.execute("UPDATE cargo SET category_id = NULL WHERE category_id = ?", (category_id,))

    # Delete the category
    await db.execute("DELETE FROM cargo_categories WHERE id = ?", (category_id,))
    await db.commit()

    return {"deleted": True}
