"""
Incidents API endpoints.
"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import aiosqlite

from app.database import get_db

router = APIRouter()


def parse_incident(row: aiosqlite.Row) -> dict:
    """Parse incident row, converting JSON fields."""
    result = dict(row)
    result["linked_system_ids"] = json.loads(result["linked_system_ids"])
    result["effects"] = json.loads(result["effects"])
    return result


@router.get("")
async def list_incidents(
    ship_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List incidents, optionally filtered."""
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if status:
        query += " AND status = ?"
        params.append(status)
    if severity:
        query += " AND severity = ?"
        params.append(severity)

    query += " ORDER BY created_at DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_incident(row) for row in rows]


@router.get("/{incident_id}")
async def get_incident(incident_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get an incident by ID."""
    cursor = await db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return parse_incident(row)


@router.post("")
async def create_incident(
    ship_id: str,
    name: str,
    severity: str,
    description: Optional[str] = None,
    linked_system_ids: list[str] = [],
    effects: list[dict] = [],
    source: str = "manual",
    source_id: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new incident."""
    incident_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO incidents (id, ship_id, name, description, severity, linked_system_ids, effects,
                              source, source_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            incident_id,
            ship_id,
            name,
            description,
            severity,
            json.dumps(linked_system_ids),
            json.dumps(effects),
            source,
            source_id,
            now,
        ),
    )
    await db.commit()

    # Emit incident created event
    event_id = str(uuid.uuid4())
    event_severity = "critical" if severity in ["major", "critical"] else "warning"
    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            ship_id,
            "incident_created",
            event_severity,
            f"Incident: {name}",
            json.dumps({"incident_id": incident_id, "severity": severity}),
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    return parse_incident(await cursor.fetchone())


@router.patch("/{incident_id}")
async def update_incident(
    incident_id: str,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    description: Optional[str] = None,
    linked_system_ids: Optional[list[str]] = None,
    effects: Optional[list[dict]] = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update an incident."""
    cursor = await db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Incident not found")

    updates = []
    values = []
    now = datetime.utcnow().isoformat()

    if status is not None:
        updates.append("status = ?")
        values.append(status)
        if status in ["resolved", "failed"]:
            updates.append("resolved_at = ?")
            values.append(now)

    if severity is not None:
        updates.append("severity = ?")
        values.append(severity)

    if description is not None:
        updates.append("description = ?")
        values.append(description)

    if linked_system_ids is not None:
        updates.append("linked_system_ids = ?")
        values.append(json.dumps(linked_system_ids))

    if effects is not None:
        updates.append("effects = ?")
        values.append(json.dumps(effects))

    if updates:
        values.append(incident_id)
        await db.execute(
            f"UPDATE incidents SET {', '.join(updates)} WHERE id = ?", values
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    return parse_incident(await cursor.fetchone())


@router.delete("/{incident_id}")
async def delete_incident(incident_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete an incident."""
    cursor = await db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Incident not found")

    await db.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
    await db.commit()
    return {"deleted": True}
