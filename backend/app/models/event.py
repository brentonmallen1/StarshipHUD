"""
Event models.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .base import BaseSchema, EventSeverity


class EventBase(BaseModel):
    """Base event fields."""

    type: str
    severity: EventSeverity = EventSeverity.INFO
    message: str
    data: dict[str, Any] = Field(default_factory=dict)


class EventCreate(EventBase):
    """Schema for creating an event."""

    ship_id: str
    transmitted: bool = True  # Default to True for backward compatibility


class EventUpdate(BaseModel):
    """Schema for updating an event."""

    type: str | None = None
    severity: EventSeverity | None = None
    message: str | None = None
    data: dict[str, Any] | None = None
    transmitted: bool | None = None


class Event(EventBase, BaseSchema):
    """Full event schema."""

    id: str
    ship_id: str
    transmitted: bool = True
    created_at: datetime


class EventFilter(BaseModel):
    """Filter parameters for querying events."""

    types: list[str] | None = None
    severity: list[EventSeverity] | None = None
    transmitted: bool | None = None
    limit: int = 50
    since: datetime | None = None
