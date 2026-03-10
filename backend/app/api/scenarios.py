"""
Scenario API endpoints.
"""

import json
import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.api.system_states import calculate_status_from_percentage, calculate_value_from_status
from app.database import get_db
from app.models.base import SystemStatus
from app.models.scenario import (
    EventPreview,
    PosturePreview,
    Scenario,
    ScenarioCreate,
    ScenarioExecuteResult,
    ScenarioRehearsalResult,
    ScenarioUpdate,
    SystemStatePreview,
    TogglePreview,
    TransmissionPreview,
)
from app.utils import safe_json_loads

router = APIRouter()


def parse_scenario(row: aiosqlite.Row) -> dict:
    """Parse scenario row, converting JSON fields."""
    result = dict(row)
    result["actions"] = safe_json_loads(result["actions"], default=[], field_name="actions")
    return result


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

    actions_json = json.dumps([a.model_dump() for a in scenario.actions])

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
            value = json.dumps(value)
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


async def execute_scenario_internal(scenario_id: str, db: aiosqlite.Connection) -> dict:
    """
    Internal function to execute a scenario.
    Can be called from other modules (e.g., timers) without going through the HTTP layer.
    Returns the result dict or raises an exception.
    """
    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    row = await cursor.fetchone()
    if not row:
        raise ValueError(f"Scenario not found: {scenario_id}")

    scenario = parse_scenario(row)
    ship_id = scenario["ship_id"]
    actions = scenario["actions"]

    events_emitted = []
    errors = []
    actions_executed = 0
    now = datetime.now(UTC).isoformat()

    for action in actions:
        try:
            action_type = action.get("type")
            target = action.get("target")
            value = action.get("value")
            data = action.get("data", {})

            if action_type == "set_status":
                cursor = await db.execute("SELECT max_value FROM system_states WHERE id = ?", (target,))
                row = await cursor.fetchone()
                if row:
                    max_value = row["max_value"]
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
                cursor = await db.execute("SELECT max_value FROM system_states WHERE id = ?", (target,))
                row = await cursor.fetchone()
                if row:
                    max_value = row["max_value"]
                    percentage = (value / max_value) * 100 if max_value > 0 else 0
                    new_status = calculate_status_from_percentage(percentage)
                    await db.execute(
                        "UPDATE system_states SET value = ?, status = ?, updated_at = ? WHERE id = ?",
                        (value, new_status.value, now, target),
                    )
                    actions_executed += 1

            elif action_type == "adjust_value":
                cursor = await db.execute("SELECT value, max_value FROM system_states WHERE id = ?", (target,))
                row = await cursor.fetchone()
                if row:
                    current_value = row["value"]
                    max_value = row["max_value"]
                    new_value = current_value + value
                    new_value = max(0, min(new_value, max_value))
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

            elif action_type == "initiate_hail":
                # Toggle hail_active state
                if value is not None:
                    new_state = 1 if value else 0
                else:
                    cursor = await db.execute(
                        "SELECT hail_active FROM posture_state WHERE ship_id = ?",
                        (ship_id,),
                    )
                    row = await cursor.fetchone()
                    new_state = 0 if row and row["hail_active"] else 1
                await db.execute(
                    "UPDATE posture_state SET hail_active = ?, updated_at = ? WHERE ship_id = ?",
                    (new_state, now, ship_id),
                )
                actions_executed += 1

            elif action_type == "toggle_transmission":
                # Toggle transmitted state of an event
                if value is not None:
                    new_state = 1 if value else 0
                else:
                    cursor = await db.execute(
                        "SELECT transmitted FROM events WHERE id = ?", (target,)
                    )
                    row = await cursor.fetchone()
                    new_state = 0 if row and row["transmitted"] else 1
                await db.execute(
                    "UPDATE events SET transmitted = ? WHERE id = ?", (new_state, target)
                )
                actions_executed += 1

            elif action_type == "toggle_holomap_marker":
                # Toggle visible state of holomap marker
                if value is not None:
                    new_state = 1 if value else 0
                else:
                    cursor = await db.execute(
                        "SELECT visible FROM holomap_markers WHERE id = ?", (target,)
                    )
                    row = await cursor.fetchone()
                    new_state = 0 if row and row["visible"] else 1
                await db.execute(
                    "UPDATE holomap_markers SET visible = ?, updated_at = ? WHERE id = ?",
                    (new_state, now, target),
                )
                actions_executed += 1

            elif action_type == "toggle_sensor_contact":
                # Toggle visible state of sensor contact
                if value is not None:
                    new_state = 1 if value else 0
                else:
                    cursor = await db.execute(
                        "SELECT visible FROM sensor_contacts WHERE id = ?", (target,)
                    )
                    row = await cursor.fetchone()
                    new_state = 0 if row and row["visible"] else 1
                await db.execute(
                    "UPDATE sensor_contacts SET visible = ?, last_updated_at = ? WHERE id = ?",
                    (new_state, now, target),
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

    return {
        "scenario_id": scenario_id,
        "success": len(errors) == 0,
        "actions_executed": actions_executed,
        "events_emitted": events_emitted,
        "errors": errors,  # Always return list (may be empty)
    }


@router.post("/{scenario_id}/execute", response_model=ScenarioExecuteResult)
async def execute_scenario(scenario_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Execute a scenario, applying all its actions."""
    try:
        result = await execute_scenario_internal(scenario_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return ScenarioExecuteResult(
        scenario_id=result["scenario_id"],
        success=result["success"],
        actions_executed=result["actions_executed"],
        events_emitted=result["events_emitted"],
        errors=result["errors"],
    )


@router.post("/{scenario_id}/rehearse", response_model=ScenarioRehearsalResult)
async def rehearse_scenario(scenario_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Preview a scenario without executing it. Shows what changes would occur."""
    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Scenario not found")

    scenario = parse_scenario(row)
    ship_id = scenario["ship_id"]
    actions = scenario["actions"]

    system_changes: list[SystemStatePreview] = []
    posture_change: PosturePreview | None = None
    events_preview: list[EventPreview] = []
    transmissions_preview: list[TransmissionPreview] = []
    toggles_preview: list[TogglePreview] = []
    errors: list[str] = []
    warnings: list[str] = []

    # Track simulated state changes (for chained actions affecting same system)
    simulated_values: dict[str, float] = {}
    simulated_statuses: dict[str, str] = {}

    for action in actions:
        try:
            action_type = action.get("type")
            target = action.get("target")
            value = action.get("value")
            data = action.get("data", {})

            if action_type == "set_status":
                cursor = await db.execute(
                    "SELECT id, name, status, value, max_value FROM system_states WHERE id = ?",
                    (target,),
                )
                row = await cursor.fetchone()
                if row:
                    try:
                        status_enum = SystemStatus(value)
                        new_value = calculate_value_from_status(status_enum, row["max_value"])

                        # Use simulated value if this system was already modified
                        before_status = simulated_statuses.get(target, row["status"])
                        before_value = simulated_values.get(target, row["value"])

                        system_changes.append(
                            SystemStatePreview(
                                system_id=target,
                                system_name=row["name"],
                                before_status=before_status,
                                before_value=before_value,
                                after_status=value,
                                after_value=new_value,
                                max_value=row["max_value"],
                            )
                        )

                        # Track simulated changes
                        simulated_values[target] = new_value
                        simulated_statuses[target] = value
                    except ValueError:
                        errors.append(f"Invalid status value: {value}")
                else:
                    errors.append(f"System not found: {target}")

            elif action_type == "set_value":
                cursor = await db.execute(
                    "SELECT id, name, status, value, max_value FROM system_states WHERE id = ?",
                    (target,),
                )
                row = await cursor.fetchone()
                if row:
                    max_value = row["max_value"]
                    percentage = (value / max_value) * 100 if max_value > 0 else 0
                    new_status = calculate_status_from_percentage(percentage)

                    before_status = simulated_statuses.get(target, row["status"])
                    before_value = simulated_values.get(target, row["value"])

                    system_changes.append(
                        SystemStatePreview(
                            system_id=target,
                            system_name=row["name"],
                            before_status=before_status,
                            before_value=before_value,
                            after_status=new_status.value,
                            after_value=value,
                            max_value=max_value,
                        )
                    )

                    simulated_values[target] = value
                    simulated_statuses[target] = new_status.value
                else:
                    errors.append(f"System not found: {target}")

            elif action_type == "adjust_value":
                cursor = await db.execute(
                    "SELECT id, name, status, value, max_value FROM system_states WHERE id = ?",
                    (target,),
                )
                row = await cursor.fetchone()
                if row:
                    current_value = simulated_values.get(target, row["value"])
                    max_value = row["max_value"]
                    new_value = max(0, min(current_value + value, max_value))
                    percentage = (new_value / max_value) * 100 if max_value > 0 else 0
                    new_status = calculate_status_from_percentage(percentage)

                    before_status = simulated_statuses.get(target, row["status"])
                    before_value = simulated_values.get(target, row["value"])

                    system_changes.append(
                        SystemStatePreview(
                            system_id=target,
                            system_name=row["name"],
                            before_status=before_status,
                            before_value=before_value,
                            after_status=new_status.value,
                            after_value=new_value,
                            max_value=max_value,
                        )
                    )

                    simulated_values[target] = new_value
                    simulated_statuses[target] = new_status.value
                else:
                    errors.append(f"System not found: {target}")

            elif action_type == "emit_event":
                events_preview.append(
                    EventPreview(
                        type=data.get("type", "scenario_event"),
                        severity=data.get("severity", "info"),
                        message=data.get("message", f"Scenario: {scenario['name']}"),
                    )
                )

            elif action_type == "set_posture":
                cursor = await db.execute(
                    "SELECT posture FROM posture_state WHERE ship_id = ?",
                    (ship_id,),
                )
                row = await cursor.fetchone()
                if row:
                    posture_change = PosturePreview(
                        before_posture=row["posture"],
                        after_posture=value,
                    )
                else:
                    warnings.append("No posture state found for ship")

            elif action_type == "initiate_hail":
                # Preview hail toggle
                cursor = await db.execute(
                    "SELECT hail_active FROM posture_state WHERE ship_id = ?",
                    (ship_id,),
                )
                row = await cursor.fetchone()
                if row:
                    before_visible = bool(row["hail_active"])
                    after_visible = not before_visible if value is None else bool(value)
                    toggles_preview.append(
                        TogglePreview(
                            target_type="hail",
                            target_id=ship_id,
                            target_name="Incoming Hail",
                            before_visible=before_visible,
                            after_visible=after_visible,
                        )
                    )
                else:
                    errors.append("No posture state found for ship")

            elif action_type == "toggle_transmission":
                cursor = await db.execute(
                    "SELECT id, message, transmitted FROM events WHERE id = ?",
                    (target,),
                )
                row = await cursor.fetchone()
                if row:
                    before_visible = bool(row["transmitted"])
                    after_visible = not before_visible if value is None else bool(value)
                    toggles_preview.append(
                        TogglePreview(
                            target_type="transmission",
                            target_id=target,
                            target_name=row["message"] or target,
                            before_visible=before_visible,
                            after_visible=after_visible,
                        )
                    )
                else:
                    errors.append(f"Transmission not found: {target}")

            elif action_type == "toggle_holomap_marker":
                cursor = await db.execute(
                    "SELECT id, label, visible FROM holomap_markers WHERE id = ?",
                    (target,),
                )
                row = await cursor.fetchone()
                if row:
                    before_visible = bool(row["visible"])
                    after_visible = not before_visible if value is None else bool(value)
                    toggles_preview.append(
                        TogglePreview(
                            target_type="holomap_marker",
                            target_id=target,
                            target_name=row["label"] or target,
                            before_visible=before_visible,
                            after_visible=after_visible,
                        )
                    )
                else:
                    errors.append(f"Holomap marker not found: {target}")

            elif action_type == "toggle_sensor_contact":
                cursor = await db.execute(
                    "SELECT id, label, visible FROM sensor_contacts WHERE id = ?",
                    (target,),
                )
                row = await cursor.fetchone()
                if row:
                    before_visible = bool(row["visible"])
                    after_visible = not before_visible if value is None else bool(value)
                    toggles_preview.append(
                        TogglePreview(
                            target_type="sensor_contact",
                            target_id=target,
                            target_name=row["label"] or target,
                            before_visible=before_visible,
                            after_visible=after_visible,
                        )
                    )
                else:
                    errors.append(f"Sensor contact not found: {target}")

            else:
                warnings.append(f"Unknown action type: {action_type}")

        except Exception as e:
            errors.append(f"Error processing action: {str(e)}")

    # Add the scenario_executed event that always gets emitted
    events_preview.append(
        EventPreview(
            type="scenario_executed",
            severity="info",
            message=f"Scenario executed: {scenario['name']}",
        )
    )

    return ScenarioRehearsalResult(
        scenario_id=scenario_id,
        scenario_name=scenario["name"],
        can_execute=len(errors) == 0,
        system_changes=system_changes,
        posture_change=posture_change,
        events_preview=events_preview,
        transmissions_preview=transmissions_preview,
        toggles_preview=toggles_preview,
        errors=errors,
        warnings=warnings,
    )
