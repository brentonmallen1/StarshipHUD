"""
Tasks API endpoints.
"""

import json
import uuid
from datetime import UTC, datetime, timedelta

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.system_states import calculate_status_from_percentage, calculate_value_from_status
from app.database import get_db
from app.models.base import SystemStatus
from app.models.task import TaskCreate, TaskUpdate
from app.utils import safe_json_loads

router = APIRouter()


def parse_task(row: aiosqlite.Row) -> dict:
    """Parse task row, converting JSON fields."""
    result = dict(row)
    result["on_success"] = safe_json_loads(result["on_success"], default=[], field_name="on_success")
    result["on_failure"] = safe_json_loads(result["on_failure"], default=[], field_name="on_failure")
    result["on_expire"] = safe_json_loads(result["on_expire"], default=[], field_name="on_expire")
    return result


@router.get("")
async def list_tasks(
    ship_id: str | None = Query(None),
    station: str | None = Query(None),
    status: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List tasks, optionally filtered."""
    query = "SELECT * FROM tasks WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if station:
        query += " AND station = ?"
        params.append(station)
    if status:
        query += " AND status = ?"
        params.append(status)

    query += " ORDER BY created_at DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_task(row) for row in rows]


@router.get("/{task_id}")
async def get_task(task_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a task by ID."""
    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return parse_task(row)


@router.post("")
async def create_task(
    task: TaskCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new task."""
    task_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    # Calculate expiration if time limit provided
    expires_at = None
    if task.time_limit:
        expires_at = (datetime.now(UTC) + timedelta(seconds=task.time_limit)).isoformat()

    await db.execute(
        """
        INSERT INTO tasks (id, ship_id, incident_id, title, description, station, time_limit, expires_at,
                          minigame_id, minigame_difficulty, on_success, on_failure, on_expire, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            task_id,
            task.ship_id,
            task.incident_id,
            task.title,
            task.description,
            task.station,
            task.time_limit,
            expires_at,
            task.minigame_id,
            task.minigame_difficulty,
            json.dumps(task.on_success),
            json.dumps(task.on_failure),
            json.dumps(task.on_expire),
            now,
        ),
    )
    await db.commit()

    # Emit task created event
    event_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            task.ship_id,
            "task_created",
            "info",
            f"New task: {task.title}",
            json.dumps({"task_id": task_id, "station": task.station}),
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    return parse_task(await cursor.fetchone())


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    task: TaskUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a task."""
    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    current = await cursor.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = []
    values = []
    now = datetime.now(UTC).isoformat()
    update_data = task.model_dump(exclude_unset=True)

    if "status" in update_data:
        updates.append("status = ?")
        values.append(update_data["status"])

        if update_data["status"] == "active" and not current["started_at"]:
            updates.append("started_at = ?")
            values.append(now)
        if update_data["status"] in ["succeeded", "failed", "expired"]:
            updates.append("completed_at = ?")
            values.append(now)

    if "claimed_by" in update_data:
        updates.append("claimed_by = ?")
        values.append(update_data["claimed_by"])

    if "title" in update_data:
        updates.append("title = ?")
        values.append(update_data["title"])

    if "description" in update_data:
        updates.append("description = ?")
        values.append(update_data["description"])

    if "station" in update_data:
        updates.append("station = ?")
        values.append(update_data["station"])

    if "time_limit" in update_data:
        updates.append("time_limit = ?")
        values.append(update_data["time_limit"])
        updates.append("expires_at = ?")
        values.append((datetime.now(UTC) + timedelta(seconds=update_data["time_limit"])).isoformat())

    if updates:
        values.append(task_id)
        await db.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", values)
        await db.commit()

    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    return parse_task(await cursor.fetchone())


@router.post("/{task_id}/claim")
async def claim_task(task_id: str, claimed_by: str, db: aiosqlite.Connection = Depends(get_db)):
    """Claim a task."""
    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    task = await cursor.fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["status"] != "pending":
        raise HTTPException(status_code=400, detail="Task is not pending")

    await db.execute(
        "UPDATE tasks SET claimed_by = ?, status = 'active', started_at = ? WHERE id = ?",
        (claimed_by, datetime.now(UTC).isoformat(), task_id),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    return parse_task(await cursor.fetchone())


@router.post("/{task_id}/complete")
async def complete_task(
    task_id: str,
    status: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Complete a task (succeeded or failed)."""
    if status not in ["succeeded", "failed"]:
        raise HTTPException(status_code=400, detail="Invalid completion status")

    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    task = await cursor.fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    now = datetime.now(UTC).isoformat()
    await db.execute(
        "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?",
        (status, now, task_id),
    )
    await db.commit()

    # Execute outcomes
    outcome_field = "on_success" if status == "succeeded" else "on_failure"
    outcomes = safe_json_loads(task[outcome_field], default=[], field_name=outcome_field)
    for outcome in outcomes:
        try:
            action_type = outcome.get("type")
            target = outcome.get("target")
            value = outcome.get("value")
            data = outcome.get("data", {})

            if action_type == "set_status" and target:
                cursor2 = await db.execute("SELECT max_value FROM system_states WHERE id = ?", (target,))
                row2 = await cursor2.fetchone()
                if row2:
                    status_enum = SystemStatus(value)
                    new_value = calculate_value_from_status(status_enum, row2["max_value"])
                    await db.execute(
                        "UPDATE system_states SET status = ?, value = ?, updated_at = ? WHERE id = ?",
                        (value, new_value, now, target),
                    )

            elif action_type == "set_value" and target:
                cursor2 = await db.execute("SELECT max_value FROM system_states WHERE id = ?", (target,))
                row2 = await cursor2.fetchone()
                if row2:
                    percentage = (value / row2["max_value"]) * 100 if row2["max_value"] > 0 else 0
                    new_status = calculate_status_from_percentage(percentage)
                    await db.execute(
                        "UPDATE system_states SET value = ?, status = ?, updated_at = ? WHERE id = ?",
                        (value, new_status.value, now, target),
                    )

            elif action_type == "emit_event":
                outcome_event_id = str(uuid.uuid4())
                await db.execute(
                    """
                    INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        outcome_event_id,
                        task["ship_id"],
                        data.get("type", "task_outcome"),
                        data.get("severity", "info"),
                        data.get("message", f"Task outcome: {task['title']}"),
                        json.dumps(data),
                        now,
                    ),
                )
        except Exception:
            pass  # Best-effort outcome execution
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
            task["ship_id"],
            "task_completed",
            "info" if status == "succeeded" else "warning",
            f"Task {status}: {task['title']}",
            json.dumps({"task_id": task_id, "status": status}),
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    return parse_task(await cursor.fetchone())


@router.delete("/{task_id}")
async def delete_task(task_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a task."""
    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Task not found")

    await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    await db.commit()
    return {"deleted": True}
