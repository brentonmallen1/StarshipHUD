"""
Timer models for countdown displays.
"""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from .base import BaseSchema, EventSeverity, TimerDirection, TimerDisplayPreset


class TimerBase(BaseModel):
    """Base timer fields."""

    label: str = Field(min_length=1)
    direction: TimerDirection = TimerDirection.COUNTDOWN
    end_time: datetime | None = None  # When timer expires (countdown only)
    start_time: datetime | None = None  # Reference point for elapsed time (countup only)
    duration_seconds: int | None = None  # Original duration for reset (countdown only)
    severity: EventSeverity = EventSeverity.WARNING  # Affects styling
    scenario_id: str | None = None  # Execute scenario on expiry (countdown only)
    visible: bool = True  # GM can hide until ready
    display_preset: TimerDisplayPreset = TimerDisplayPreset.FULL  # How timer appears to players
    gm_only: bool = False  # If true, only shows in GM floating widget


class TimerCreate(BaseModel):
    """Schema for creating a timer."""

    id: str | None = None  # Allow custom ID
    ship_id: str
    label: str = Field(min_length=1)
    direction: TimerDirection = TimerDirection.COUNTDOWN
    end_time: datetime | None = None  # Either end_time or duration_seconds required (countdown)
    duration_seconds: int | None = None  # Alternative to end_time: set duration from now
    start_time: datetime | None = None  # For countup, defaults to now if not provided
    severity: EventSeverity = EventSeverity.WARNING
    scenario_id: str | None = None  # Only valid for countdown
    visible: bool = True
    display_preset: TimerDisplayPreset = TimerDisplayPreset.FULL
    gm_only: bool = False

    @model_validator(mode="after")
    def validate_direction_constraints(self):
        """Validate constraints based on direction."""
        if self.direction == TimerDirection.COUNTUP:
            # Countup timers cannot have end_time or scenario_id
            if self.end_time is not None:
                raise ValueError("Countup timers cannot have end_time")
            if self.duration_seconds is not None:
                raise ValueError("Countup timers cannot have duration_seconds")
            if self.scenario_id is not None:
                raise ValueError("Countup timers cannot have scenario_id (no auto-trigger)")
        else:
            # Countdown timers require end_time or duration_seconds
            if self.end_time is None and self.duration_seconds is None:
                raise ValueError("Countdown timers require end_time or duration_seconds")
        return self


class TimerUpdate(BaseModel):
    """Schema for updating a timer."""

    label: str | None = None
    direction: TimerDirection | None = None
    end_time: datetime | None = None
    start_time: datetime | None = None
    duration_seconds: int | None = None  # Sets new duration (recalculates end_time for countdown)
    severity: EventSeverity | None = None
    scenario_id: str | None = None
    visible: bool | None = None
    display_preset: TimerDisplayPreset | None = None
    gm_only: bool | None = None
    paused_at: datetime | None = None  # Set to pause, clear to resume


class Timer(TimerBase, BaseSchema):
    """Full timer schema."""

    id: str
    ship_id: str
    paused_at: datetime | None = None  # If set, timer is paused
    created_at: datetime
    updated_at: datetime
