"""
Base models and common types.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class SystemStatus(StrEnum):
    """Status enum for all system states."""

    OPTIMAL = "optimal"
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    COMPROMISED = "compromised"
    CRITICAL = "critical"
    DESTROYED = "destroyed"
    OFFLINE = "offline"


class StationGroup(StrEnum):
    """Station groups for panel organization."""

    COMMAND = "command"
    ENGINEERING = "engineering"
    SENSORS = "sensors"
    TACTICAL = "tactical"
    LIFE_SUPPORT = "life_support"
    COMMUNICATIONS = "communications"
    OPERATIONS = "operations"
    ADMIN = "admin"


class Role(StrEnum):
    """User roles."""

    PLAYER = "player"
    GM = "gm"


class Posture(StrEnum):
    """Threat posture levels."""

    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"
    SILENT_RUNNING = "silent_running"
    GENERAL_QUARTERS = "general_quarters"


class EventSeverity(StrEnum):
    """Event severity levels."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class CargoSizeClass(StrEnum):
    """Size classes for cargo items - maps to polyomino tile count."""

    TINY = "tiny"  # 1 tile
    X_SMALL = "x_small"  # 2 tiles
    SMALL = "small"  # 3 tiles
    MEDIUM = "medium"  # 4 tiles
    LARGE = "large"  # 5 tiles
    X_LARGE = "x_large"  # 6 tiles
    HUGE = "huge"  # 7 tiles


class CargoBaySize(StrEnum):
    """Predefined cargo bay sizes."""

    SMALL = "small"  # 6x4 grid
    MEDIUM = "medium"  # 8x6 grid
    LARGE = "large"  # 10x8 grid
    CUSTOM = "custom"  # GM-defined dimensions


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(from_attributes=True)


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""

    created_at: datetime
    updated_at: datetime
