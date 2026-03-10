"""
System state API endpoints.
"""

import json
import logging
import uuid
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.base import SystemStatus
from app.models.system_state import (
    BulkResetRequest,
    BulkResetResult,
    SystemState,
    SystemStateCreate,
    SystemStateUpdate,
)
from app.utils import safe_json_loads

logger = logging.getLogger(__name__)

router = APIRouter()


# Status-percentage threshold mappings (default, used when no custom thresholds)
# Note: destroyed is only at 0%, critical extends down to 1%
STATUS_THRESHOLDS = {
    SystemStatus.OPTIMAL: (100, 100),
    SystemStatus.OPERATIONAL: (80, 99),
    SystemStatus.DEGRADED: (60, 79),
    SystemStatus.COMPROMISED: (40, 59),
    SystemStatus.CRITICAL: (1, 39),
    SystemStatus.DESTROYED: (0, 0),
}

# Status priority order for custom threshold lookup (best to worst)
THRESHOLD_STATUS_ORDER = [
    SystemStatus.OPTIMAL,
    SystemStatus.OPERATIONAL,
    SystemStatus.DEGRADED,
    SystemStatus.COMPROMISED,
    SystemStatus.CRITICAL,
    SystemStatus.DESTROYED,
]


def calculate_status_from_percentage(percentage: float) -> SystemStatus:
    """
    Calculate status based on percentage value (default percentage-based thresholds).

    Thresholds:
    - optimal: 100%
    - operational: 80-99%
    - degraded: 60-79%
    - compromised: 40-59%
    - critical: 1-39%
    - destroyed: 0% (completely gone)
    """
    if percentage >= 100:
        return SystemStatus.OPTIMAL
    elif percentage >= 80:
        return SystemStatus.OPERATIONAL
    elif percentage >= 60:
        return SystemStatus.DEGRADED
    elif percentage >= 40:
        return SystemStatus.COMPROMISED
    elif percentage > 0:
        return SystemStatus.CRITICAL
    else:
        return SystemStatus.DESTROYED


def calculate_status_from_value(
    value: float,
    max_value: float,
    custom_thresholds: dict[str, int] | None = None,
) -> SystemStatus:
    """
    Calculate status based on value, using custom thresholds if provided.

    If custom_thresholds is set, checks value >= threshold in priority order.
    Otherwise, falls back to percentage-based calculation.
    """
    if custom_thresholds:
        # Check statuses in order from best to worst
        for status in THRESHOLD_STATUS_ORDER:
            if status.value in custom_thresholds:
                if value >= custom_thresholds[status.value]:
                    return status
        # If no threshold matched, return destroyed
        return SystemStatus.DESTROYED
    else:
        # Use percentage-based calculation
        percentage = (value / max_value) * 100 if max_value > 0 else 0
        return calculate_status_from_percentage(percentage)


def calculate_value_from_status(
    status: SystemStatus,
    max_value: float,
    custom_thresholds: dict[str, int] | None = None,
) -> float:
    """
    Calculate value based on status.

    If custom_thresholds is set and the status is defined, returns that threshold value.
    Otherwise, uses percentage-based calculation (top of the status band).
    """
    if status == SystemStatus.OFFLINE:
        # Offline is a special state, set to 0
        return 0.0

    if custom_thresholds and status.value in custom_thresholds:
        # Return the exact threshold value for this status
        return float(custom_thresholds[status.value])

    # Fall back to percentage-based calculation
    if status == SystemStatus.OPTIMAL:
        return max_value

    threshold_range = STATUS_THRESHOLDS.get(status)
    if not threshold_range:
        # Default to operational if unknown status
        return max_value

    # Use max of the percentage range (top of the band)
    _, max_pct = threshold_range

    # Convert percentage to absolute value
    return (max_pct / 100) * max_value


