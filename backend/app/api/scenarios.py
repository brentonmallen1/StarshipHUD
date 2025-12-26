"""
Scenario API endpoints.
"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import aiosqlite

from app.database import get_db
from app.models.scenario import Scenario, ScenarioCreate, ScenarioUpdate, ScenarioExecuteResult
from app.api.system_states import calculate_status_from_percentage, calculate_value_from_status
from app.models.base import SystemStatus

router = APIRouter()


def parse_scenario(row: aiosqlite.Row) -> dict:
    """Parse scenario row, converting JSON fields."""
    result = dict(row)
    result["actions"] = json.loads(result["actions"])
    return result


@router.get("", response_model=list[Scenario])
async def list_scenarios(
    ship_id: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List scenarios, optionally filtered by ship."""
    query = "SELECT * FROM scenarios"
    params = []

    if ship_id:
        query += " WHERE ship_id = ?"
        params.append(ship_id)

    query += " ORDER BY name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_scenario(row) for row in rows]


@router.get("/{scenario_id}", response_model=Scenario)
async def get_scenario(scenario_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a scenario by ID."""
    cursor = await db.execute(
        "SELECT * FROM scenarios WHERE id = ?", (scenario_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return parse_scenario(row)


@router.post("", response_model=Scenario)
async def create_scenario(
    scenario: ScenarioCreate, db: aiosqlite.Connection = Depends(get_db)
):
    """Create a new scenario."""
    scenario_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    actions_json = json.dumps([a.model_dump() for a in scenario.actions])

    await db.execute(
        """
        INSERT INTO scenarios (id, ship_id, name, description, actions, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            scenario_id,
            scenario.ship_id,
            scenario.name,
            scenario.description,
            actions_json,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM scenarios WHERE id = ?", (scenario_id,)
    )
    return parse_scenario(await cursor.fetchone())


@router.patch("/{scenario_id}", response_model=Scenario)
async def update_scenario(
    scenario_id: str,
    scenario: ScenarioUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a scenario."""
    cursor = await db.execute(
        "SELECT * FROM scenarios WHERE id = ?", (scenario_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Scenario not found")

    updates = []
    values = []
    for field, value in scenario.model_dump(exclude_unset=True).items():
        if field == "actions" and value is not None:
            value = json.dumps([a.model_dump() for a in value])
        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(scenario_id)
        await db.execute(
            f"UPDATE scenarios SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute(
        "SELECT * FROM scenarios WHERE id = ?", (scenario_id,)
    )
    return parse_scenario(await cursor.fetchone())


@router.delete("/{scenario_id}")
async def delete_scenario(
    scenario_id: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Delete a scenario."""
    cursor = await db.execute(
        "SELECT * FROM scenarios WHERE id = ?", (scenario_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Scenario not found")

    await db.execute("DELETE FROM scenarios WHERE id = ?", (scenario_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/{scenario_id}/execute", response_model=ScenarioExecuteResult)
async def execute_scenario(
    scenario_id: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Execute a scenario, applying all its actions."""
    cursor = await db.execute(
        "SELECT * FROM scenarios WHERE id = ?", (scenario_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Scenario not found")

    scenario = parse_scenario(row)
    ship_id = scenario["ship_id"]
    actions = scenario["actions"]

    events_emitted = []
    errors = []
    actions_executed = 0
    now = datetime.utcnow().isoformat()

    for action in actions:
        try:
            action_type = action.get("type")
            target = action.get("target")
            value = action.get("value")
            data = action.get("data", {})

            if action_type == "set_status":
                # Get current max_value for the system
                cursor = await db.execute(
                    "SELECT max_value FROM system_states WHERE id = ?", (target,)
                )
                row = await cursor.fetchone()
                if row:
                    max_value = row["max_value"]
                    # Calculate value from status using bidirectional relationship
                    try:
                        status_enum = SystemStatus(value)
                        new_value = calculate_value_from_status(status_enum, max_value)
                        await db.execute(
                            "UPDATE system_states SET status = ?, value = ?, updated_at = ? WHERE id = ?",
                            (value, new_value, now, target),
                        )
                        actions_executed += 1
                    except ValueError:
                        errors.append(f"Invalid status value: {value}")

            elif action_type == "set_value":
                # Get current max_value for the system
                cursor = await db.execute(
                    "SELECT max_value FROM system_states WHERE id = ?", (target,)
                )
                row = await cursor.fetchone()
                if row:
                    max_value = row["max_value"]
                    # Calculate status from value using bidirectional relationship
                    percentage = (value / max_value) * 100 if max_value > 0 else 0
                    new_status = calculate_status_from_percentage(percentage)
                    await db.execute(
                        "UPDATE system_states SET value = ?, status = ?, updated_at = ? WHERE id = ?",
                        (value, new_status.value, now, target),
                    )
                    actions_executed += 1

            elif action_type == "adjust_value":
                # Get current value and max_value for the system
                cursor = await db.execute(
                    "SELECT value, max_value FROM system_states WHERE id = ?", (target,)
                )
                row = await cursor.fetchone()
                if row:
                    current_value = row["value"]
                    max_value = row["max_value"]
                    new_value = current_value + value
                    # Clamp to [0, max_value]
                    new_value = max(0, min(new_value, max_value))
                    # Calculate status from new value using bidirectional relationship
                    percentage = (new_value / max_value) * 100 if max_value > 0 else 0
                    new_status = calculate_status_from_percentage(percentage)
                    await db.execute(
                        "UPDATE system_states SET value = ?, status = ?, updated_at = ? WHERE id = ?",
                        (new_value, new_status.value, now, target),
                    )
                    actions_executed += 1

            elif action_type == "emit_event":
                event_id = str(uuid.uuid4())
                await db.execute(
                    """
                    INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event_id,
                        ship_id,
                        data.get("type", "scenario_event"),
                        data.get("severity", "info"),
                        data.get("message", f"Scenario: {scenario['name']}"),
                        json.dumps(data),
                        now,
                    ),
                )
                events_emitted.append(event_id)
                actions_executed += 1

            elif action_type == "set_posture":
                await db.execute(
                    """
                    UPDATE posture_state
                    SET posture = ?, posture_set_at = ?, posture_set_by = 'scenario', updated_at = ?
                    WHERE ship_id = ?
                    """,
                    (value, now, now, ship_id),
                )
                actions_executed += 1

            else:
                errors.append(f"Unknown action type: {action_type}")

        except Exception as e:
            errors.append(f"Action error: {str(e)}")

    await db.commit()

    # Emit scenario execution event
    event_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            ship_id,
            "scenario_executed",
            "info",
            f"Scenario executed: {scenario['name']}",
            json.dumps({"scenario_id": scenario_id, "actions_executed": actions_executed}),
            now,
        ),
    )
    await db.commit()
    events_emitted.append(event_id)

    return ScenarioExecuteResult(
        scenario_id=scenario_id,
        success=len(errors) == 0,
        actions_executed=actions_executed,
        events_emitted=events_emitted,
        errors=errors,
    )
