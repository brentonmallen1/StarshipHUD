"""
Scenario API endpoints.

Execution and rehearsal are implemented by app/services/scenario_engine.py.
"""

import json
import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.database import get_db
from app.models.scenario import (
    Scenario,
    ScenarioCreate,
    ScenarioExecuteResult,
    ScenarioRehearsalResult,
    ScenarioUpdate,
)
from app.services import scenario_engine
from app.services.scenario_engine import dump_actions, parse_scenario

router = APIRouter()


@router.get("", response_model=list[Scenario])
async def list_scenarios(
    ship_id: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List scenarios, optionally filtered by ship."""
    query = "SELECT * FROM scenarios"
    params = []

    if ship_id:
        query += " WHERE ship_id = ?"
        params.append(ship_id)

    query += " ORDER BY position, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_scenario(row) for row in rows]


@router.get("/{scenario_id}", response_model=Scenario)
async def get_scenario(scenario_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a scenario by ID."""
    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return parse_scenario(row)


@router.post("", response_model=Scenario)
async def create_scenario(scenario: ScenarioCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new scenario."""
    scenario_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    # Get next position for this ship
    cursor = await db.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM scenarios WHERE ship_id = ?",
        (scenario.ship_id,),
    )
    next_position = (await cursor.fetchone())[0]

    actions_json = dump_actions(scenario.actions)

    await db.execute(
        """
        INSERT INTO scenarios (id, ship_id, name, description, actions, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            scenario_id,
            scenario.ship_id,
            scenario.name,
            scenario.description,
            actions_json,
            next_position,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    return parse_scenario(await cursor.fetchone())


@router.patch("/{scenario_id}", response_model=Scenario)
async def update_scenario(
    scenario_id: str,
    scenario: ScenarioUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a scenario."""
    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Scenario not found")

    updates = []
    values = []
    for field, value in scenario.model_dump(exclude_unset=True).items():
        if field == "actions" and value is not None:
            value = dump_actions(scenario.actions)
        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.now(UTC).isoformat())
        values.append(scenario_id)
        await db.execute(
            f"UPDATE scenarios SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    return parse_scenario(await cursor.fetchone())


@router.delete("/{scenario_id}")
async def delete_scenario(scenario_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a scenario."""
    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Scenario not found")

    await db.execute("DELETE FROM scenarios WHERE id = ?", (scenario_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/reorder", response_model=list[Scenario])
async def reorder_scenarios(
    ship_id: str = Query(...),
    scenario_ids: list[str] = Body(...),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Reorder scenarios by providing an ordered list of scenario IDs."""
    now = datetime.now(UTC).isoformat()

    for position, scenario_id in enumerate(scenario_ids):
        await db.execute(
            "UPDATE scenarios SET position = ?, updated_at = ? WHERE id = ? AND ship_id = ?",
            (position, now, scenario_id, ship_id),
        )

    await db.commit()

    # Return updated list in new order
    cursor = await db.execute(
        "SELECT * FROM scenarios WHERE ship_id = ? ORDER BY position, name",
        (ship_id,),
    )
    rows = await cursor.fetchall()
    return [parse_scenario(row) for row in rows]


@router.post("/{scenario_id}/duplicate", response_model=Scenario)
async def duplicate_scenario(scenario_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Create a copy of an existing scenario."""
    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Scenario not found")

    original = parse_scenario(row)
    new_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    # Get next position
    cursor = await db.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM scenarios WHERE ship_id = ?",
        (original["ship_id"],),
    )
    next_position = (await cursor.fetchone())[0]

    await db.execute(
        """
        INSERT INTO scenarios (id, ship_id, name, description, actions, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id,
            original["ship_id"],
            f"{original['name']} (Copy)",
            original.get("description"),
            json.dumps(original["actions"]),
            next_position,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (new_id,))
    return parse_scenario(await cursor.fetchone())


@router.post("/{scenario_id}/execute", response_model=ScenarioExecuteResult)
async def execute_scenario(scenario_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """
    Execute a scenario, applying all its actions atomically.

    If any action can't be applied nothing is changed and the response is 422
    (500 for an unexpected error) with the reasons in ``detail``.
    """
    run = await scenario_engine.execute_scenario(db, scenario_id)
    await db.commit()
    return run.to_execute_result()


@router.post("/{scenario_id}/rehearse", response_model=ScenarioRehearsalResult)
async def rehearse_scenario(scenario_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Preview a scenario without executing it (a dry run of the same engine)."""
    run = await scenario_engine.rehearse_scenario(db, scenario_id)
    return run.to_rehearsal_result()