# Status ordering for cascade computation (worst to best)
STATUS_ORDER = [
    SystemStatus.DESTROYED,
    SystemStatus.CRITICAL,
    SystemStatus.COMPROMISED,
    SystemStatus.DEGRADED,
    SystemStatus.OFFLINE,
    SystemStatus.OPERATIONAL,
    SystemStatus.OPTIMAL,
]


def compute_effective_status(
    system_id: str,
    all_systems: dict[str, dict],
    cache: dict[str, SystemStatus] = None,
) -> SystemStatus:
    """
    Compute effective status for a system based on its dependencies.

    A system's effective status is capped by its parent systems' effective statuses.
    If a parent is DEGRADED, the child can't be better than DEGRADED.
    """
    if cache is None:
        cache = {}

    if system_id in cache:
        return cache[system_id]

    if system_id not in all_systems:
        return SystemStatus.OPERATIONAL

    system = all_systems[system_id]
    own_status = SystemStatus(system["status"])

    # Parse depends_on (might be JSON string or already a list)
    depends_on = system.get("depends_on", [])
    if isinstance(depends_on, str):
        depends_on = safe_json_loads(depends_on, default=[], field_name="depends_on")

    if not depends_on:
        cache[system_id] = own_status
        return own_status

    # Find worst parent effective status
    worst_parent = SystemStatus.OPTIMAL
    for parent_id in depends_on:
        if parent_id in all_systems:
            parent_effective = compute_effective_status(parent_id, all_systems, cache)
            if STATUS_ORDER.index(parent_effective) < STATUS_ORDER.index(worst_parent):
                worst_parent = parent_effective

    # Return the worse of own status vs parent cap
    if STATUS_ORDER.index(own_status) < STATUS_ORDER.index(worst_parent):
        result = own_status  # Own status is already worse
    else:
        result = worst_parent  # Capped by parent

    cache[system_id] = result
    return result


def enrich_system_with_effective_status(system: dict, all_systems: dict[str, dict]) -> dict:
    """Add effective_status, limiting_parent, and parse JSON fields for a system."""
    result = dict(system)

    # Parse depends_on from JSON string if needed
    depends_on = result.get("depends_on", "[]")
    if isinstance(depends_on, str):
        result["depends_on"] = safe_json_loads(depends_on, default=[], field_name="depends_on")

    # Parse status_thresholds from JSON string if needed
    status_thresholds = result.get("status_thresholds")
    if isinstance(status_thresholds, str):
        result["status_thresholds"] = safe_json_loads(status_thresholds, default=None, field_name="status_thresholds")

    # Compute effective status
    own_status = SystemStatus(result["status"])
    effective = compute_effective_status(result["id"], all_systems)
    result["effective_status"] = effective.value

    # If effective status is worse than own status, find the limiting parent
    if STATUS_ORDER.index(effective) < STATUS_ORDER.index(own_status):
        capping_parent = find_capping_parent(result["id"], all_systems)
        if capping_parent:
            result["limiting_parent"] = capping_parent
    else:
        result["limiting_parent"] = None

    return result


def find_capping_parent(
    system_id: str,
    all_systems: dict[str, dict],
) -> dict | None:
    """
    Find the parent system that is capping this system's status.
    Returns info about the worst parent causing the cap.
    """
    system = all_systems.get(system_id)
    if not system:
        return None

    depends_on = system.get("depends_on", [])
    if isinstance(depends_on, str):
        depends_on = safe_json_loads(depends_on, default=[], field_name="depends_on")

    if not depends_on:
        return None

    worst_parent = None
    worst_idx = len(STATUS_ORDER)  # Start with best possible

    for parent_id in depends_on:
        if parent_id in all_systems:
            parent = all_systems[parent_id]
            parent_effective = compute_effective_status(parent_id, all_systems)
            idx = STATUS_ORDER.index(parent_effective)
            if idx < worst_idx:
                worst_idx = idx
                worst_parent = {
                    "id": parent_id,
                    "name": parent["name"],
                    "effective_status": parent_effective.value,
                }

    return worst_parent


