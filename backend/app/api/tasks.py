"""
Tasks API endpoints.
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import aiosqlite

from app.database import get_db

router = APIRouter()


def parse_task(row: aiosqlite.Row) -> dict:
    """Parse task row, converting JSON fields."""
    result = dict(row)
    result["on_success"] = json.loads(result["on_success"])
    result["on_failure"] = json.loads(result["on_failure"])
    result["on_expire"] = json.loads(result["on_expire"])
    return result


@router.get("")
async def list_tasks(
    ship_id: Optional[str] = Query(None),
    station: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
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
    ship_id: str,
    title: str,
    station: str,
    description: Optional[str] = None,
    incident_id: Optional[str] = None,
    time_limit: Optional[int] = None,
    minigame_id: Optional[str] = None,
    minigame_difficulty: Optional[int] = None,
    on_success: list[dict] = [],
    on_failure: list[dict] = [],
    on_expire: list[dict] = [],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new task."""
    task_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Calculate expiration if time limit provided
    expires_at = None
    if time_limit:
        expires_at = (datetime.utcnow() + timedelta(seconds=time_limit)).isoformat()

    await db.execute(
        """
        INSERT INTO tasks (id, ship_id, incident_id, title, description, station, time_limit, expires_at,
                          minigame_id, minigame_difficulty, on_success, on_failure, on_expire, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            task_id,
            ship_id,
            incident_id,
            title,
            description,
            station,
            time_limit,
            expires_at,
            minigame_id,
            minigame_difficulty,
            json.dumps(on_success),
            json.dumps(on_failure),
            json.dumps(on_expire),
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
            ship_id,
            "task_created",
            "info",
            f"New task: {title}",
            json.dumps({"task_id": task_id, "station": station}),
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    return parse_task(await cursor.fetchone())


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    status: Optional[str] = None,
    claimed_by: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a task."""
    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    current = await cursor.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = []
    values = []
    now = datetime.utcnow().isoformat()

    if status is not None:
        updates.append("status = ?")
        values.append(status)

        if status == "active" and not current["started_at"]:
            updates.append("started_at = ?")
            values.append(now)
        if status in ["succeeded", "failed", "expired"]:
            updates.append("completed_at = ?")
            values.append(now)

    if claimed_by is not None:
        updates.append("claimed_by = ?")
        values.append(claimed_by)

    if updates:
        values.append(task_id)
        await db.execute(
            f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", values
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    return parse_task(await cursor.fetchone())


@router.post("/{task_id}/claim")
async def claim_task(
    task_id: str, claimed_by: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Claim a task."""
    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    task = await cursor.fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["status"] != "pending":
        raise HTTPException(status_code=400, detail="Task is not pending")

    await db.execute(
        "UPDATE tasks SET claimed_by = ?, status = 'active', started_at = ? WHERE id = ?",
        (claimed_by, datetime.utcnow().isoformat(), task_id),
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

    now = datetime.utcnow().isoformat()
    await db.execute(
        "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?",
        (status, now, task_id),
    )
    await db.commit()

    # Execute outcomes
    outcomes = json.loads(task["on_success"] if status == "succeeded" else task["on_failure"])
    # TODO: Implement outcome execution logic

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
