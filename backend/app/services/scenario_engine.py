"""
Scenario engine: runs a scenario's actions against its ship.

``run_scenario(db, scenario_id, dry_run=...)`` is the only implementation; rehearsal
is a dry run of the same code, so the preview it returns is exactly what execution
would do.

- Every target is scoped to the scenario's ship (another ship's records are "not found").
- System changes go through ``apply_system_state_update`` (custom thresholds, clamping,
  status_change/cascade_failure events) -- the same path as PATCH /system-states.
- Execution is all-or-nothing: actions run inside a savepoint and any failure rolls
  everything back and raises ``ScenarioExecutionError``. A dry run instead collects
  every problem in ``errors`` and writes nothing.
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import aiosqlite
from pydantic import ValidationError as PydanticValidationError

from app.models.scenario import (
    SCENARIO_ACTION_TYPES,
    AdjustValueAction,
    EmitEventAction,
    EventPreview,
    InitiateHailAction,
    PlayAudioAction,
    PlaySoundboardAction,
    PosturePreview,
    ScenarioExecuteResult,
    ScenarioRehearsalResult,
    SetPostureAction,
    SetStatusAction,
    SetValueAction,
    StopAudioAction,
    SystemStatePreview,
    ToggleHolomapMarkerAction,
    TogglePreview,
    ToggleSensorContactAction,
    ToggleTransmissionAction,
    scenario_action_adapter,
)
from app.services.errors import NotFoundError, ServiceError
from app.services.events import emit_event
from app.services.posture import apply_posture, posture_event_message, posture_event_severity
from app.services.system_states import EventSpec, apply_system_state_update, load_ship_systems
from app.utils import safe_json_loads

logger = logging.getLogger(__name__)


class ScenarioExecutionError(ServiceError):
    """Execution failed and was rolled back; ``errors`` lists why."""

    status_code = 422

    def __init__(self, errors: list[str], *, status_code: int | None = None):
        self.errors = errors
        super().__init__(
            "Scenario not executed (no changes were applied): " + "; ".join(errors), status_code=status_code
        )


class ActionError(Exception):
    """One action can't be applied."""


def parse_scenario(row: aiosqlite.Row | dict) -> dict:
    """Parse scenario row, converting JSON fields."""
    result = dict(row)
    result["actions"] = safe_json_loads(result["actions"], default=[], field_name="actions") or []
    return result


@dataclass
class ScenarioRun:
    """What a run did (or, on a dry run, would do)."""

    scenario: dict
    dry_run: bool
    actions_executed: int = 0
    events_emitted: list[str] = field(default_factory=list)
    audio_commands: list[dict] = field(default_factory=list)
    system_changes: list[SystemStatePreview] = field(default_factory=list)
    posture_change: PosturePreview | None = None
    events_preview: list[EventPreview] = field(default_factory=list)
    toggles_preview: list[TogglePreview] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_execute_result(self) -> ScenarioExecuteResult:
        return ScenarioExecuteResult(
            scenario_id=self.scenario["id"],
            success=not self.errors,
            actions_executed=self.actions_executed,
            events_emitted=self.events_emitted,
            errors=self.errors,
            audio_commands=self.audio_commands,
        )

    def to_rehearsal_result(self) -> ScenarioRehearsalResult:
        return ScenarioRehearsalResult(
            scenario_id=self.scenario["id"],
            scenario_name=self.scenario["name"],
            can_execute=not self.errors,
            system_changes=self.system_changes,
            posture_change=self.posture_change,
            events_preview=self.events_preview,
            toggles_preview=self.toggles_preview,
            errors=self.errors,
            warnings=self.warnings,
        )


