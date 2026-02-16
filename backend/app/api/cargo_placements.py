"""
Cargo placement endpoints for polyomino cargo management.
"""

import uuid
from datetime import datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_db
from app.models.cargo_placement import CargoPlacement, CargoPlacementCreate, CargoPlacementUpdate

router = APIRouter()


# Polyomino shape definitions: list of (dx, dy) offsets from anchor point (0,0)
# Each size has multiple shape variants (index 0 is always a straight line)
CARGO_SHAPES = {
    "tiny": [
        [(0, 0)],  # Single tile
    ],
    "x_small": [
        [(0, 0), (1, 0)],  # Horizontal line
        [(0, 0), (0, 1)],  # Vertical line
    ],
    "small": [
        [(0, 0), (1, 0), (2, 0)],  # Line
        [(0, 0), (1, 0), (1, 1)],  # L-shape
        [(0, 0), (1, 0), (0, 1)],  # Corner
    ],
    "medium": [
        [(0, 0), (1, 0), (2, 0), (3, 0)],  # Line
        [(0, 0), (1, 0), (2, 0), (2, 1)],  # L-shape
        [(0, 0), (1, 0), (2, 0), (1, 1)],  # T-shape
        [(0, 0), (1, 0), (0, 1), (1, 1)],  # Square
    ],
    "large": [
        [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0)],  # Line
        [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2)],  # L-shape
        [(0, 0), (1, 0), (2, 0), (1, 1), (1, 2)],  # T-shape
        [(0, 0), (1, 0), (1, 1), (2, 1), (2, 2)],  # S-shape
    ],
    "x_large": [
        [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (5, 0)],  # Line
        [(0, 0), (1, 0), (2, 0), (3, 0), (3, 1), (3, 2)],  # L-shape
        [(0, 0), (1, 0), (2, 0), (3, 0), (1, 1), (2, 1)],  # T-shape
        [(0, 0), (0, 1), (1, 1), (2, 1), (2, 2), (3, 2)],  # S-shape
    ],
    "huge": [
        [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (5, 0), (6, 0)],  # Line
        [(0, 0), (1, 0), (2, 0), (3, 0), (3, 1), (3, 2), (3, 3)],  # L-shape
        [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (2, 1), (2, 2)],  # Cross
        [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2), (3, 2), (4, 2)],  # Z-shape
    ],
}


def rotate_shape(tiles: list[tuple[int, int]], times: int) -> list[tuple[int, int]]:
    """Rotate shape 90 degrees clockwise, 'times' times."""
    result = list(tiles)
    for _ in range(times % 4):
        # 90 degree clockwise rotation: (x, y) -> (y, -x)
        # Then we normalize to positive coordinates
        result = [(y, -x) for x, y in result]
        min_x = min(x for x, y in result)
        min_y = min(y for x, y in result)
        result = [(x - min_x, y - min_y) for x, y in result]
    return result


