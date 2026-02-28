"""
Timer models for countdown displays.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .base import BaseSchema, EventSeverity


class TimerBase(BaseModel):
    """Base timer fields."""

    label: str = Field(min_length=1)
    end_time: datetime  # When timer expires (ISO timestamp)
    severity: EventSeverity = EventSeverity.WARNING  # Affects styling
    scenario_id: str | None = None  # Execute scenario on expiry (optional)
    visible: bool = True  # GM can hide until ready


class TimerCreate(BaseModel):
    """Schema for creating a timer."""

    id: str | None = None  # Allow custom ID
    ship_id: str
    label: str = Field(min_length=1)
    end_time: datetime | None = None  # Either end_time or duration_seconds required
    duration_seconds: int | None = None  # Alternative to end_time: set duration from now
    severity: EventSeverity = EventSeverity.WARNING
    scenario_id: str | None = None
    visible: bool = True


class TimerUpdate(BaseModel):
    """Schema for updating a timer."""

    label: str | None = None
    end_time: datetime | None = None
    severity: EventSeverity | None = None
    scenario_id: str | None = None
    visible: bool | None = None
    paused_at: datetime | None = None  # Set to pause, clear to resume


class Timer(TimerBase, BaseSchema):
    """Full timer schema."""

    id: str
    ship_id: str
    paused_at: datetime | None = None  # If set, timer is paused
    created_at: datetime
    updated_at: datetime
