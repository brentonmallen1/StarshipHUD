"""
Ship models.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from .base import BaseSchema, ThemePreset, UpdateSchema


class ShipBase(BaseModel):
    """Base ship fields."""

    name: str = Field(min_length=1)
    ship_class: str | None = None
    registry: str | None = None
    description: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    theme_preset: ThemePreset = ThemePreset.BASELINE


class ShipCreate(ShipBase):
    """Schema for creating a ship."""

    seed_type: Literal["blank", "full"] = "blank"


class ShipUpdate(UpdateSchema, table="ships"):
    """Schema for updating a ship."""

    name: str | None = None
    ship_class: str | None = None
    registry: str | None = None
    description: str | None = None
    attributes: dict[str, Any] | None = None
    theme_preset: ThemePreset | None = None


class Ship(ShipBase, BaseSchema):
    """Full ship schema."""

    id: str
    created_at: datetime
    updated_at: datetime
