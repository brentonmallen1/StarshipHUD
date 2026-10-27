"""
Event emission.

Every state change that belongs in the ship log / alert feed / GM audit trail goes
through ``emit_event`` so rows are shaped consistently.

``transmitted`` decides whether players can see the event (players only ever
receive transmitted events). GM-authoring changes -- hidden contacts, layout and
preset edits, anything about content players haven't been shown -- must pass
``transmitted=False``.

``emit_event`` never commits: callers commit (or roll back) together with the
state change the event describes.
"""

import json
import uuid
from datetime import UTC, datetime
from typing import Any

import aiosqlite

# Maximum number of system-generated events to keep per ship.
# GM-injected events (source='gm') are exempt from this limit.
SYSTEM_EVENT_CAP = 250


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


async def prune_system_events(db: aiosqlite.Connection, ship_id: str) -> None:
    """Drop the oldest system events beyond SYSTEM_EVENT_CAP (GM events are exempt)."""
    await db.execute(
        """
        DELETE FROM events WHERE id IN (
            SELECT id FROM events
            WHERE ship_id = ? AND source = 'system'
            ORDER BY created_at DESC
            LIMIT -1 OFFSET ?
        )
        """,
        (ship_id, SYSTEM_EVENT_CAP),
    )


async def emit_event(
    db: aiosqlite.Connection,
    ship_id: str,
    type: str,
    message: str,
    *,
    severity: str = "info",
    data: dict[str, Any] | None = None,
    transmitted: bool = True,
    source: str = "system",
    event_id: str | None = None,
    created_at: str | None = None,
    prune: bool = True,
) -> str:
    """Insert an event row (without committing) and return its id."""
    event_id = event_id or str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO events (id, ship_id, type, severity, message, data, transmitted, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            ship_id,
            type,
            severity,
            message,
            json.dumps(data or {}),
            1 if transmitted else 0,
            source,
            created_at or now_iso(),
        ),
    )
    if prune and source == "system":
        await prune_system_events(db, ship_id)
    return event_id
