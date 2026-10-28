"""
Ship posture changes, shared by the posture endpoint and scenarios.
"""

import json
from datetime import UTC, datetime

import aiosqlite

from app.models.base import Posture
from app.services.events import emit_event

# Predefined ROE presets for each posture level
ROE_PRESETS = {
    "green": {
        "weapons_safeties": "on",
        "comms_broadcast": "open",
        "transponder": "active",
        "sensor_emissions": "standard",
    },
    "yellow": {
        "weapons_safeties": "on",
        "comms_broadcast": "encrypted",
        "transponder": "active",
        "sensor_emissions": "standard",
    },
    "red": {
        "weapons_safeties": "off",
        "comms_broadcast": "encrypted",
        "transponder": "active",
        "sensor_emissions": "standard",
    },
    "silent_running": {
        "weapons_safeties": "on",
        "comms_broadcast": "silent",
        "transponder": "off",
        "sensor_emissions": "passive_only",
    },
    "general_quarters": {
        "weapons_safeties": "off",
        "comms_broadcast": "encrypted",
        "transponder": "masked",
        "sensor_emissions": "standard",
    },
}


def posture_event_severity(posture: str) -> str:
    return "warning" if posture in ["yellow", "red"] else "info"


def posture_event_message(posture: str) -> str:
    return f"Posture changed to {posture.upper()}"


async def apply_posture(
    db: aiosqlite.Connection,
    ship_id: str,
    posture: Posture,
    *,
    set_by: str,
    reason: str | None = None,
) -> str:
    """Set posture + its ROE preset and emit a posture_change event (no commit). Returns the event id."""
    posture = Posture(posture).value
    now = datetime.now(UTC).isoformat()
    await db.execute(
        """
        UPDATE posture_state
        SET posture = ?, roe = ?, posture_set_at = ?, posture_set_by = ?, updated_at = ?
        WHERE ship_id = ?
        """,
        (posture, json.dumps(ROE_PRESETS[posture]), now, set_by, now, ship_id),
    )
    return await emit_event(
        db,
        ship_id,
        "posture_change",
        posture_event_message(posture),
        severity=posture_event_severity(posture),
        data={"posture": posture, "reason": reason},
    )
