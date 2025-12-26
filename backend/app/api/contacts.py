"""
Contacts API endpoints.
"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import aiosqlite

from app.database import get_db

router = APIRouter()


def parse_contact(row: aiosqlite.Row) -> dict:
    """Parse contact row, converting JSON fields."""
    result = dict(row)
    result["tags"] = json.loads(result["tags"])
    return result


@router.get("")
async def list_contacts(
    ship_id: Optional[str] = Query(None),
    threat_level: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List contacts, optionally filtered."""
    query = "SELECT * FROM contacts WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if threat_level:
        query += " AND threat_level = ?"
        params.append(threat_level)

    query += " ORDER BY last_contacted_at DESC NULLS LAST, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_contact(row) for row in rows]


@router.get("/{contact_id}")
async def get_contact(contact_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a contact by ID."""
    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    return parse_contact(row)


@router.post("")
async def create_contact(
    ship_id: str,
    name: str,
    affiliation: Optional[str] = None,
    threat_level: str = "unknown",
    role: Optional[str] = None,
    notes: Optional[str] = None,
    tags: list[str] = [],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new contact."""
    contact_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO contacts (id, ship_id, name, affiliation, threat_level, role, notes, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (contact_id, ship_id, name, affiliation, threat_level, role, notes, json.dumps(tags), now, now),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    return parse_contact(await cursor.fetchone())


@router.patch("/{contact_id}")
async def update_contact(
    contact_id: str,
    name: Optional[str] = None,
    affiliation: Optional[str] = None,
    threat_level: Optional[str] = None,
    role: Optional[str] = None,
    notes: Optional[str] = None,
    tags: Optional[list[str]] = None,
    last_contacted_at: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a contact."""
    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Contact not found")

    updates = []
    values = []

    if name is not None:
        updates.append("name = ?")
        values.append(name)
    if affiliation is not None:
        updates.append("affiliation = ?")
        values.append(affiliation)
    if threat_level is not None:
        updates.append("threat_level = ?")
        values.append(threat_level)
    if role is not None:
        updates.append("role = ?")
        values.append(role)
    if notes is not None:
        updates.append("notes = ?")
        values.append(notes)
    if tags is not None:
        updates.append("tags = ?")
        values.append(json.dumps(tags))
    if last_contacted_at is not None:
        updates.append("last_contacted_at = ?")
        values.append(last_contacted_at)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(contact_id)
        await db.execute(
            f"UPDATE contacts SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    return parse_contact(await cursor.fetchone())


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a contact."""
    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Contact not found")

    await db.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
    await db.commit()
    return {"deleted": True}
