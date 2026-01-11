"""
Sensor contacts API endpoints for radar/sensor displays.
"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import aiosqlite

from app.database import get_db
from app.models.sensor_contact import (
    IFF,
    RadarThreatLevel,
    SensorContact,
    SensorContactCreate,
    SensorContactUpdate,
    SensorContactWithDossier,
)

router = APIRouter()


def parse_sensor_contact(row: aiosqlite.Row) -> dict:
    """Parse sensor contact row."""
    result = dict(row)
    # Convert visible from int to bool
    result["visible"] = bool(result.get("visible", 0))
    return result


def parse_sensor_contact_with_dossier(
    contact_row: aiosqlite.Row, dossier_row: Optional[aiosqlite.Row]
) -> dict:
    """Parse sensor contact with embedded dossier."""
    result = parse_sensor_contact(contact_row)
    if dossier_row:
        dossier = dict(dossier_row)
        dossier["tags"] = json.loads(dossier.get("tags", "[]"))
        result["dossier"] = dossier
    else:
        result["dossier"] = None
    return result


@router.get("", response_model=list[SensorContact])
async def list_sensor_contacts(
    ship_id: Optional[str] = Query(None),
    visible: Optional[bool] = Query(None),
    iff: Optional[IFF] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List sensor contacts, optionally filtered."""
    query = "SELECT * FROM sensor_contacts WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if visible is not None:
        query += " AND visible = ?"
        params.append(1 if visible else 0)
    if iff:
        query += " AND iff = ?"
        params.append(iff.value)

    query += " ORDER BY last_updated_at DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_sensor_contact(row) for row in rows]