def describe_invalid_action(raw: Any, exc: PydanticValidationError) -> str:
    """A GM-readable reason a stored action doesn't validate."""
    action_type = raw.get("type") if isinstance(raw, dict) else None
    if action_type not in SCENARIO_ACTION_TYPES:
        return f"Unknown action type: {action_type}"
    value = raw.get("value")
    bad_fields = {err["loc"][1] if len(err["loc"]) > 1 else err["loc"][0] for err in exc.errors()}
    if action_type == "set_status" and "value" in bad_fields:
        return f"Invalid status value: {value}"
    if action_type == "set_posture" and "value" in bad_fields:
        return f"Invalid posture: {value}"
    details = "; ".join(f"{'.'.join(str(p) for p in err['loc'][1:])}: {err['msg']}" for err in exc.errors())
    return f"Invalid {action_type} action: {details}"


def _toggle(before: bool, value: bool | None) -> bool:
    return not before if value is None else bool(value)


class _Runner:
    def __init__(self, db: aiosqlite.Connection, run: ScenarioRun, systems: dict[str, dict]):
        self.db = db
        self.run = run
        self.ship_id = run.scenario["ship_id"]
        self.dry_run = run.dry_run
        self.systems = systems  # this ship's systems, updated as actions apply
        self.now = datetime.now(UTC).isoformat()

    async def _one(self, sql: str, *params: Any) -> aiosqlite.Row | None:
        cursor = await self.db.execute(sql, params)
        return await cursor.fetchone()

    async def _write(self, sql: str, *params: Any) -> None:
        if not self.dry_run:
            await self.db.execute(sql, params)

    def _record_events(self, specs: list[EventSpec]) -> None:
        self.run.events_preview.extend(EventPreview(type=s.type, severity=s.severity, message=s.message) for s in specs)

    async def apply(self, action: Any) -> None:
        handler = getattr(self, f"_{action.type}")
        await handler(action)

    # -- systems -------------------------------------------------------------

    async def _change_system(self, target: str, update: dict) -> None:
        if target not in self.systems:
            raise ActionError(f"System not found: {target}")
        before = dict(self.systems[target])
        try:
            change = await apply_system_state_update(
                self.db, target, update, ship_id=self.ship_id, dry_run=self.dry_run, systems=self.systems
            )
        except ServiceError as e:
            raise ActionError(f"{before['name']}: {e.detail}") from e
        self.run.system_changes.append(
            SystemStatePreview(
                system_id=target,
                system_name=before["name"],
                before_status=before["status"],
                before_value=before["value"],
                after_status=change.after["status"],
                after_value=change.after["value"],
                max_value=change.after["max_value"],
            )
        )
        self._record_events(change.events)
        self.run.events_emitted.extend(change.event_ids)

    async def _set_status(self, action: SetStatusAction) -> None:
        await self._change_system(action.target, {"status": action.value})

    async def _set_value(self, action: SetValueAction) -> None:
        await self._change_system(action.target, {"value": action.value})

    async def _adjust_value(self, action: AdjustValueAction) -> None:
        current = self.systems.get(action.target)
        if current is None:
            raise ActionError(f"System not found: {action.target}")
        await self._change_system(action.target, {"value": current["value"] + action.value})

    # -- ship ----------------------------------------------------------------

    async def _set_posture(self, action: SetPostureAction) -> bool:
        row = await self._one("SELECT posture FROM posture_state WHERE ship_id = ?", self.ship_id)
        if not row:
            self.run.warnings.append("No posture state found for ship")
            return False
        posture = action.value.value
        self.run.posture_change = PosturePreview(before_posture=row["posture"], after_posture=posture)
        self.run.events_preview.append(
            EventPreview(
                type="posture_change", severity=posture_event_severity(posture), message=posture_event_message(posture)
            )
        )
        if not self.dry_run:
            event_id = await apply_posture(
                self.db, self.ship_id, action.value, set_by="scenario", reason=f"Scenario: {self.run.scenario['name']}"
            )
            self.run.events_emitted.append(event_id)
        return True

    async def _emit_event(self, action: EmitEventAction) -> None:
        data = action.data
        spec = EventSpec(
            type=data.get("type", "scenario_event"),
            severity=data.get("severity", "info"),
            message=data.get("message", f"Scenario: {self.run.scenario['name']}"),
            data=data,
        )
        self._record_events([spec])
        if not self.dry_run:
            self.run.events_emitted.append(
                await emit_event(self.db, self.ship_id, spec.type, spec.message, severity=spec.severity, data=data)
            )

    async def _initiate_hail(self, action: InitiateHailAction) -> None:
        row = await self._one("SELECT hail_active FROM posture_state WHERE ship_id = ?", self.ship_id)
        if not row:
            raise ActionError("No posture state found for ship")
        before = bool(row["hail_active"])
        after = _toggle(before, action.value)
        self.run.toggles_preview.append(
            TogglePreview(
                target_type="hail",
                target_id=self.ship_id,
                target_name="Incoming Hail",
                before_visible=before,
                after_visible=after,
            )
        )
        await self._write(
            "UPDATE posture_state SET hail_active = ?, updated_at = ? WHERE ship_id = ?",
            1 if after else 0,
            self.now,
            self.ship_id,
        )

    # -- visibility toggles --------------------------------------------------

    async def _toggle_transmission(self, action: ToggleTransmissionAction) -> None:
        row = await self._one(
            "SELECT message, transmitted FROM events WHERE id = ? AND ship_id = ?", action.target, self.ship_id
        )
        if not row:
            raise ActionError(f"Transmission not found: {action.target}")
        before = bool(row["transmitted"])
        after = _toggle(before, action.value)
        self.run.toggles_preview.append(
            TogglePreview(
                target_type="transmission",
                target_id=action.target,
                target_name=row["message"] or action.target,
                before_visible=before,
                after_visible=after,
            )
        )
        await self._write("UPDATE events SET transmitted = ? WHERE id = ?", 1 if after else 0, action.target)

    async def _toggle_holomap_marker(self, action: ToggleHolomapMarkerAction) -> None:
        row = await self._one(
            """
            SELECT m.label, m.visible FROM holomap_markers m
            JOIN holomap_layers l ON m.layer_id = l.id
            WHERE m.id = ? AND l.ship_id = ?
            """,
            action.target,
            self.ship_id,
        )
        if not row:
            raise ActionError(f"Holomap marker not found: {action.target}")
        before = bool(row["visible"])
        after = _toggle(before, action.value)
        self.run.toggles_preview.append(
            TogglePreview(
                target_type="holomap_marker",
                target_id=action.target,
                target_name=row["label"] or action.target,
                before_visible=before,
                after_visible=after,
            )
        )
        await self._write(
            "UPDATE holomap_markers SET visible = ?, updated_at = ? WHERE id = ?",
            1 if after else 0,
            self.now,
            action.target,
        )

    async def _toggle_sensor_contact(self, action: ToggleSensorContactAction) -> None:
        row = await self._one(
            "SELECT label, visible FROM sensor_contacts WHERE id = ? AND ship_id = ?", action.target, self.ship_id
        )
        if not row:
            raise ActionError(f"Sensor contact not found: {action.target}")
        before = bool(row["visible"])
        after = _toggle(before, action.value)
        self.run.toggles_preview.append(
            TogglePreview(
                target_type="sensor_contact",
                target_id=action.target,
                target_name=row["label"] or action.target,
                before_visible=before,
                after_visible=after,
            )
        )
        await self._write(
            "UPDATE sensor_contacts SET visible = ?, last_updated_at = ? WHERE id = ?",
            1 if after else 0,
            self.now,
            action.target,
        )

    # -- audio (commands for the GM's browser; no DB changes) ----------------

    async def _play_audio(self, action: PlayAudioAction) -> None:
        if not action.target:
            raise ActionError("play_audio has no audio file selected")
        self.run.audio_commands.append(
            {
                "command": "play",
                "audio_url": action.target,
                "loop": bool(action.data.get("loop", False)),
                "name": action.target.split("/")[-1],
            }
        )

    async def _play_soundboard(self, action: PlaySoundboardAction) -> None:
        row = await self._one(
            """
            SELECT wi.config FROM widget_instances wi
            JOIN panels p ON wi.panel_id = p.id
            WHERE wi.id = ? AND p.ship_id = ?
            """,
            action.target,
            self.ship_id,
        )
        if not row:
            raise ActionError(f"Widget {action.target} not found or not owned by this ship")
        config = safe_json_loads(row["config"], default={}, field_name="config") or {}
        button = next((b for b in config.get("buttons", []) if b.get("id") == action.value), None)
        if not button:
            raise ActionError(f"Button {action.value} not found in soundboard widget")
        self.run.audio_commands.append(
            {
                "command": "play",
                "audio_url": button.get("audioUrl"),
                "loop": button.get("loop", False),
                "name": button.get("label", ""),
            }
        )

    async def _stop_audio(self, action: StopAudioAction) -> None:
        self.run.audio_commands.append({"command": "stop"})


