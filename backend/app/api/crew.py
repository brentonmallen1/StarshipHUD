"""
Crew API endpoints.
"""

import json
import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.crew import Crew, CrewCreate, CrewUpdate
from app.services.events import emit_event
from app.utils import safe_json_loads

router = APIRouter()

CREW_STATUS_SEVERITY = {
    "incapacitated": "warning",
    "missing": "warning",
    "critical": "critical",
    "deceased": "critical",
}


def parse_crew(row: aiosqlite.Row) -> dict:
    """Parse crew row, converting JSON fields."""
    result = dict(row)
    result["condition_tags"] = safe_json_loads(result["condition_tags"], default=[], field_name="condition_tags")
    result["is_npc"] = bool(result["is_npc"])
    return result


@router.get("", response_model=list[Crew])
async def list_crew(
    ship_id: str | None = Query(None),
    status: str | None = Query(None),
    is_npc: bool | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List crew members, optionally filtered."""
    query = "SELECT * FROM crew WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if status:
        query += " AND status = ?"
        params.append(status)
    if is_npc is not None:
        query += " AND is_npc = ?"
        params.append(1 if is_npc else 0)

    # PCs first, then NPCs alphabetically
    query += " ORDER BY is_npc ASC, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_crew(row) for row in rows]


@router.get("/{crew_id}", response_model=Crew)
async def get_crew_member(crew_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a crew member by ID."""
    cursor = await db.execute("SELECT * FROM crew WHERE id = ?", (crew_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Crew member not found")
    return parse_crew(row)


@router.post("", response_model=Crew)
async def create_crew_member(
    crew: CrewCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new crew member."""
    crew_id = crew.id if crew.id else str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        INSERT INTO crew (
            id,
            ship_id,
            name,
            role,
            status,
            player_name,
            user_id,
            default_panel_id,
            is_npc,
            notes,
            condition_tags,
            created_at,
            updated_at
            )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            crew_id,
            crew.ship_id,
            crew.name,
            crew.role,
            crew.status.value,
            crew.player_name,
            crew.user_id,
            crew.default_panel_id,
            1 if crew.is_npc else 0,
            crew.notes,
            json.dumps(crew.condition_tags),
            now,
            now,
        ),
    )
    await emit_event(
        db,
        crew.ship_id,
        "crew_added",
        f"Crew added: {crew.name}",
        data={"crew_id": crew_id, "name": crew.name},
        transmitted=False,
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM crew WHERE id = ?", (crew_id,))
    return parse_crew(await cursor.fetchone())


@router.patch("/{crew_id}", response_model=Crew)
async def update_crew_member(
    crew_id: str,
    crew: CrewUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a crew member."""
    cursor = await db.execute("SELECT * FROM crew WHERE id = ?", (crew_id,))
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Crew member not found")

    update_data = crew.model_dump(exclude_unset=True)

    updates = []
    values = []

    for field, value in update_data.items():
        if field == "status" and value:
            value = value.value
        elif field == "condition_tags" and value is not None:
            value = json.dumps(value)
        elif field == "is_npc" and value is not None:
            value = 1 if value else 0

        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.now(UTC).isoformat())
        values.append(crew_id)
        await db.execute(
            f"UPDATE crew SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        new_status = update_data.get("status")
        if new_status and new_status.value != existing["status"]:
            name = update_data.get("name") or existing["name"]
            await emit_event(
                db,
                existing["ship_id"],
                "crew_status_change",
                f"{name}: {new_status.value.replace('_', ' ')}",
                severity=CREW_STATUS_SEVERITY.get(new_status.value, "info"),
                data={"crew_id": crew_id, "name": name, "from": existing["status"], "to": new_status.value},
            )
        await db.commit()

    cursor = await db.execute("SELECT * FROM crew WHERE id = ?", (crew_id,))
    return parse_crew(await cursor.fetchone())


@router.delete("/{crew_id}")
async def delete_crew_member(crew_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a crew member."""
    cursor = await db.execute("SELECT * FROM crew WHERE id = ?", (crew_id,))
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Crew member not found")

    await db.execute("DELETE FROM crew WHERE id = ?", (crew_id,))
    await emit_event(
        db,
        existing["ship_id"],
        "crew_removed",
        f"Crew removed: {existing['name']}",
        data={"crew_id": crew_id, "name": existing["name"]},
        transmitted=False,
    )
    await db.commit()
    return {"deleted": True}
