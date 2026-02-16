"""
Incident models.
"""

from typing import Any

from pydantic import BaseModel, Field


class IncidentCreate(BaseModel):
    """Schema for creating an incident."""

    ship_id: str
    name: str = Field(min_length=1)
    severity: str
    description: str | None = None
    linked_system_ids: list[str] = Field(default_factory=list)
    effects: list[dict[str, Any]] = Field(default_factory=list)
    source: str = "manual"
    source_id: str | None = None


class IncidentUpdate(BaseModel):
    """Schema for updating an incident."""

    name: str | None = None
    status: str | None = None
    severity: str | None = None
    description: str | None = None
    linked_system_ids: list[str] | None = None
    effects: list[dict[str, Any]] | None = None
