"""
Incidents API endpoints.
"""

import json
import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.incident import IncidentCreate, IncidentUpdate
from app.utils import safe_json_loads

router = APIRouter()


def parse_incident(row: aiosqlite.Row) -> dict:
    """Parse incident row, converting JSON fields."""
    result = dict(row)
    result["linked_system_ids"] = safe_json_loads(
        result["linked_system_ids"], default=[], field_name="linked_system_ids"
    )
    result["effects"] = safe_json_loads(result["effects"], default=[], field_name="effects")
    return result


@router.get("")
async def list_incidents(
    ship_id: str | None = Query(None),
    status: str | None = Query(None),
    severity: str | None = Query(None),
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
    incident: IncidentCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new incident."""
    incident_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        INSERT INTO incidents (id, ship_id, name, description, severity, linked_system_ids, effects,
                              source, source_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            incident_id,
            incident.ship_id,
            incident.name,
            incident.description,
            incident.severity,
            json.dumps(incident.linked_system_ids),
            json.dumps(incident.effects),
            incident.source,
            incident.source_id,
            now,
        ),
    )
    await db.commit()

    # Emit incident created event
    event_id = str(uuid.uuid4())
    event_severity = "critical" if incident.severity in ["major", "critical"] else "warning"
    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            incident.ship_id,
            "incident_created",
            event_severity,
            f"Incident: {incident.name}",
            json.dumps({"incident_id": incident_id, "severity": incident.severity}),
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    return parse_incident(await cursor.fetchone())


@router.patch("/{incident_id}")
async def update_incident(
    incident_id: str,
    incident: IncidentUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update an incident."""
    cursor = await db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Incident not found")

    updates = []
    values = []
    now = datetime.now(UTC).isoformat()
    update_data = incident.model_dump(exclude_unset=True)

    if "name" in update_data:
        updates.append("name = ?")
        values.append(update_data["name"])

    if "status" in update_data:
        updates.append("status = ?")
        values.append(update_data["status"])
        if update_data["status"] in ["resolved", "failed"]:
            updates.append("resolved_at = ?")
            values.append(now)

    if "severity" in update_data:
        updates.append("severity = ?")
        values.append(update_data["severity"])

    if "description" in update_data:
        updates.append("description = ?")
        values.append(update_data["description"])

    if "linked_system_ids" in update_data:
        updates.append("linked_system_ids = ?")
        values.append(json.dumps(update_data["linked_system_ids"]))

    if "effects" in update_data:
        updates.append("effects = ?")
        values.append(json.dumps(update_data["effects"]))

    if updates:
        values.append(incident_id)
        await db.execute(f"UPDATE incidents SET {', '.join(updates)} WHERE id = ?", values)
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
