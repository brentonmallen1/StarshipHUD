"""
System state API endpoints.
"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import aiosqlite

from app.database import get_db
from app.models.system_state import (
    SystemState,
    SystemStateCreate,
    SystemStateUpdate,
    BulkResetRequest,
    BulkResetResult,
)
from app.models.base import SystemStatus

router = APIRouter()


# Status-percentage threshold mappings
STATUS_THRESHOLDS = {
    SystemStatus.FULLY_OPERATIONAL: (100, 100),
    SystemStatus.OPERATIONAL: (80, 99),
    SystemStatus.DEGRADED: (60, 79),
    SystemStatus.COMPROMISED: (40, 59),
    SystemStatus.CRITICAL: (20, 39),
    SystemStatus.DESTROYED: (0, 19),
}


def calculate_status_from_percentage(percentage: float) -> SystemStatus:
    """
    Calculate status based on percentage value.

    Thresholds:
    - fully_operational: 100%
    - operational: 80-99%
    - degraded: 60-79%
    - compromised: 40-59%
    - critical: 20-39%
    - destroyed: 0-19%
    """
    if percentage >= 100:
        return SystemStatus.FULLY_OPERATIONAL
    elif percentage >= 80:
        return SystemStatus.OPERATIONAL
    elif percentage >= 60:
        return SystemStatus.DEGRADED
    elif percentage >= 40:
        return SystemStatus.COMPROMISED
    elif percentage >= 20:
        return SystemStatus.CRITICAL
    else:
        return SystemStatus.DESTROYED


def calculate_value_from_status(status: SystemStatus, max_value: float) -> float:
    """
    Calculate value based on status (uses midpoint of threshold range).

    Returns absolute value based on max_value.
    """
    if status == SystemStatus.OFFLINE:
        # Offline is a special state, set to 0
        return 0.0

    if status == SystemStatus.FULLY_OPERATIONAL:
        # Fully operational is exactly 100%
        return max_value

    threshold_range = STATUS_THRESHOLDS.get(status)
    if not threshold_range:
        # Default to operational if unknown status
        return max_value

    # Calculate midpoint of the percentage range
    min_pct, max_pct = threshold_range
    midpoint_pct = (min_pct + max_pct) / 2

    # Convert percentage to absolute value
    return (midpoint_pct / 100) * max_value


# Status ordering for cascade computation (worst to best)
STATUS_ORDER = [
    SystemStatus.DESTROYED,
    SystemStatus.CRITICAL,
    SystemStatus.COMPROMISED,
    SystemStatus.DEGRADED,
    SystemStatus.OFFLINE,
    SystemStatus.OPERATIONAL,
    SystemStatus.FULLY_OPERATIONAL,
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
        depends_on = json.loads(depends_on) if depends_on else []

    if not depends_on:
        cache[system_id] = own_status
        return own_status

    # Find worst parent effective status
    worst_parent = SystemStatus.FULLY_OPERATIONAL
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


def enrich_system_with_effective_status(
    system: dict, all_systems: dict[str, dict]
) -> dict:
    """Add effective_status and parse depends_on for a system."""
    result = dict(system)

    # Parse depends_on from JSON string if needed
    depends_on = result.get("depends_on", "[]")
    if isinstance(depends_on, str):
        result["depends_on"] = json.loads(depends_on) if depends_on else []

    # Compute effective status
    effective = compute_effective_status(result["id"], all_systems)
    result["effective_status"] = effective.value

    return result


@router.get("", response_model=list[SystemState])
async def list_system_states(
    ship_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
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
    cursor = await db.execute(
        "SELECT * FROM system_states WHERE id = ?", (state_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="System state not found")

    system = dict(row)

    # Fetch all systems from same ship for cascade computation
    cursor = await db.execute(
        "SELECT * FROM system_states WHERE ship_id = ?", (system["ship_id"],)
    )
    all_rows = await cursor.fetchall()
    all_systems = {r["id"]: dict(r) for r in all_rows}

    return enrich_system_with_effective_status(system, all_systems)


@router.post("", response_model=SystemState)
async def create_system_state(
    state: SystemStateCreate, db: aiosqlite.Connection = Depends(get_db)
):
    """Create a new system state."""
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO system_states (id, ship_id, name, status, value, max_value, unit, category, depends_on, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            now,
            now,
        ),
    )
    await db.commit()

    # Fetch all systems for cascade computation
    cursor = await db.execute(
        "SELECT * FROM system_states WHERE ship_id = ?", (state.ship_id,)
    )
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
    cursor = await db.execute(
        "SELECT * FROM system_states WHERE id = ?", (state_id,)
    )
    current = await cursor.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="System state not found")

    current_dict = dict(current)
    update_data = state.model_dump(exclude_unset=True)

    # Implement bidirectional status-percentage relationship
    status_updated = "status" in update_data
    value_updated = "value" in update_data
    max_value = update_data.get("max_value", current_dict["max_value"])

    if status_updated and not value_updated:
        # Status changed → calculate value from status
        new_status = update_data["status"]
        new_value = calculate_value_from_status(new_status, max_value)
        update_data["value"] = new_value
    elif value_updated and not status_updated:
        # Value changed → calculate status from percentage
        new_value = update_data["value"]
        percentage = (new_value / max_value) * 100 if max_value > 0 else 0
        new_status = calculate_status_from_percentage(percentage)
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
        if current_dict.get(field) != value:
            changes[field] = {"from": current_dict.get(field), "to": value}
        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(state_id)
        await db.execute(
            f"UPDATE system_states SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

        # Emit status change event
        if emit_event and "status" in changes:
            event_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
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

    # Fetch all systems for cascade computation
    cursor = await db.execute(
        "SELECT * FROM system_states WHERE ship_id = ?", (current_dict["ship_id"],)
    )
    all_rows = await cursor.fetchall()
    all_systems = {r["id"]: dict(r) for r in all_rows}

    return enrich_system_with_effective_status(all_systems[state_id], all_systems)


@router.delete("/{state_id}")
async def delete_system_state(
    state_id: str, db: aiosqlite.Connection = Depends(get_db)
):
    """Delete a system state."""
    cursor = await db.execute(
        "SELECT * FROM system_states WHERE id = ?", (state_id,)
    )
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
    now = datetime.utcnow().isoformat()

    # Determine which systems to reset
    if request.reset_all:
        cursor = await db.execute(
            "SELECT id, name, max_value FROM system_states WHERE ship_id = ?",
            (request.ship_id,),
        )
        systems_to_reset = await cursor.fetchall()
        system_specs = {row["id"]: None for row in systems_to_reset}  # No custom spec, use defaults
    else:
        system_specs = {spec.system_id: spec for spec in request.systems}

    # Reset each system
    for system_id, spec in system_specs.items():
        try:
            # Get current system info
            cursor = await db.execute(
                "SELECT id, name, max_value FROM system_states WHERE id = ?",
                (system_id,),
            )
            row = await cursor.fetchone()
            if not row:
                errors.append(f"System not found: {system_id}")
                continue

            max_value = row["max_value"]

            # Determine target status and value
            if spec and spec.target_value is not None:
                # Use specified value, calculate status
                new_value = spec.target_value
                percentage = (new_value / max_value) * 100 if max_value > 0 else 0
                new_status = calculate_status_from_percentage(percentage)
            elif spec and spec.target_status:
                # Use specified status, calculate value
                try:
                    new_status = SystemStatus(spec.target_status)
                    new_value = calculate_value_from_status(new_status, max_value)
                except ValueError:
                    errors.append(f"Invalid status for {system_id}: {spec.target_status}")
                    continue
            else:
                # Default: operational status
                new_status = SystemStatus.OPERATIONAL
                new_value = calculate_value_from_status(new_status, max_value)

            # Update the system
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