async def load_scenario(db: aiosqlite.Connection, scenario_id: str) -> dict:
    cursor = await db.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    row = await cursor.fetchone()
    if not row:
        raise NotFoundError("Scenario not found")
    return parse_scenario(row)


async def run_scenario(db: aiosqlite.Connection, scenario_id: str, *, dry_run: bool = False) -> ScenarioRun:
    """
    Run (or with ``dry_run``, preview) a scenario.

    Execution happens inside a savepoint: on success it is released (which commits
    unless the caller already had a transaction open); on any failure everything the
    scenario did is rolled back and ``ScenarioExecutionError`` is raised (422 for an
    action that can't be applied, 500 for an unexpected error).
    """
    scenario = await load_scenario(db, scenario_id)
    run = ScenarioRun(scenario=scenario, dry_run=dry_run)
    runner = _Runner(db, run, await load_ship_systems(db, scenario["ship_id"]))

    if not dry_run:
        await db.execute("SAVEPOINT scenario_run")
    try:
        for index, raw in enumerate(scenario["actions"], start=1):
            try:
                try:
                    action = scenario_action_adapter.validate_python(raw)
                except PydanticValidationError as e:
                    raise ActionError(describe_invalid_action(raw, e)) from e
                if await runner.apply(action) is not False:
                    run.actions_executed += 1
            except ActionError as e:
                if not dry_run:
                    raise ScenarioExecutionError([f"Action {index}: {e}"]) from e
                run.errors.append(str(e))

        message = f"Scenario executed: {scenario['name']}"
        run.events_preview.append(EventPreview(type="scenario_executed", severity="info", message=message))
        if not dry_run:
            run.events_emitted.append(
                await emit_event(
                    db,
                    scenario["ship_id"],
                    "scenario_executed",
                    message,
                    data={"scenario_id": scenario_id, "actions_executed": run.actions_executed},
                )
            )
    except BaseException as e:
        if not dry_run:
            await db.execute("ROLLBACK TO scenario_run")
            await db.execute("RELEASE scenario_run")
        if isinstance(e, ScenarioExecutionError):
            raise
        if isinstance(e, Exception):
            logger.exception("Scenario %s failed", scenario_id)
            raise ScenarioExecutionError([f"Unexpected error: {e}"], status_code=500) from e
        raise

    if not dry_run:
        await db.execute("RELEASE scenario_run")
    return run


async def execute_scenario(db: aiosqlite.Connection, scenario_id: str) -> ScenarioRun:
    return await run_scenario(db, scenario_id, dry_run=False)


async def rehearse_scenario(db: aiosqlite.Connection, scenario_id: str) -> ScenarioRun:
    return await run_scenario(db, scenario_id, dry_run=True)


def dump_actions(actions: list) -> str:
    """Serialize validated actions for storage."""
    return json.dumps([a.model_dump(mode="json") if hasattr(a, "model_dump") else a for a in actions])
