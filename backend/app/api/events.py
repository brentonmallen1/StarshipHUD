"""
Event API endpoints.
"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import aiosqlite

from app.database import get_db
from app.models.event import Event, EventCreate, EventUpdate

router = APIRouter()


def parse_event(row: aiosqlite.Row) -> dict:
    """Parse event row, converting JSON fields."""
    result = dict(row)
    result["data"] = json.loads(result["data"])
    result["transmitted"] = bool(result.get("transmitted", 1))
    return result


@router.get("", response_model=list[Event])
async def list_events(
    ship_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    types: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    transmitted: Optional[bool] = Query(None),
    limit: int = Query(50, le=200),
    since: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List events, optionally filtered."""
    query = "SELECT * FROM events WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if type:
        query += " AND type = ?"
        params.append(type)
    if types:
        # Support comma-separated list of types
        type_list = types.split(",")
        placeholders = ",".join("?" * len(type_list))
        query += f" AND type IN ({placeholders})"
        params.extend(type_list)
    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if transmitted is not None:
        query += " AND transmitted = ?"
        params.append(1 if transmitted else 0)
    if since:
        query += " AND created_at > ?"
        params.append(since)

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_event(row) for row in rows]


@router.get("/{event_id}", response_model=Event)
async def get_event(event_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get an event by ID."""
    cursor = await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    return parse_event(row)


@router.post("", response_model=Event)
async def create_event(event: EventCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new event."""
    event_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, transmitted, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            event.ship_id,
            event.type,
            event.severity.value,
            event.message,
            json.dumps(event.data),
            1 if event.transmitted else 0,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    return parse_event(await cursor.fetchone())


@router.delete("/{event_id}")
async def delete_event(event_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete an event (GM only)."""
    cursor = await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Event not found")

    await db.execute("DELETE FROM events WHERE id = ?", (event_id,))
    await db.commit()
    return {"deleted": True}


@router.patch("/{event_id}", response_model=Event)
async def update_event(
    event_id: str,
    updates: EventUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update an event (GM only)."""
    cursor = await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")

    # Build update query dynamically
    fields = []
    params = []

    if updates.type is not None:
        fields.append("type = ?")
        params.append(updates.type)
    if updates.severity is not None:
        fields.append("severity = ?")
        params.append(updates.severity.value)
    if updates.message is not None:
        fields.append("message = ?")
        params.append(updates.message)
    if updates.data is not None:
        fields.append("data = ?")
        params.append(json.dumps(updates.data))
    if updates.transmitted is not None:
        fields.append("transmitted = ?")
        params.append(1 if updates.transmitted else 0)

    if fields:
        query = f"UPDATE events SET {', '.join(fields)} WHERE id = ?"
        params.append(event_id)
        await db.execute(query, params)
        await db.commit()

    cursor = await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    return parse_event(await cursor.fetchone())


@router.get("/feed/{ship_id}")
async def get_event_feed(
    ship_id: str,
    limit: int = Query(20, le=100),
    types: Optional[str] = Query(None),
    transmitted: Optional[bool] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get event feed for a ship (optimized for polling)."""
    query = "SELECT * FROM events WHERE ship_id = ?"
    params = [ship_id]

    if types:
        type_list = types.split(",")
        placeholders = ",".join("?" * len(type_list))
        query += f" AND type IN ({placeholders})"
        params.extend(type_list)

    if transmitted is not None:
        query += " AND transmitted = ?"
        params.append(1 if transmitted else 0)

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_event(row) for row in rows]
