"""
Cargo category models.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .base import BaseSchema


class CargoCategoryBase(BaseModel):
    """Base cargo category fields."""

    name: str = Field(min_length=1)
    color: str  # hex color like "#ff5500"


class CargoCategoryCreate(CargoCategoryBase):
    """Schema for creating a cargo category."""

    id: str | None = None
    ship_id: str


class CargoCategoryUpdate(BaseModel):
    """Schema for updating a cargo category."""

    name: str | None = None
    color: str | None = None


class CargoCategory(CargoCategoryBase, BaseSchema):
    """Full cargo category schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
