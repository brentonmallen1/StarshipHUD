"""
System state business logic.

- Status <-> value math (default percentage bands or per-system custom thresholds)
- Effective-status cascade through ``depends_on``
- ``apply_system_state_update``: the single code path that changes a system's
  status/value. The PATCH endpoint, scenarios and task outcomes all use it so they
  agree on threshold handling, clamping and status_change/cascade_failure events.

Nothing here commits; callers own the transaction.
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import aiosqlite

from app.models.base import SystemStatus
from app.models.system_state import BulkResetRequest, BulkResetResult, validate_thresholds
from app.services.errors import NotFoundError, ServiceError, ValidationError
from app.services.events import emit_event
from app.utils import safe_json_loads

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Status <-> value math
# ---------------------------------------------------------------------------

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
        return float(custom_thresholds[status.value])

    if status == SystemStatus.OPTIMAL:
        return max_value

    threshold_range = STATUS_THRESHOLDS.get(status)
    if not threshold_range:
        return max_value

    # Use max of the percentage range (top of the band)
    _, max_pct = threshold_range
    return (max_pct / 100) * max_value


def parse_thresholds(raw: Any) -> dict[str, int] | None:
    """Stored status_thresholds may be a JSON string, a dict, or NULL."""
    if isinstance(raw, str):
        return safe_json_loads(raw, default=None, field_name="status_thresholds")
    return raw


def parse_depends_on(raw: Any) -> list[str]:
    if isinstance(raw, str):
        return safe_json_loads(raw, default=[], field_name="depends_on") or []
    return raw or []


# ---------------------------------------------------------------------------
# Effective-status cascade
# ---------------------------------------------------------------------------


def compute_effective_status(
    system_id: str,
    all_systems: dict[str, dict],
    cache: dict[str, SystemStatus] | None = None,
    _visiting: set[str] | None = None,
) -> SystemStatus:
    """
    Compute effective status for a system based on its dependencies.

    A system's effective status is capped by its parent systems' effective statuses.
    If a parent is DEGRADED, the child can't be better than DEGRADED.
    Dependency cycles (which validation rejects, but legacy data may contain) are ignored.
    """
    if cache is None:
        cache = {}
    if _visiting is None:
        _visiting = set()

    if system_id in cache:
        return cache[system_id]

    if system_id not in all_systems:
        return SystemStatus.OPERATIONAL

    system = all_systems[system_id]
    own_status = SystemStatus(system["status"])
    depends_on = parse_depends_on(system.get("depends_on", []))

    if not depends_on:
        cache[system_id] = own_status
        return own_status

    # Find worst parent effective status
    _visiting.add(system_id)
    worst_parent = SystemStatus.OPTIMAL
    for parent_id in depends_on:
        if parent_id in all_systems and parent_id not in _visiting:
            parent_effective = compute_effective_status(parent_id, all_systems, cache, _visiting)
            if STATUS_ORDER.index(parent_effective) < STATUS_ORDER.index(worst_parent):
                worst_parent = parent_effective

    # Return the worse of own status vs parent cap
    if STATUS_ORDER.index(own_status) < STATUS_ORDER.index(worst_parent):
        result = own_status
    else:
        result = worst_parent

    _visiting.discard(system_id)
    cache[system_id] = result
    return result


def find_capping_parent(system_id: str, all_systems: dict[str, dict]) -> dict | None:
    """
    Find the parent system that is capping this system's status.
    Returns info about the worst parent causing the cap.
    """
    system = all_systems.get(system_id)
    if not system:
        return None

    depends_on = parse_depends_on(system.get("depends_on", []))
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


def enrich_system_with_effective_status(system: dict, all_systems: dict[str, dict]) -> dict:
    """Add effective_status, limiting_parent, and parse JSON fields for a system."""
    result = dict(system)
    result["depends_on"] = parse_depends_on(result.get("depends_on", "[]"))
    result["status_thresholds"] = parse_thresholds(result.get("status_thresholds"))

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


async def load_ship_systems(db: aiosqlite.Connection, ship_id: str) -> dict[str, dict]:
    """All of a ship's system rows keyed by id (raw column values)."""
    cursor = await db.execute("SELECT * FROM system_states WHERE ship_id = ?", (ship_id,))
    return {r["id"]: dict(r) for r in await cursor.fetchall()}


async def validate_depends_on(
    db: aiosqlite.Connection,
    ship_id: str,
    system_id: str,
    depends_on: list[str],
) -> None:
    """Reject self-references, unknown/foreign parents, and dependency cycles."""
    if not depends_on:
        return
    if system_id in depends_on:
        raise ServiceError("A system cannot depend on itself")

    cursor = await db.execute("SELECT id, depends_on FROM system_states WHERE ship_id = ?", (ship_id,))
    graph = {row["id"]: parse_depends_on(row["depends_on"]) for row in await cursor.fetchall()}

    unknown = [pid for pid in depends_on if pid not in graph]
    if unknown:
        raise ServiceError(f"depends_on references systems not on this ship: {', '.join(unknown)}")

    # Walk upward from the proposed parents; reaching system_id means a cycle
    graph[system_id] = depends_on
    stack = list(depends_on)
    seen: set[str] = set()
    while stack:
        current = stack.pop()
        if current == system_id:
            raise ServiceError("depends_on would create a dependency cycle")
        if current in seen:
            continue
        seen.add(current)
        stack.extend(graph.get(current, []))


