"""
Event models.
"""

from datetime import datetime
from typing import Any, Optional

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

    type: Optional[str] = None
    severity: Optional[EventSeverity] = None
    message: Optional[str] = None
    data: Optional[dict[str, Any]] = None
    transmitted: Optional[bool] = None


class Event(EventBase, BaseSchema):
    """Full event schema."""

    id: str
    ship_id: str
    transmitted: bool = True
    created_at: datetime


class EventFilter(BaseModel):
    """Filter parameters for querying events."""

    types: Optional[list[str]] = None
    severity: Optional[list[EventSeverity]] = None
    transmitted: Optional[bool] = None
    limit: int = 50
    since: Optional[datetime] = None
