"""
Cargo inventory models.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseSchema, CargoSizeClass


class CargoBase(BaseModel):
    """Base cargo fields."""

    name: str = Field(min_length=1)
    category_id: Optional[str] = None  # FK to cargo_categories
    notes: Optional[str] = None  # Free-form notes (player-editable)
    size_class: CargoSizeClass = CargoSizeClass.SMALL
    shape_variant: int = 0  # Index into shape options for that size
    color: Optional[str] = None  # Custom color (overrides category color)


class CargoCreate(CargoBase):
    """Schema for creating cargo."""

    id: Optional[str] = None  # Allow custom ID for seed data
    ship_id: str


class CargoUpdate(BaseModel):
    """Schema for updating cargo."""

    name: Optional[str] = None
    category_id: Optional[str] = None
    notes: Optional[str] = None
    size_class: Optional[CargoSizeClass] = None
    shape_variant: Optional[int] = None
    color: Optional[str] = None


class Cargo(CargoBase, BaseSchema):
    """Full cargo schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
    # Deprecated fields kept for backward compatibility during migration
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    value: Optional[float] = None
    location: Optional[str] = None