@dataclass
class EventSpec:
    """An event that a change produces (written, or only previewed on a dry run)."""

    type: str
    message: str
    severity: str = "info"
    data: dict[str, Any] = field(default_factory=dict)
    transmitted: bool = True


def compute_cascade_events(changed_system_id: str, all_systems: dict[str, dict]) -> list[EventSpec]:
    """cascade_failure events for every system currently capped below its own status by a parent."""
    specs: list[EventSpec] = []
    for sys_id, system in all_systems.items():
        if sys_id == changed_system_id:
            continue
        if not parse_depends_on(system.get("depends_on", [])):
            continue

        own_status = SystemStatus(system["status"])
        effective_status = compute_effective_status(sys_id, all_systems)
        if STATUS_ORDER.index(effective_status) >= STATUS_ORDER.index(own_status):
            continue

        capping_parent = find_capping_parent(sys_id, all_systems)
        if not capping_parent:
            continue

        specs.append(
            EventSpec(
                type="cascade_failure",
                severity="critical"
                if effective_status in [SystemStatus.CRITICAL, SystemStatus.DESTROYED]
                else "warning",
                message=f"{system['name']} {effective_status.value} due to {capping_parent['name']} failure",
                data={
                    "system_id": sys_id,
                    "system_name": system["name"],
                    "own_status": own_status.value,
                    "effective_status": effective_status.value,
                    "cascade_reason": capping_parent,
                },
            )
        )
    return specs


async def write_events(db: aiosqlite.Connection, ship_id: str, specs: list[EventSpec]) -> list[str]:
    return [
        await emit_event(db, ship_id, s.type, s.message, severity=s.severity, data=s.data, transmitted=s.transmitted)
        for s in specs
    ]


async def emit_cascade_events(
    changed_system_id: str,
    ship_id: str,
    all_systems: dict[str, dict],
    db: aiosqlite.Connection,
) -> list[str]:
    """Emit cascade_failure events for child systems capped by a parent; returns event ids."""
    return await write_events(db, ship_id, compute_cascade_events(changed_system_id, all_systems))


# ---------------------------------------------------------------------------
# Updates
# ---------------------------------------------------------------------------


def plan_system_state_update(current: dict, update_data: dict) -> tuple[dict, dict]:
    """
    Resolve a requested update against the current row (pure; no I/O).

    - status only: value is set from the status (custom threshold or top of band)
    - value only: status is derived from the value (custom thresholds if set)
    - both: used as-is (manual override)
    - value is clamped to [0, max_value] (status re-derived when clamped)

    Returns ``(columns, changes)``: serialized column values to write, and
    ``{field: {"from", "to"}}`` for the fields that actually change.
    """
    update_data = dict(update_data)
    if update_data.get("status") is not None:
        update_data["status"] = SystemStatus(update_data["status"])

    status_updated = "status" in update_data
    value_updated = "value" in update_data
    max_value = update_data.get("max_value", current["max_value"])

    custom_thresholds = update_data.get("status_thresholds")
    if custom_thresholds is None:
        custom_thresholds = parse_thresholds(current.get("status_thresholds"))

    # Thresholds may not exceed max_value; check whichever side is unchanged
    # against its stored value
    if "status_thresholds" in update_data or "max_value" in update_data:
        effective = update_data["status_thresholds"] if "status_thresholds" in update_data else custom_thresholds
        try:
            validate_thresholds(effective, max_value)
        except ValueError as e:
            raise ValidationError(str(e))

    if status_updated and not value_updated:
        update_data["value"] = calculate_value_from_status(update_data["status"], max_value, custom_thresholds)
    elif value_updated and not status_updated:
        update_data["status"] = calculate_status_from_value(update_data["value"], max_value, custom_thresholds)

    final_value = update_data.get("value", current["value"])
    if final_value > max_value or final_value < 0:
        clamped_value = max(0, min(final_value, max_value))
        update_data["value"] = clamped_value
        update_data["status"] = calculate_status_from_value(clamped_value, max_value, custom_thresholds)
        logger.debug("Clamped value %s -> %s (%s)", final_value, clamped_value, update_data["status"])

    columns: dict[str, Any] = {}
    changes: dict[str, dict] = {}
    for column, value in update_data.items():
        if column == "status" and value:
            value = value.value
        elif column == "depends_on" and value is not None:
            value = json.dumps(value)
        elif column == "status_thresholds":
            value = json.dumps(value) if value is not None else None
        if current.get(column) != value:
            changes[column] = {"from": current.get(column), "to": value}
        columns[column] = value
    return columns, changes


