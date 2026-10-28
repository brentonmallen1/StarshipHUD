"""
Base models and common types.
"""

import sqlite3
from datetime import datetime
from enum import StrEnum
from functools import cache
from typing import Annotated, ClassVar
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, model_validator
from pydantic_core import PydanticCustomError


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


class ThemePreset(StrEnum):
    """Visual theme for every console on a ship (chosen by the GM)."""

    BASELINE = "baseline"
    AMBER = "amber"
    TACTICAL = "tactical"
    PHOSPHOR = "phosphor"
    HOLO = "holo"


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


@cache
def _schema_not_null_columns() -> dict[str, frozenset[str]]:
    """NOT NULL columns per table, read from the canonical SCHEMA."""
    from app.database import SCHEMA

    conn = sqlite3.connect(":memory:")
    try:
        conn.executescript(SCHEMA)
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]
        return {
            table: frozenset(r[1] for r in conn.execute(f"PRAGMA table_info({table})") if r[3])
            for table in tables
        }
    finally:
        conn.close()


def not_null_columns(table: str) -> frozenset[str]:
    """Columns of ``table`` declared NOT NULL in the schema."""
    columns = _schema_not_null_columns()
    if table not in columns:
        raise KeyError(f"Unknown table: {table}")
    return columns[table]


class UpdateSchema(BaseModel):
    """
    Base for PATCH request bodies applied with ``model_dump(exclude_unset=True)``.

    Fields are typed ``X | None`` so they can be omitted, but an explicit
    ``null`` for a field whose column is NOT NULL would reach SQLite and fail
    with a 500. Declare the table on the subclass and such nulls become a 422::

        class PanelUpdate(UpdateSchema, table="panels"): ...

    ``column_aliases`` maps a field to a differently named column.
    """

    __db_table__: ClassVar[str | None] = None
    __db_column_aliases__: ClassVar[dict[str, str]] = {}

    def __init_subclass__(cls, table: str | None = None, column_aliases: dict[str, str] | None = None, **kwargs):
        super().__init_subclass__(**kwargs)
        if table is not None:
            cls.__db_table__ = table
        if column_aliases is not None:
            cls.__db_column_aliases__ = column_aliases

    @model_validator(mode="after")
    def _reject_null_for_not_null_columns(self):
        table = type(self).__db_table__
        if table is None:
            return self
        required = not_null_columns(table)
        aliases = type(self).__db_column_aliases__
        bad = sorted(
            name
            for name in self.model_fields_set
            if getattr(self, name) is None and aliases.get(name, name) in required
        )
        if bad:
            raise PydanticCustomError(
                "null_not_allowed",
                "Field(s) cannot be null: {fields}. Omit a field to leave it unchanged.",
                {"fields": ", ".join(bad)},
            )
        return self


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(from_attributes=True)


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""

    created_at: datetime
    updated_at: datetime
