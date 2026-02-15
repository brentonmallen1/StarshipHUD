"""
Scenario models.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from .base import BaseSchema


class ScenarioAction(BaseModel):
    """A single action within a scenario."""

    type: str  # set_status, set_value, emit_event, spawn_task, etc.
    target: Optional[str] = None  # system_state_id or other target
    value: Optional[Any] = None
    data: dict[str, Any] = Field(default_factory=dict)


class ScenarioBase(BaseModel):
    """Base scenario fields."""

    name: str = Field(min_length=1)
    description: Optional[str] = None
    actions: list[ScenarioAction] = Field(default_factory=list)


class ScenarioCreate(ScenarioBase):
    """Schema for creating a scenario."""

    ship_id: str


class ScenarioUpdate(BaseModel):
    """Schema for updating a scenario."""

    name: Optional[str] = None
    description: Optional[str] = None
    actions: Optional[list[ScenarioAction]] = None


class Scenario(ScenarioBase, BaseSchema):
    """Full scenario schema."""

    id: str
    ship_id: str
    position: int = 0
    created_at: datetime
    updated_at: datetime


class ScenarioExecuteResult(BaseModel):
    """Result of executing a scenario."""

    scenario_id: str
    success: bool
    actions_executed: int
    events_emitted: list[str]
    errors: list[str] = Field(default_factory=list)


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


class ScenarioRehearsalResult(BaseModel):
    """Result of rehearsing a scenario (preview without execution)."""

    scenario_id: str
    scenario_name: str
    can_execute: bool
    system_changes: list[SystemStatePreview] = Field(default_factory=list)
    posture_change: Optional[PosturePreview] = None
    events_preview: list[EventPreview] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
