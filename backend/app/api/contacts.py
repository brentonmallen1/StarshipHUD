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
from app.models.contact import Contact, ContactCreate, ContactUpdate
from app.utils import safe_json_loads

router = APIRouter()


def parse_contact(row: aiosqlite.Row) -> dict:
    """Parse contact row, converting JSON fields."""
    result = dict(row)
    result["tags"] = safe_json_loads(result["tags"], default=[], field_name="tags")
    return result


@router.get("", response_model=list[Contact])
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


@router.get("/{contact_id}", response_model=Contact)
async def get_contact(contact_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a contact by ID."""
    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    return parse_contact(row)


@router.post("", response_model=Contact)
async def create_contact(
    contact: ContactCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new contact."""
    contact_id = contact.id if contact.id else str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO contacts (id, ship_id, name, affiliation, threat_level, role, notes, image_url, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            contact_id,
            contact.ship_id,
            contact.name,
            contact.affiliation,
            contact.threat_level.value,
            contact.role,
            contact.notes,
            contact.image_url,
            json.dumps(contact.tags),
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    return parse_contact(await cursor.fetchone())


@router.patch("/{contact_id}", response_model=Contact)
async def update_contact(
    contact_id: str,
    contact: ContactUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a contact."""
    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Contact not found")

    update_data = contact.model_dump(exclude_unset=True)

    updates = []
    values = []

    for field, value in update_data.items():
        if field == "threat_level" and value:
            value = value.value
        elif field == "tags" and value is not None:
            value = json.dumps(value)

        updates.append(f"{field} = ?")
        values.append(value)

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
