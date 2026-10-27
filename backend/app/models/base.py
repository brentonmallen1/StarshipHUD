"""
Base models and common types.
"""

from datetime import datetime
from enum import StrEnum
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict


def validate_asset_url(value: str | None, *, allow_placeholder: bool = False) -> str | None:
    """
    Validate a URL that the frontend will load as an image/audio asset.

    Allowed: None or "", an absolute ``http(s)://host/...`` URL, or a local
    ``/uploads/<path>`` URL whose path has no ``.``/``..`` segments, empty
    segments, backslashes or control characters. Anything else (``javascript:``,
    ``data:``, protocol-relative ``//host``, paths outside /uploads) is rejected
    because these values are rendered into players' views and walked by the
    ship exporter.
    """
    if value is None or value == "":
        return value
    if allow_placeholder and value == "placeholder":
        return value
    if any(ch.isspace() or ord(ch) < 0x20 or ord(ch) == 0x7F for ch in value) or "\\" in value:
        raise ValueError("URL must not contain whitespace, control characters or backslashes")

    if value.startswith("/uploads/"):
        path = value.removeprefix("/uploads/").split("?", 1)[0].split("#", 1)[0]
        segments = path.split("/")
        if not path or any(seg in ("", ".", "..") for seg in segments):
            raise ValueError("Upload URL must be /uploads/<path> without '.', '..' or empty segments")
        if "%" in path:
            raise ValueError("Upload URL must not contain percent-encoded characters")
        return value

    parts = urlsplit(value)
    if parts.scheme in ("http", "https") and parts.netloc:
        return value

    raise ValueError("URL must be empty, an http(s):// URL, or an /uploads/... path")


def _asset_url(value: str | None) -> str | None:
    return validate_asset_url(value)


def _asset_url_or_placeholder(value: str | None) -> str | None:
    return validate_asset_url(value, allow_placeholder=True)


# Use for any model field holding an image/audio URL (e.g. ``image_url: AssetUrl | None``)
AssetUrl = Annotated[str, AfterValidator(_asset_url)]
# Holomap layers use the literal "placeholder" for the generated deck graphic
AssetUrlOrPlaceholder = Annotated[str, AfterValidator(_asset_url_or_placeholder)]


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
    """User roles (ordered by privilege: admin > gm > player)."""

    ADMIN = "admin"
    GM = "gm"
    PLAYER = "player"


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


class TimerDirection(StrEnum):
    """Timer direction - countdown or countup."""

    COUNTDOWN = "countdown"
    COUNTUP = "countup"


class TimerDisplayPreset(StrEnum):
    """Timer display preset for player visibility."""

    FULL = "full"  # Shows time + title
    TIME_ONLY = "time_only"  # Shows countdown only (suspenseful)
    TITLE_ONLY = "title_only"  # Shows title only (mystery)


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
