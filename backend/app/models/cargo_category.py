"""
Cargo category models.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .base import BaseSchema


class CargoCategoryBase(BaseModel):
    """Base cargo category fields."""

    name: str
    color: str  # hex color like "#ff5500"


class CargoCategoryCreate(CargoCategoryBase):
    """Schema for creating a cargo category."""

    id: Optional[str] = None
    ship_id: str


class CargoCategoryUpdate(BaseModel):
    """Schema for updating a cargo category."""

    name: Optional[str] = None
    color: Optional[str] = None


class CargoCategory(CargoCategoryBase, BaseSchema):
    """Full cargo category schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
