"""
System state API endpoints.

Status math, the dependency cascade and update semantics live in
app/services/system_states.py.
"""

import json
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.system_state import (
    BulkResetRequest,
    BulkResetResult,
    SystemState,
    SystemStateCreate,
    SystemStateUpdate,
)
from app.services import system_states as service
from app.services.system_states import enrich_system_with_effective_status, load_ship_systems

router = APIRouter()


@router.get("", response_model=list[SystemState])
async def list_system_states(
    ship_id: str | None = Query(None),
    category: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List system states, optionally filtered."""
    query = "SELECT * FROM system_states WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if category:
        query += " AND category = ?"
        params.append(category)

    query += " ORDER BY category, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    all_systems = {row["id"]: dict(row) for row in rows}
    return [enrich_system_with_effective_status(dict(row), all_systems) for row in rows]


@router.get("/{state_id}", response_model=SystemState)
async def get_system_state(state_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a system state by ID."""
    cursor = await db.execute("SELECT * FROM system_states WHERE id = ?", (state_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="System state not found")

    all_systems = await load_ship_systems(db, row["ship_id"])
    return enrich_system_with_effective_status(dict(row), all_systems)


@router.post("", response_model=SystemState)
async def create_system_state(state: SystemStateCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new system state."""
    await service.validate_depends_on(db, state.ship_id, state.id, state.depends_on)
    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        INSERT INTO system_states (
            id, ship_id, name, status, value, max_value, unit, category, category_id,
            depends_on, status_thresholds, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            state.id,
            state.ship_id,
            state.name,
            state.status.value,
            state.value,
            state.max_value,
            state.unit,
            state.category,
            state.category_id,
            json.dumps(state.depends_on),
            json.dumps(state.status_thresholds) if state.status_thresholds else None,
            now,
            now,
        ),
    )
    await db.commit()

    all_systems = await load_ship_systems(db, state.ship_id)
    return enrich_system_with_effective_status(all_systems[state.id], all_systems)


@router.patch("/{state_id}", response_model=SystemState)
async def update_system_state(
    state_id: str,
    state: SystemStateUpdate,
    emit_event: bool = Query(True),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Update a system state with bidirectional status-value relationship.

    - If only status is updated: value is set from the status (custom threshold or top of band)
    - If only value is updated: status is calculated from the value (custom thresholds if set)
    - If both are updated: both values are used as-is (manual override)
    """
    change = await service.apply_system_state_update(
        db, state_id, state.model_dump(exclude_unset=True), emit_events=emit_event
    )
    await db.commit()

    all_systems = await load_ship_systems(db, change.ship_id)
    return enrich_system_with_effective_status(all_systems[state_id], all_systems)


@router.delete("/{state_id}")
async def delete_system_state(state_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a system state."""
    cursor = await db.execute("SELECT * FROM system_states WHERE id = ?", (state_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="System state not found")

    await db.execute("DELETE FROM system_states WHERE id = ?", (state_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/bulk-reset", response_model=BulkResetResult)
async def bulk_reset_systems(
    request: BulkResetRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Reset multiple systems at once.

    - If reset_all is True, resets all systems for the ship
    - Otherwise, resets only the systems specified in the systems list
    - Each system can have a custom target_status or target_value
    - If neither is specified, defaults to "operational" status
    """
    result = await service.bulk_reset_systems(db, request)
    await db.commit()
    return result
