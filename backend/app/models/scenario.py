"""
Scenario models.
"""

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator

from .base import BaseSchema, EventSeverity, Posture, SystemStatus, UpdateSchema

# ---------------------------------------------------------------------------
# Scenario actions
#
# Every action keeps the stored/wire shape {type, target, value, data} that the
# admin ActionRow editor reads and writes; the union pins down which of those
# fields each type uses and what they may hold. Targets are plain strings
# (possibly empty while the GM is still picking one): whether they exist on the
# scenario's ship is checked when the scenario runs, not when it's saved.
# ---------------------------------------------------------------------------


class _Action(BaseModel):
    target: str | None = None
    value: Any = None
    data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("data", mode="before")
    @classmethod
    def _null_data(cls, v: Any) -> Any:
        return {} if v is None else v


class SetStatusAction(_Action):
    """Set a system's status; its value follows (custom threshold or top of band)."""

    type: Literal["set_status"]
    target: str
    value: SystemStatus


class SetValueAction(_Action):
    """Set a system's value; its status follows (custom thresholds if set)."""

    type: Literal["set_value"]
    target: str
    value: float


class AdjustValueAction(_Action):
    """Add ``value`` (may be negative) to a system's value, clamped to [0, max]."""

    type: Literal["adjust_value"]
    target: str
    value: float


class SetPostureAction(_Action):
    type: Literal["set_posture"]
    value: Posture


class EmitEventAction(_Action):
    """Emit an event; ``data`` carries its type/severity/message (and is stored as the event data)."""

    type: Literal["emit_event"]

    @field_validator("data")
    @classmethod
    def _valid_severity(cls, v: dict[str, Any]) -> dict[str, Any]:
        if "severity" in v:
            EventSeverity(v["severity"])
        return v


class InitiateHailAction(_Action):
    """Set the hail indicator: true/false, or toggle when value is omitted."""

    type: Literal["initiate_hail"]
    value: bool | None = None


class ToggleTransmissionAction(_Action):
    """Show/hide an event (transmission) to players; toggle when value is omitted."""

    type: Literal["toggle_transmission"]
    value: bool | None = None


class ToggleHolomapMarkerAction(_Action):
    type: Literal["toggle_holomap_marker"]
    value: bool | None = None


class ToggleSensorContactAction(_Action):
    type: Literal["toggle_sensor_contact"]
    value: bool | None = None


class PlayAudioAction(_Action):
    """Play an uploaded audio file (target = URL; data.loop)."""

    type: Literal["play_audio"]


class PlaySoundboardAction(_Action):
    """Play a soundboard button (target = widget instance id, value = button id)."""

    type: Literal["play_soundboard"]
    value: str | None = None


class StopAudioAction(_Action):
    type: Literal["stop_audio"]


ScenarioAction = Annotated[
    SetStatusAction
    | SetValueAction
    | AdjustValueAction
    | SetPostureAction
    | EmitEventAction
    | InitiateHailAction
    | ToggleTransmissionAction
    | ToggleHolomapMarkerAction
    | ToggleSensorContactAction
    | PlayAudioAction
    | PlaySoundboardAction
    | StopAudioAction,
    Field(discriminator="type"),
]
SCENARIO_ACTION_TYPES: tuple[str, ...] = (
    "set_status",
    "set_value",
    "adjust_value",
    "set_posture",
    "emit_event",
    "initiate_hail",
    "toggle_transmission",
    "toggle_holomap_marker",
    "toggle_sensor_contact",
    "play_audio",
    "play_soundboard",
    "stop_audio",
)
scenario_action_adapter: TypeAdapter = TypeAdapter(ScenarioAction)


class UnrecognizedScenarioAction(BaseModel):
    """
    A stored action that no longer validates (unknown type, bad value) -- e.g. saved
    before actions were typed. Returned as-is so the scenario still loads and the GM
    can fix it; running the scenario reports it as an error.
    """

    model_config = ConfigDict(extra="allow")

    type: Any = None
    target: Any = None
    value: Any = None
    data: Any = Field(default_factory=dict)


StoredScenarioAction = Annotated[
    ScenarioAction | UnrecognizedScenarioAction,
    Field(union_mode="left_to_right"),
]


class ScenarioBase(BaseModel):
    """Base scenario fields."""

    name: str = Field(min_length=1)
    description: str | None = None
    actions: list[ScenarioAction] = Field(default_factory=list)


class ScenarioCreate(ScenarioBase):
    """Schema for creating a scenario."""

    ship_id: str


class ScenarioUpdate(UpdateSchema, table="scenarios"):
    """Schema for updating a scenario."""

    name: str | None = None
    description: str | None = None
    actions: list[ScenarioAction] | None = None


class Scenario(ScenarioBase, BaseSchema):
    """Full scenario schema."""

    id: str
    ship_id: str
    position: int = 0
    created_at: datetime
    updated_at: datetime
    actions: list[StoredScenarioAction] = Field(default_factory=list)


class AudioCommand(BaseModel):
    """Audio playback command for frontend."""

    command: Literal["play", "stop"]
    audio_url: str | None = None
    loop: bool = False
    name: str | None = None


class ScenarioExecuteResult(BaseModel):
    """Result of executing a scenario."""

    scenario_id: str
    success: bool
    actions_executed: int
    events_emitted: list[str]
    errors: list[str] = Field(default_factory=list)
    audio_commands: list[AudioCommand] = Field(default_factory=list)


# Rehearsal/Preview Models


class SystemStatePreview(BaseModel):
    """Preview of a system state change."""

    system_id: str
    system_name: str
    before_status: str
    before_value: float
    after_status: str
    after_value: float
    max_value: float


class PosturePreview(BaseModel):
    """Preview of a posture change."""

    before_posture: str
    after_posture: str


class EventPreview(BaseModel):
    """Preview of an event that would be emitted."""

    type: str
    severity: str
    message: str


class TransmissionPreview(BaseModel):
    """Preview of a transmission (hail) that would be created."""

    sender_name: str
    channel: str
    text: str


class TogglePreview(BaseModel):
    """Preview of a visibility toggle action."""

    target_type: str  # 'transmission', 'holomap_marker', 'sensor_contact'
    target_id: str
    target_name: str
    before_visible: bool
    after_visible: bool


class ScenarioRehearsalResult(BaseModel):
    """Result of rehearsing a scenario (preview without execution)."""

    scenario_id: str
    scenario_name: str
    can_execute: bool
    system_changes: list[SystemStatePreview] = Field(default_factory=list)
    posture_change: PosturePreview | None = None
    events_preview: list[EventPreview] = Field(default_factory=list)
    transmissions_preview: list[TransmissionPreview] = Field(default_factory=list)
    toggles_preview: list[TogglePreview] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