async def emit_cascade_events(
    changed_system_id: str,
    ship_id: str,
    all_systems: dict[str, dict],
    db: aiosqlite.Connection,
) -> list[str]:
    """
    Emit events for child systems affected by a parent status change.
    Returns list of event IDs created.
    """
    now = datetime.now(UTC).isoformat()
    event_ids = []

    # Check each system to see if it's now capped due to the change
    for sys_id, system in all_systems.items():
        if sys_id == changed_system_id:
            continue

        # Parse depends_on
        depends_on = system.get("depends_on", [])
        if isinstance(depends_on, str):
            depends_on = safe_json_loads(depends_on, default=[], field_name="depends_on")

        if not depends_on:
            continue

        # Calculate effective status
        own_status = SystemStatus(system["status"])
        effective_status = compute_effective_status(sys_id, all_systems)

        # Only emit if effective_status is worse than own_status (i.e., capped by parent)
        if STATUS_ORDER.index(effective_status) < STATUS_ORDER.index(own_status):
            # Find the parent causing the cap
            capping_parent = find_capping_parent(sys_id, all_systems)
            if not capping_parent:
                continue

            severity = "critical" if effective_status in [SystemStatus.CRITICAL, SystemStatus.DESTROYED] else "warning"
            event_id = str(uuid.uuid4())

            await db.execute(
                """
                INSERT INTO events (id, ship_id, type, severity, message, data, transmitted, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    ship_id,
                    "cascade_failure",
                    severity,
                    f"{system['name']} {effective_status.value} due to {capping_parent['name']} failure",
                    json.dumps(
                        {
                            "system_id": sys_id,
                            "system_name": system["name"],
                            "own_status": own_status.value,
                            "effective_status": effective_status.value,
                            "cascade_reason": capping_parent,
                        }
                    ),
                    1,  # transmitted = true
                    now,
                ),
            )
            event_ids.append(event_id)

    if event_ids:
        await db.commit()

    return event_ids


@router.get("", response_model=list[SystemState])
async def list_system_states(
    ship_id: str | None = Query(None),
    category: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List system states, optionally filtered."""
    query = "SELECT * FROM system_states WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if category:
        query += " AND category = ?"
        params.append(category)

    query += " ORDER BY category, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    # Build lookup dict for cascade computation
    all_systems = {row["id"]: dict(row) for row in rows}

    # Enrich each system with effective_status
    return [enrich_system_with_effective_status(dict(row), all_systems) for row in rows]


@router.get("/{state_id}", response_model=SystemState)
async def get_system_state(state_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a system state by ID."""
    cursor = await db.execute("SELECT * FROM system_states WHERE id = ?", (state_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="System state not found")

    system = dict(row)

    # Fetch all systems from same ship for cascade computation
    cursor = await db.execute("SELECT * FROM system_states WHERE ship_id = ?", (system["ship_id"],))
    all_rows = await cursor.fetchall()
    all_systems = {r["id"]: dict(r) for r in all_rows}

    return enrich_system_with_effective_status(system, all_systems)


@router.post("", response_model=SystemState)
async def create_system_state(state: SystemStateCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new system state."""
    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        INSERT INTO system_states (
            id,
            ship_id,
            name,
            status,
            value,
            max_value,
            unit,
            category,
            depends_on,
            status_thresholds,
            created_at,
            updated_at
            )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            state.id,
            state.ship_id,
            state.name,
            state.status.value,
            state.value,
            state.max_value,
            state.unit,
            state.category,
            json.dumps(state.depends_on),
            json.dumps(state.status_thresholds) if state.status_thresholds else None,
            now,
            now,
        ),
    )
    await db.commit()

    # Fetch all systems for cascade computation
    cursor = await db.execute("SELECT * FROM system_states WHERE ship_id = ?", (state.ship_id,))
    all_rows = await cursor.fetchall()
    all_systems = {r["id"]: dict(r) for r in all_rows}

    return enrich_system_with_effective_status(all_systems[state.id], all_systems)