@router.get("/with-dossiers", response_model=list[SensorContactWithDossier])
async def list_sensor_contacts_with_dossiers(
    ship_id: Optional[str] = Query(None),
    visible: Optional[bool] = Query(None),
    iff: Optional[IFF] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List sensor contacts with embedded contact dossiers."""
    query = """
        SELECT sc.*, c.id as dossier_id, c.ship_id as dossier_ship_id, c.name, c.affiliation,
               c.threat_level, c.role, c.notes as dossier_notes, c.image_url, c.tags,
               c.last_contacted_at, c.created_at as dossier_created_at,
               c.updated_at as dossier_updated_at
        FROM sensor_contacts sc
        LEFT JOIN contacts c ON sc.contact_id = c.id
        WHERE 1=1
    """
    params = []

    if ship_id:
        query += " AND sc.ship_id = ?"
        params.append(ship_id)
    if visible is not None:
        query += " AND sc.visible = ?"
        params.append(1 if visible else 0)
    if iff:
        query += " AND sc.iff = ?"
        params.append(iff.value)

    query += " ORDER BY sc.last_updated_at DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    results = []
    for row in rows:
        row_dict = dict(row)

        # Build dossier dict if contact_id exists
        dossier = None
        if row_dict.get("dossier_id"):
            dossier = {
                "id": row_dict["dossier_id"],
                "ship_id": row_dict["dossier_ship_id"],
                "name": row_dict["name"],
                "affiliation": row_dict["affiliation"],
                "threat_level": row_dict["threat_level"],
                "role": row_dict["role"],
                "notes": row_dict["dossier_notes"],
                "image_url": row_dict["image_url"],
                "tags": json.loads(row_dict.get("tags", "[]")),
                "last_contacted_at": row_dict["last_contacted_at"],
                "created_at": row_dict["dossier_created_at"],
                "updated_at": row_dict["dossier_updated_at"],
            }

        # Clean up the sensor contact fields
        sensor_contact = {
            "id": row_dict["id"],
            "ship_id": row_dict["ship_id"],
            "label": row_dict["label"],
            "contact_id": row_dict["contact_id"],
            "confidence": row_dict["confidence"],
            "iff": row_dict["iff"],
            "threat": row_dict["threat"],
            "bearing_deg": row_dict["bearing_deg"],
            "range_km": row_dict["range_km"],
            "vector": row_dict["vector"],
            "signal_strength": row_dict["signal_strength"],
            "notes": row_dict["notes"],
            "visible": bool(row_dict.get("visible", 0)),
            "first_detected_at": row_dict["first_detected_at"],
            "last_updated_at": row_dict["last_updated_at"],
            "lost_contact_at": row_dict.get("lost_contact_at"),
            "dossier": dossier,
        }
        results.append(sensor_contact)

    return results


@router.get("/{sensor_contact_id}", response_model=SensorContact)
async def get_sensor_contact(
    sensor_contact_id: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Get a sensor contact by ID."""
    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (sensor_contact_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Sensor contact not found")
    return parse_sensor_contact(row)


@router.post("", response_model=SensorContact)
async def create_sensor_contact(
    sensor_contact: SensorContactCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new sensor contact."""
    contact_id = sensor_contact.id if sensor_contact.id else str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO sensor_contacts (
            id, ship_id, label, contact_id, confidence, iff, threat,
            bearing_deg, range_km, vector, signal_strength, notes, visible,
            first_detected_at, last_updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            contact_id,
            sensor_contact.ship_id,
            sensor_contact.label,
            sensor_contact.contact_id,
            sensor_contact.confidence,
            sensor_contact.iff.value,
            sensor_contact.threat.value,
            sensor_contact.bearing_deg,
            sensor_contact.range_km,
            sensor_contact.vector,
            sensor_contact.signal_strength,
            sensor_contact.notes,
            1 if sensor_contact.visible else 0,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (contact_id,)
    )
    return parse_sensor_contact(await cursor.fetchone())


@router.patch("/{sensor_contact_id}", response_model=SensorContact)
async def update_sensor_contact(
    sensor_contact_id: str,
    sensor_contact: SensorContactUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a sensor contact."""
    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (sensor_contact_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sensor contact not found")

    update_data = sensor_contact.model_dump(exclude_unset=True)

    updates = []
    values = []

    for field, value in update_data.items():
        if field == "iff" and value:
            value = value.value
        elif field == "threat" and value:
            value = value.value
        elif field == "visible" and value is not None:
            value = 1 if value else 0

        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(sensor_contact_id)
        await db.execute(
            f"UPDATE sensor_contacts SET {', '.join(updates)}, last_updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (sensor_contact_id,)
    )
    return parse_sensor_contact(await cursor.fetchone())


@router.patch("/{sensor_contact_id}/reveal", response_model=SensorContact)
async def reveal_sensor_contact(
    sensor_contact_id: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Reveal a sensor contact to players (set visible=true)."""
    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (sensor_contact_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sensor contact not found")

    now = datetime.utcnow().isoformat()
    await db.execute(
        "UPDATE sensor_contacts SET visible = 1, last_updated_at = ? WHERE id = ?",
        (now, sensor_contact_id),
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (sensor_contact_id,)
    )
    return parse_sensor_contact(await cursor.fetchone())


@router.patch("/{sensor_contact_id}/hide", response_model=SensorContact)
async def hide_sensor_contact(
    sensor_contact_id: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Hide a sensor contact from players (set visible=false)."""
    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (sensor_contact_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sensor contact not found")

    now = datetime.utcnow().isoformat()
    await db.execute(
        "UPDATE sensor_contacts SET visible = 0, last_updated_at = ? WHERE id = ?",
        (now, sensor_contact_id),
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (sensor_contact_id,)
    )
    return parse_sensor_contact(await cursor.fetchone())


@router.delete("/{sensor_contact_id}")
async def delete_sensor_contact(
    sensor_contact_id: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Delete a sensor contact."""
    cursor = await db.execute(
        "SELECT * FROM sensor_contacts WHERE id = ?", (sensor_contact_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Sensor contact not found")

    await db.execute("DELETE FROM sensor_contacts WHERE id = ?", (sensor_contact_id,))
    await db.commit()
    return {"deleted": True}
