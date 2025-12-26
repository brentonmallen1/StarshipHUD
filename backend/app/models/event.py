"""
Event models.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from .base import BaseSchema, EventSeverity


class EventBase(BaseModel):
    """Base event fields."""

    type: str
    severity: EventSeverity = EventSeverity.INFO
    message: str
    data: dict[str, Any] = {}


class EventCreate(EventBase):
    """Schema for creating an event."""

    ship_id: str


class Event(EventBase, BaseSchema):
    """Full event schema."""

    id: str
    ship_id: str
    created_at: datetime


class EventFilter(BaseModel):
    """Filter parameters for querying events."""

    types: Optional[list[str]] = None
    severity: Optional[list[EventSeverity]] = None
    limit: int = 50
    since: Optional[datetime] = None