@router.patch("/{state_id}", response_model=SystemState)
async def update_system_state(
    state_id: str,
    state: SystemStateUpdate,
    emit_event: bool = Query(True),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Update a system state with bidirectional status-percentage relationship.

    - If only status is updated: value is automatically set to the midpoint of that status range
    - If only value is updated: status is automatically calculated based on percentage thresholds
    - If both are updated: both values are used as-is (manual override)
    """
    cursor = await db.execute("SELECT * FROM system_states WHERE id = ?", (state_id,))
    current = await cursor.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="System state not found")

    current_dict = dict(current)
    update_data = state.model_dump(exclude_unset=True)

    # Implement bidirectional status-value relationship
    status_updated = "status" in update_data
    value_updated = "value" in update_data
    max_value = update_data.get("max_value", current_dict["max_value"])

    # Get custom thresholds (from update or current, parse if JSON string)
    custom_thresholds = update_data.get("status_thresholds")
    if custom_thresholds is None:
        current_thresholds = current_dict.get("status_thresholds")
        if isinstance(current_thresholds, str):
            custom_thresholds = safe_json_loads(current_thresholds, default=None, field_name="status_thresholds")
        else:
            custom_thresholds = current_thresholds

    logger.debug(
        "PATCH system_states/%s: status_updated=%s, value_updated=%s, has_custom_thresholds=%s",
        state_id,
        status_updated,
        value_updated,
        custom_thresholds is not None,
    )

    if status_updated and not value_updated:
        # Status changed -> calculate value from status
        new_status = update_data["status"]
        new_value = calculate_value_from_status(new_status, max_value, custom_thresholds)
        logger.debug("Status-only update: status=%s, calculated value=%s", new_status, new_value)
        update_data["value"] = new_value
    elif value_updated and not status_updated:
        # Value changed -> calculate status from value (using custom thresholds if set)
        new_value = update_data["value"]
        new_status = calculate_status_from_value(new_value, max_value, custom_thresholds)
        logger.debug(
            "Value-only update: value=%s, calculated status=%s",
            new_value,
            new_status,
        )
        update_data["status"] = new_status
    # If both updated, use both as-is (manual override)

    # Build update query
    updates = []
    values = []
    changes = {}

    for field, value in update_data.items():
        if field == "status" and value:
            value = value.value
        elif field == "depends_on" and value is not None:
            value = json.dumps(value)
        elif field == "status_thresholds":
            # Serialize to JSON for storage, or NULL if None
            value = json.dumps(value) if value is not None else None
        if current_dict.get(field) != value:
            changes[field] = {"from": current_dict.get(field), "to": value}
        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.now(UTC).isoformat())
        values.append(state_id)
        await db.execute(
            f"UPDATE system_states SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

        # Emit status change event
        if emit_event and "status" in changes:
            event_id = str(uuid.uuid4())
            now = datetime.now(UTC).isoformat()
            severity = "critical" if changes["status"]["to"] in ["critical", "destroyed"] else "warning"
            await db.execute(
                """
                INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    current_dict["ship_id"],
                    "status_change",
                    severity,
                    f"{current_dict['name']} status: {changes['status']['to']}",
                    json.dumps({"system_id": state_id, "changes": changes}),
                    now,
                ),
            )
            await db.commit()

            # Emit cascade failure events for affected child systems
            # Need to fetch all systems first for cascade computation
            cursor = await db.execute("SELECT * FROM system_states WHERE ship_id = ?", (current_dict["ship_id"],))
            all_rows = await cursor.fetchall()
            all_systems_for_cascade = {r["id"]: dict(r) for r in all_rows}
            await emit_cascade_events(state_id, current_dict["ship_id"], all_systems_for_cascade, db)

    # Fetch all systems for cascade computation
    cursor = await db.execute("SELECT * FROM system_states WHERE ship_id = ?", (current_dict["ship_id"],))
    all_rows = await cursor.fetchall()
    all_systems = {r["id"]: dict(r) for r in all_rows}

    return enrich_system_with_effective_status(all_systems[state_id], all_systems)


