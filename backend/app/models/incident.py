"""
Incident models.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class IncidentCreate(BaseModel):
    """Schema for creating an incident."""

    ship_id: str
    name: str = Field(min_length=1)
    severity: str
    description: Optional[str] = None
    linked_system_ids: list[str] = Field(default_factory=list)
    effects: list[dict[str, Any]] = Field(default_factory=list)
    source: str = "manual"
    source_id: Optional[str] = None


class IncidentUpdate(BaseModel):
    """Schema for updating an incident."""

    name: Optional[str] = None
    status: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    linked_system_ids: Optional[list[str]] = None
    effects: Optional[list[dict[str, Any]]] = None