@dataclass
class SystemStateChange:
    """Outcome of ``apply_system_state_update``."""

    system_id: str
    ship_id: str
    before: dict
    after: dict
    changes: dict
    events: list[EventSpec] = field(default_factory=list)
    event_ids: list[str] = field(default_factory=list)


async def apply_system_state_update(
    db: aiosqlite.Connection,
    system_id: str,
    update_data: dict,
    *,
    ship_id: str | None = None,
    emit_events: bool = True,
    dry_run: bool = False,
    systems: dict[str, dict] | None = None,
) -> SystemStateChange:
    """
    Change a system state, emitting status_change + cascade_failure events when its status changes.

    ``ship_id`` scopes the lookup (a system on another ship is "not found").
    ``systems`` is an optional snapshot of the ship's rows to read instead of the DB;
    it is updated in place, which lets a dry run chain several changes.
    ``dry_run`` computes everything (including the events) but writes nothing.
    """
    if systems is not None and system_id in systems:
        current = systems[system_id]
    else:
        cursor = await db.execute("SELECT * FROM system_states WHERE id = ?", (system_id,))
        row = await cursor.fetchone()
        current = dict(row) if row else None
    if current is None or (ship_id is not None and current["ship_id"] != ship_id):
        raise NotFoundError("System state not found")
    ship_id = current["ship_id"]

    if update_data.get("depends_on"):
        await validate_depends_on(db, ship_id, system_id, update_data["depends_on"])

    columns, changes = plan_system_state_update(current, update_data)
    after = {**current, **columns}

    if systems is None:
        systems = await load_ship_systems(db, ship_id)
    if not dry_run and columns:
        columns["updated_at"] = datetime.now(UTC).isoformat()
        await db.execute(
            f"UPDATE system_states SET {', '.join(f'{c} = ?' for c in columns)} WHERE id = ?",
            [*columns.values(), system_id],
        )
        after["updated_at"] = columns["updated_at"]
    systems[system_id] = after

    result = SystemStateChange(system_id=system_id, ship_id=ship_id, before=current, after=after, changes=changes)
    if emit_events and "status" in changes:
        to_status = changes["status"]["to"]
        result.events.append(
            EventSpec(
                type="status_change",
                severity="critical" if to_status in ["critical", "destroyed"] else "warning",
                message=f"{current['name']} status: {to_status}",
                data={"system_id": system_id, "changes": changes},
            )
        )
        result.events.extend(compute_cascade_events(system_id, systems))
        if not dry_run:
            result.event_ids = await write_events(db, ship_id, result.events)
    return result


async def bulk_reset_systems(db: aiosqlite.Connection, request: BulkResetRequest) -> BulkResetResult:
    """
    Reset multiple systems at once (see the endpoint docstring).

    Per-system problems are collected in ``errors``; the rest still reset.
    """
    errors: list[str] = []
    systems_reset = 0
    now = datetime.now(UTC).isoformat()

    provided_specs = {spec.system_id: spec for spec in request.systems}
    if request.reset_all:
        cursor = await db.execute("SELECT id FROM system_states WHERE ship_id = ?", (request.ship_id,))
        system_specs = {row["id"]: provided_specs.get(row["id"]) for row in await cursor.fetchall()}
    else:
        system_specs = provided_specs

    for system_id, spec in system_specs.items():
        try:
            cursor = await db.execute(
                "SELECT id, name, max_value, status_thresholds FROM system_states WHERE id = ? AND ship_id = ?",
                (system_id, request.ship_id),
            )
            row = await cursor.fetchone()
            if not row:
                errors.append(f"System not found: {system_id}")
                continue

            max_value = row["max_value"]
            custom_thresholds = parse_thresholds(row["status_thresholds"])

            if spec and spec.target_value is not None:
                new_value = spec.target_value
                new_status = calculate_status_from_value(new_value, max_value, custom_thresholds)
            elif spec and spec.target_status:
                try:
                    new_status = SystemStatus(spec.target_status)
                    new_value = calculate_value_from_status(new_status, max_value, custom_thresholds)
                except ValueError:
                    errors.append(f"Invalid status for {system_id}: {spec.target_status}")
                    continue
            else:
                new_status = SystemStatus.OPERATIONAL
                new_value = calculate_value_from_status(new_status, max_value, custom_thresholds)

            if new_value > max_value:
                errors.append(f"value ({new_value}) exceeds max_value ({max_value}) for {system_id}")
                continue

            await db.execute(
                "UPDATE system_states SET status = ?, value = ?, updated_at = ? WHERE id = ?",
                (new_status.value, new_value, now, system_id),
            )
            systems_reset += 1
        except Exception as e:
            errors.append(f"Error resetting {system_id}: {str(e)}")

    event_id = None
    if request.emit_event and systems_reset > 0:
        event_id = await emit_event(
            db,
            request.ship_id,
            "all_clear",
            f"Systems reset: {systems_reset} systems restored",
            data={"systems_reset": systems_reset, "reset_all": request.reset_all},
        )

    return BulkResetResult(systems_reset=systems_reset, event_id=event_id, errors=errors)
