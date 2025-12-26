"""
Scenario models.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from .base import BaseSchema


class ScenarioAction(BaseModel):
    """A single action within a scenario."""

    type: str  # set_status, set_value, emit_event, spawn_task, etc.
    target: Optional[str] = None  # system_state_id or other target
    value: Optional[Any] = None
    data: dict[str, Any] = {}


class ScenarioBase(BaseModel):
    """Base scenario fields."""

    name: str
    description: Optional[str] = None
    actions: list[ScenarioAction] = []


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
    created_at: datetime
    updated_at: datetime


class ScenarioExecuteResult(BaseModel):
    """Result of executing a scenario."""

    scenario_id: str
    success: bool
    actions_executed: int
    events_emitted: list[str]
    errors: list[str] = []
