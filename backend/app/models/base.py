"""
Base models and common types.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict


class SystemStatus(str, Enum):
    """Status enum for all system states."""

    OPTIMAL = "optimal"
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    COMPROMISED = "compromised"
    CRITICAL = "critical"
    DESTROYED = "destroyed"
    OFFLINE = "offline"


class StationGroup(str, Enum):
    """Station groups for panel organization."""

    COMMAND = "command"
    ENGINEERING = "engineering"
    SENSORS = "sensors"
    TACTICAL = "tactical"
    LIFE_SUPPORT = "life_support"
    COMMUNICATIONS = "communications"
    OPERATIONS = "operations"
    ADMIN = "admin"


class Role(str, Enum):
    """User roles."""

    PLAYER = "player"
    GM = "gm"


class Posture(str, Enum):
    """Threat posture levels."""

    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"
    SILENT_RUNNING = "silent_running"
    GENERAL_QUARTERS = "general_quarters"


class EventSeverity(str, Enum):
    """Event severity levels."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(from_attributes=True)


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""

    created_at: datetime
    updated_at: datetime