def get_occupied_tiles(x: int, y: int, size_class: str, shape_variant: int, rotation: int) -> list[tuple[int, int]]:
    """Get all tiles occupied by a cargo piece at the given position."""
    shapes = CARGO_SHAPES.get(size_class, CARGO_SHAPES["small"])
    variant_idx = min(shape_variant, len(shapes) - 1)
    shape = shapes[variant_idx]

    # Apply rotation
    rotated = rotate_shape(shape, rotation // 90)

    # Apply position offset
    return [(x + dx, y + dy) for dx, dy in rotated]


class ValidationRequest(BaseModel):
    """Request body for validation endpoint."""

    cargo_id: str
    bay_id: str
    x: int
    y: int
    rotation: int = 0


class ValidationResponse(BaseModel):
    """Response for validation endpoint."""

    valid: bool
    reason: str | None = None
    occupied_tiles: list[tuple[int, int]] = []


async def validate_placement(
    db: aiosqlite.Connection,
    cargo_id: str,
    bay_id: str,
    x: int,
    y: int,
    rotation: int,
    exclude_placement_id: str | None = None,
) -> ValidationResponse:
    """Validate a cargo placement against bay bounds and existing placements."""
    # Get cargo item details
    cursor = await db.execute("SELECT size_class, shape_variant FROM cargo WHERE id = ?", (cargo_id,))
    cargo_row = await cursor.fetchone()
    if not cargo_row:
        return ValidationResponse(valid=False, reason="Cargo item not found")

    size_class = cargo_row["size_class"]
    shape_variant = cargo_row["shape_variant"]

    # Get bay dimensions
    cursor = await db.execute("SELECT width, height FROM cargo_bays WHERE id = ?", (bay_id,))
    bay_row = await cursor.fetchone()
    if not bay_row:
        return ValidationResponse(valid=False, reason="Cargo bay not found")

    bay_width = bay_row["width"]
    bay_height = bay_row["height"]

    # Get tiles occupied by the new placement
    new_tiles = get_occupied_tiles(x, y, size_class, shape_variant, rotation)

    # Check bounds
    for tx, ty in new_tiles:
        if tx < 0 or tx >= bay_width or ty < 0 or ty >= bay_height:
            return ValidationResponse(
                valid=False,
                reason=f"Out of bounds: tile ({tx}, {ty}) is outside bay dimensions ({bay_width}x{bay_height})",
                occupied_tiles=new_tiles,
            )

    # Get existing placements in this bay
    query = """
        SELECT cp.id, cp.cargo_id, cp.x, cp.y, cp.rotation,
               c.size_class, c.shape_variant
        FROM cargo_placements cp
        JOIN cargo c ON cp.cargo_id = c.id
        WHERE cp.bay_id = ?
    """
    params = [bay_id]

    if exclude_placement_id:
        query += " AND cp.id != ?"
        params.append(exclude_placement_id)

    cursor = await db.execute(query, params)
    existing_rows = await cursor.fetchall()

    # Build set of occupied tiles from existing placements
    occupied_set = set()
    for row in existing_rows:
        existing_tiles = get_occupied_tiles(
            row["x"],
            row["y"],
            row["size_class"],
            row["shape_variant"],
            row["rotation"],
        )
        for tile in existing_tiles:
            occupied_set.add(tile)

    # Check for overlap
    for tile in new_tiles:
        if tile in occupied_set:
            return ValidationResponse(
                valid=False,
                reason=f"Overlaps with existing cargo at tile ({tile[0]}, {tile[1]})",
                occupied_tiles=new_tiles,
            )

    return ValidationResponse(valid=True, occupied_tiles=new_tiles)


@router.get("", response_model=list[CargoPlacement])
async def list_cargo_placements(
    bay_id: str | None = Query(None),
    cargo_id: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List cargo placements, optionally filtered by bay or cargo."""
    query = "SELECT * FROM cargo_placements WHERE 1=1"
    params = []

    if bay_id:
        query += " AND bay_id = ?"
        params.append(bay_id)

    if cargo_id:
        query += " AND cargo_id = ?"
        params.append(cargo_id)

    query += " ORDER BY y, x"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    return [dict(row) for row in rows]


@router.get("/{placement_id}", response_model=CargoPlacement)
async def get_cargo_placement(placement_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a specific cargo placement by ID."""
    cursor = await db.execute("SELECT * FROM cargo_placements WHERE id = ?", (placement_id,))
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Cargo placement not found")

    return dict(row)


@router.post("/validate", response_model=ValidationResponse)
async def validate_cargo_placement(request: ValidationRequest, db: aiosqlite.Connection = Depends(get_db)):
    """Validate a cargo placement without committing it."""
    return await validate_placement(db, request.cargo_id, request.bay_id, request.x, request.y, request.rotation)


@router.post("", response_model=CargoPlacement)
async def create_cargo_placement(placement: CargoPlacementCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new cargo placement."""
    # Check if cargo is already placed somewhere
    cursor = await db.execute(
        "SELECT id, bay_id FROM cargo_placements WHERE cargo_id = ?",
        (placement.cargo_id,),
    )
    existing = await cursor.fetchone()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Cargo is already placed in bay {existing['bay_id']}. Remove it first.",
        )

    # Validate the placement
    validation = await validate_placement(
        db, placement.cargo_id, placement.bay_id, placement.x, placement.y, placement.rotation
    )
    if not validation.valid:
        raise HTTPException(status_code=400, detail=validation.reason)

    placement_id = placement.id or str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO cargo_placements (
            id, cargo_id, bay_id, x, y, rotation, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            placement_id,
            placement.cargo_id,
            placement.bay_id,
            placement.x,
            placement.y,
            placement.rotation,
            now,
            now,
        ),
    )
    await db.commit()

    return await get_cargo_placement(placement_id, db)


@router.patch("/{placement_id}", response_model=CargoPlacement)
async def update_cargo_placement(
    placement_id: str,
    placement: CargoPlacementUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a cargo placement (move/rotate)."""
    # Get current placement
    cursor = await db.execute("SELECT * FROM cargo_placements WHERE id = ?", (placement_id,))
    current = await cursor.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Cargo placement not found")

    # Merge updates with current values
    new_x = placement.x if placement.x is not None else current["x"]
    new_y = placement.y if placement.y is not None else current["y"]
    new_rotation = placement.rotation if placement.rotation is not None else current["rotation"]

    # Validate the new position
    validation = await validate_placement(
        db,
        current["cargo_id"],
        current["bay_id"],
        new_x,
        new_y,
        new_rotation,
        exclude_placement_id=placement_id,
    )
    if not validation.valid:
        raise HTTPException(status_code=400, detail=validation.reason)

    # Build update query
    updates = []
    params = []

    for field, value in placement.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = ?")
        params.append(value)

    if updates:
        updates.append("updated_at = ?")
        params.append(datetime.utcnow().isoformat())
        params.append(placement_id)

        query = f"UPDATE cargo_placements SET {', '.join(updates)} WHERE id = ?"
        await db.execute(query, params)
        await db.commit()

    return await get_cargo_placement(placement_id, db)


@router.delete("/{placement_id}")
async def delete_cargo_placement(placement_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Remove a cargo item from its bay (back to unplaced inventory)."""
    cursor = await db.execute("SELECT id FROM cargo_placements WHERE id = ?", (placement_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Cargo placement not found")

    await db.execute("DELETE FROM cargo_placements WHERE id = ?", (placement_id,))
    await db.commit()

    return {"deleted": True}


@router.delete("/by-cargo/{cargo_id}")
async def delete_placement_by_cargo(cargo_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Remove a cargo item from its bay by cargo ID."""
    cursor = await db.execute("SELECT id FROM cargo_placements WHERE cargo_id = ?", (cargo_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Cargo is not placed in any bay")

    await db.execute("DELETE FROM cargo_placements WHERE cargo_id = ?", (cargo_id,))
    await db.commit()

    return {"deleted": True}


@router.get("/shapes/all")
async def get_all_shapes():
    """Get all available polyomino shapes for each size class."""
    result = {}
    for size_class, shapes in CARGO_SHAPES.items():
        result[size_class] = [
            {"variant": i, "tiles": shape, "tile_count": len(shape)} for i, shape in enumerate(shapes)
        ]
    return result
