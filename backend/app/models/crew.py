"""
Crew member models.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from .base import BaseSchema


class CrewStatus(StrEnum):
    """Duty-focused status enum for crew members."""

    FIT_FOR_DUTY = "fit_for_duty"
    LIGHT_DUTY = "light_duty"
    INCAPACITATED = "incapacitated"
    CRITICAL = "critical"
    DECEASED = "deceased"
    ON_LEAVE = "on_leave"
    MISSING = "missing"


class CrewBase(BaseModel):
    """Base crew member fields."""

    name: str = Field(min_length=1)
    role: str | None = None
    status: CrewStatus = CrewStatus.FIT_FOR_DUTY
    player_name: str | None = None
    is_npc: bool = True
    notes: str | None = None
    condition_tags: list[str] = Field(default_factory=list)


class CrewCreate(CrewBase):
    """Schema for creating a crew member."""

    id: str | None = None  # Allow custom ID for seed data
    ship_id: str


class CrewUpdate(BaseModel):
    """Schema for updating a crew member."""

    name: str | None = None
    role: str | None = None
    status: CrewStatus | None = None
    player_name: str | None = None
    is_npc: bool | None = None
    notes: str | None = None
    condition_tags: list[str] | None = None


class Crew(CrewBase, BaseSchema):
    """Full crew member schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
