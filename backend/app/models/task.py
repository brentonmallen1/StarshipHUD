"""
Task models.
"""

from typing import Any

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    """Schema for creating a task."""

    ship_id: str
    title: str = Field(min_length=1)
    station: str
    description: str | None = None
    incident_id: str | None = None
    time_limit: int | None = Field(None, gt=0)
    minigame_id: str | None = None
    minigame_difficulty: int | None = None
    on_success: list[dict[str, Any]] = Field(default_factory=list)
    on_failure: list[dict[str, Any]] = Field(default_factory=list)
    on_expire: list[dict[str, Any]] = Field(default_factory=list)
    visible: bool = True


class TaskUpdate(BaseModel):
    """Schema for updating a task."""

    title: str | None = None
    description: str | None = None
    station: str | None = None
    status: str | None = None
    claimed_by: str | None = None
    time_limit: int | None = Field(None, gt=0)
    visible: bool | None = None
