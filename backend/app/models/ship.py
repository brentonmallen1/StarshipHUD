"""
Ship models.
"""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel

from .base import BaseSchema


class ShipBase(BaseModel):
    """Base ship fields."""

    name: str
    ship_class: Optional[str] = None
    registry: Optional[str] = None
    description: Optional[str] = None
    attributes: dict[str, Any] = {}


class ShipCreate(ShipBase):
    """Schema for creating a ship."""

    seed_type: Literal["blank", "full"] = "blank"


class ShipUpdate(BaseModel):
    """Schema for updating a ship."""

    name: Optional[str] = None
    ship_class: Optional[str] = None
    registry: Optional[str] = None
    description: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None


class Ship(ShipBase, BaseSchema):
    """Full ship schema."""

    id: str
    created_at: datetime
    updated_at: datetime
