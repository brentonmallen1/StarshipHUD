"""
Task models.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    """Schema for creating a task."""

    ship_id: str
    title: str = Field(min_length=1)
    station: str
    description: Optional[str] = None
    incident_id: Optional[str] = None
    time_limit: Optional[int] = Field(None, gt=0)
    minigame_id: Optional[str] = None
    minigame_difficulty: Optional[int] = None
    on_success: list[dict[str, Any]] = Field(default_factory=list)
    on_failure: list[dict[str, Any]] = Field(default_factory=list)
    on_expire: list[dict[str, Any]] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    """Schema for updating a task."""

    title: Optional[str] = None
    description: Optional[str] = None
    station: Optional[str] = None
    status: Optional[str] = None
    claimed_by: Optional[str] = None
    time_limit: Optional[int] = Field(None, gt=0)