@router.delete("/{state_id}")
async def delete_system_state(state_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a system state."""
    cursor = await db.execute("SELECT * FROM system_states WHERE id = ?", (state_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="System state not found")

    await db.execute("DELETE FROM system_states WHERE id = ?", (state_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/bulk-reset", response_model=BulkResetResult)
async def bulk_reset_systems(
    request: BulkResetRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Reset multiple systems at once.

    - If reset_all is True, resets all systems for the ship
    - Otherwise, resets only the systems specified in the systems list
    - Each system can have a custom target_status or target_value
    - If neither is specified, defaults to "operational" status
    """
    errors: list[str] = []
    systems_reset = 0
    now = datetime.now(UTC).isoformat()

    # Determine which systems to reset
    # Build a lookup of specs from the request (if provided)
    provided_specs = {spec.system_id: spec for spec in request.systems}

    if request.reset_all:
        cursor = await db.execute(
            "SELECT id, name, max_value, status_thresholds FROM system_states WHERE ship_id = ?",
            (request.ship_id,),
        )
        systems_to_reset = await cursor.fetchall()
        # Use provided specs if available, otherwise None (will use defaults)
        system_specs = {row["id"]: provided_specs.get(row["id"]) for row in systems_to_reset}
    else:
        system_specs = provided_specs

    # Reset each system
    for system_id, spec in system_specs.items():
        try:
            # Get current system info
            cursor = await db.execute(
                "SELECT id, name, max_value, status_thresholds FROM system_states WHERE id = ?",
                (system_id,),
            )
            row = await cursor.fetchone()
            if not row:
                errors.append(f"System not found: {system_id}")
                continue

            max_value = row["max_value"]

            # Parse custom thresholds if present
            custom_thresholds = row["status_thresholds"]
            if isinstance(custom_thresholds, str):
                custom_thresholds = safe_json_loads(custom_thresholds, default=None, field_name="status_thresholds")

            # Determine target status and value
            if spec and spec.target_value is not None:
                # Use specified value, calculate status
                new_value = spec.target_value
                new_status = calculate_status_from_value(new_value, max_value, custom_thresholds)
            elif spec and spec.target_status:
                # Use specified status, calculate value
                try:
                    new_status = SystemStatus(spec.target_status)
                    new_value = calculate_value_from_status(new_status, max_value, custom_thresholds)
                except ValueError:
                    errors.append(f"Invalid status for {system_id}: {spec.target_status}")
                    continue
            else:
                # Default: operational status
                new_status = SystemStatus.OPERATIONAL
                new_value = calculate_value_from_status(new_status, max_value, custom_thresholds)

            logger.debug("Bulk reset %s: status=%s, value=%s", system_id, new_status.value, new_value)
            await db.execute(
                "UPDATE system_states SET status = ?, value = ?, updated_at = ? WHERE id = ?",
                (new_status.value, new_value, now, system_id),
            )
            systems_reset += 1

        except Exception as e:
            errors.append(f"Error resetting {system_id}: {str(e)}")

    await db.commit()

    # Emit "all clear" event if requested
    event_id = None
    if request.emit_event and systems_reset > 0:
        event_id = str(uuid.uuid4())
        await db.execute(
            """
            INSERT INTO events (id, ship_id, type, severity, message, data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                request.ship_id,
                "all_clear",
                "info",
                f"Systems reset: {systems_reset} systems restored",
                json.dumps({"systems_reset": systems_reset, "reset_all": request.reset_all}),
                now,
            ),
        )
        await db.commit()

    return BulkResetResult(
        systems_reset=systems_reset,
        event_id=event_id,
        errors=errors,
    )
