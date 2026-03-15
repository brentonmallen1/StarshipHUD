"""
Timer API endpoints for countdown displays.
"""

import json
import uuid
from datetime import UTC, datetime, timedelta

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.base import TimerDirection
from app.models.timer import Timer, TimerCreate, TimerUpdate

router = APIRouter()


@router.get("", response_model=list[Timer])
async def list_timers(
    ship_id: str | None = Query(None),
    visible_only: bool = Query(False),
    gm_only: bool | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List timers, optionally filtered by ship, visibility, and gm_only.

    gm_only filter:
    - None (omitted): return all timers
    - True: return only GM-only timers (for GmTimerFloating)
    - False: return only player-visible timers (for PlayerTimerBar)
    """
    query = "SELECT * FROM timers WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)

    if visible_only:
        query += " AND visible = 1"

    if gm_only is not None:
        query += " AND gm_only = ?"
        params.append(1 if gm_only else 0)

    # Sort: countdown by end_time ASC, countup by start_time ASC
    query += " ORDER BY COALESCE(end_time, start_time) ASC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/{timer_id}", response_model=Timer)
async def get_timer(timer_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a timer by ID."""
    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Timer not found")
    return dict(row)


@router.post("", response_model=Timer)
async def create_timer(timer: TimerCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new timer."""
    timer_id = timer.id if timer.id else str(uuid.uuid4())
    now = datetime.now(UTC)

    # Handle direction-specific fields
    end_time = None
    start_time = None

    # Store original duration for reset functionality
    duration_seconds = None

    if timer.direction == TimerDirection.COUNTUP:
        # Countup: use start_time, default to now
        start_time = timer.start_time if timer.start_time else now
    else:
        # Countdown: calculate end_time from duration if provided
        end_time = timer.end_time
        if timer.duration_seconds is not None:
            duration_seconds = timer.duration_seconds
            end_time = now + timedelta(seconds=timer.duration_seconds)
        elif timer.end_time is not None:
            # Calculate duration from provided end_time
            duration_seconds = int((timer.end_time - now).total_seconds())

        # Validate that we have an end_time for countdown
        if end_time is None:
            raise HTTPException(
                status_code=400,
                detail="Countdown timers require end_time or duration_seconds",
            )

    # Validate scenario_id if provided (only valid for countdown)
    if timer.scenario_id:
        cursor = await db.execute(
            "SELECT id FROM scenarios WHERE id = ?", (timer.scenario_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(
                status_code=400, detail=f"Scenario not found: {timer.scenario_id}"
            )

    # Timers start paused - user must explicitly start them
    paused_at = now.isoformat()

    await db.execute(
        """
        INSERT INTO timers (id, ship_id, label, direction, end_time, start_time, duration_seconds, severity, scenario_id, visible, display_preset, gm_only, paused_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            timer_id,
            timer.ship_id,
            timer.label,
            timer.direction.value,
            end_time.isoformat() if end_time else None,
            start_time.isoformat() if start_time else None,
            duration_seconds,
            timer.severity.value,
            timer.scenario_id,
            1 if timer.visible else 0,
            timer.display_preset.value,
            1 if timer.gm_only else 0,
            paused_at,
            now.isoformat(),
            now.isoformat(),
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    return dict(await cursor.fetchone())


@router.patch("/{timer_id}", response_model=Timer)
async def update_timer(
    timer_id: str,
    timer: TimerUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a timer."""
    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    current = await cursor.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Timer not found")

    current_dict = dict(current)
    update_data = timer.model_dump(exclude_unset=True)
    now = datetime.now(UTC)

    # Validate scenario_id if being updated
    if "scenario_id" in update_data and update_data["scenario_id"]:
        cursor = await db.execute(
            "SELECT id FROM scenarios WHERE id = ?", (update_data["scenario_id"],)
        )
        if not await cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail=f"Scenario not found: {update_data['scenario_id']}",
            )

    # Handle duration_seconds: calculate new end_time
    if "duration_seconds" in update_data and update_data["duration_seconds"] is not None:
        duration_seconds = update_data.pop("duration_seconds")
        # Calculate new end_time from now (timer will be reset to this duration)
        new_end_time = now + timedelta(seconds=duration_seconds)
        update_data["end_time"] = new_end_time
        # Also update stored duration_seconds for future resets
        update_data["duration_seconds"] = duration_seconds

    # Build update query
    updates = []
    values = []

    for field, value in update_data.items():
        if field == "severity" and value:
            value = value.value
        elif field == "display_preset" and value:
            value = value.value
        elif field == "direction" and value:
            value = value.value
        elif field in ("visible", "gm_only") and value is not None:
            value = 1 if value else 0
        elif field in ("end_time", "start_time", "paused_at") and value is not None:
            if hasattr(value, 'isoformat'):
                value = value.isoformat()

        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(now.isoformat())
        values.append(timer_id)
        await db.execute(
            f"UPDATE timers SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    return dict(await cursor.fetchone())


@router.delete("/{timer_id}")
async def delete_timer(timer_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete (cancel) a timer."""
    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Timer not found")

    await db.execute("DELETE FROM timers WHERE id = ?", (timer_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/{timer_id}/trigger", response_model=dict)
async def trigger_timer(timer_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """
    Manually trigger a timer early.
    Executes the linked scenario (if any) and deletes the timer.
    """
    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    timer = await cursor.fetchone()
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")

    timer_dict = dict(timer)
    scenario_id = timer_dict.get("scenario_id")
    result = {"triggered": True, "scenario_executed": False}

    # Execute linked scenario if present
    if scenario_id:
        # Import here to avoid circular imports
        from app.api.scenarios import execute_scenario_internal

        try:
            await execute_scenario_internal(scenario_id, db)
            result["scenario_executed"] = True
            result["scenario_id"] = scenario_id
        except Exception as e:
            result["scenario_error"] = str(e)

    # Emit timer_expired event
    event_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, transmitted, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            timer_dict["ship_id"],
            "timer_expired",
            timer_dict.get("severity", "warning"),
            f"Timer expired: {timer_dict['label']}",
            json.dumps({
                "timer_id": timer_id,
                "timer_label": timer_dict["label"],
                "triggered_manually": True,
                "scenario_id": scenario_id,
            }),
            1,  # transmitted
            "system",
            now,
        ),
    )

    # Delete the timer
    await db.execute("DELETE FROM timers WHERE id = ?", (timer_id,))
    await db.commit()

    return result


@router.post("/{timer_id}/pause", response_model=Timer)
async def pause_timer(timer_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Pause a timer (saves remaining time)."""
    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    timer = await cursor.fetchone()
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")

    timer_dict = dict(timer)
    if timer_dict.get("paused_at"):
        raise HTTPException(status_code=400, detail="Timer is already paused")

    now = datetime.now(UTC).isoformat()
    await db.execute(
        "UPDATE timers SET paused_at = ?, updated_at = ? WHERE id = ?",
        (now, now, timer_id),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    return dict(await cursor.fetchone())


@router.post("/{timer_id}/resume", response_model=Timer)
async def resume_timer(timer_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Resume a paused timer.

    For countdown: extends end_time by paused duration.
    For countup: adjusts start_time forward by paused duration so elapsed continues correctly.
    """
    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    timer = await cursor.fetchone()
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")

    timer_dict = dict(timer)
    paused_at_str = timer_dict.get("paused_at")
    if not paused_at_str:
        raise HTTPException(status_code=400, detail="Timer is not paused")

    # Calculate how long it was paused
    now = datetime.now(UTC)
    paused_at = datetime.fromisoformat(paused_at_str)
    paused_duration = now - paused_at

    direction = timer_dict.get("direction", "countdown")

    if direction == "countup":
        # Countup: adjust start_time forward so elapsed continues from where it stopped
        start_time_str = timer_dict.get("start_time")
        if start_time_str:
            start_time = datetime.fromisoformat(start_time_str)
            new_start_time = start_time + paused_duration
            await db.execute(
                "UPDATE timers SET paused_at = NULL, start_time = ?, updated_at = ? WHERE id = ?",
                (new_start_time.isoformat(), now.isoformat(), timer_id),
            )
        else:
            # Fallback: just clear paused_at
            await db.execute(
                "UPDATE timers SET paused_at = NULL, updated_at = ? WHERE id = ?",
                (now.isoformat(), timer_id),
            )
    else:
        # Countdown: extend end_time by paused duration
        end_time_str = timer_dict.get("end_time")
        if end_time_str:
            end_time = datetime.fromisoformat(end_time_str)
            new_end_time = end_time + paused_duration
            await db.execute(
                "UPDATE timers SET paused_at = NULL, end_time = ?, updated_at = ? WHERE id = ?",
                (new_end_time.isoformat(), now.isoformat(), timer_id),
            )
        else:
            # Fallback: just clear paused_at
            await db.execute(
                "UPDATE timers SET paused_at = NULL, updated_at = ? WHERE id = ?",
                (now.isoformat(), timer_id),
            )

    await db.commit()

    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    return dict(await cursor.fetchone())


@router.post("/{timer_id}/reset", response_model=Timer)
async def reset_timer(timer_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Reset a timer to its original duration/state.

    For countdown: recalculates end_time based on original duration.
    For countup: resets start_time to now.
    Clears paused_at if set.
    """
    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    timer = await cursor.fetchone()
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")

    timer_dict = dict(timer)
    now = datetime.now(UTC)
    direction = timer_dict.get("direction", "countdown")

    # Reset leaves timer paused - user must explicitly start it
    paused_at = now.isoformat()

    if direction == "countup":
        # Countup: reset start_time to now (will start from 0 when resumed)
        await db.execute(
            "UPDATE timers SET start_time = ?, paused_at = ?, updated_at = ? WHERE id = ?",
            (now.isoformat(), paused_at, now.isoformat(), timer_id),
        )
    else:
        # Countdown: recalculate end_time based on stored duration_seconds
        duration_seconds = timer_dict.get("duration_seconds")

        if duration_seconds is not None:
            # Use stored duration
            new_end_time = now + timedelta(seconds=duration_seconds)
            await db.execute(
                "UPDATE timers SET end_time = ?, paused_at = ?, updated_at = ? WHERE id = ?",
                (new_end_time.isoformat(), paused_at, now.isoformat(), timer_id),
            )
        else:
            # Fallback for old timers without duration_seconds: calculate from end_time - created_at
            end_time_str = timer_dict.get("end_time")
            created_at_str = timer_dict.get("created_at")

            if end_time_str and created_at_str:
                original_end = datetime.fromisoformat(end_time_str)
                created_at = datetime.fromisoformat(created_at_str)
                original_duration = original_end - created_at
                new_end_time = now + original_duration

                await db.execute(
                    "UPDATE timers SET end_time = ?, paused_at = ?, updated_at = ? WHERE id = ?",
                    (new_end_time.isoformat(), paused_at, now.isoformat(), timer_id),
                )
            else:
                # Last resort: just set paused
                await db.execute(
                    "UPDATE timers SET paused_at = ?, updated_at = ? WHERE id = ?",
                    (paused_at, now.isoformat(), timer_id),
                )

    await db.commit()

    cursor = await db.execute("SELECT * FROM timers WHERE id = ?", (timer_id,))
    return dict(await cursor.fetchone())
