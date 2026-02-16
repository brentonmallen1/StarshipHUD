"""
Cargo inventory models.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .base import BaseSchema, CargoSizeClass


class CargoBase(BaseModel):
    """Base cargo fields."""

    name: str = Field(min_length=1)
    category_id: str | None = None  # FK to cargo_categories
    notes: str | None = None  # Free-form notes (player-editable)
    size_class: CargoSizeClass = CargoSizeClass.SMALL
    shape_variant: int = 0  # Index into shape options for that size
    color: str | None = None  # Custom color (overrides category color)


class CargoCreate(CargoBase):
    """Schema for creating cargo."""

    id: str | None = None  # Allow custom ID for seed data
    ship_id: str


class CargoUpdate(BaseModel):
    """Schema for updating cargo."""

    name: str | None = None
    category_id: str | None = None
    notes: str | None = None
    size_class: CargoSizeClass | None = None
    shape_variant: int | None = None
    color: str | None = None


class Cargo(CargoBase, BaseSchema):
    """Full cargo schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
    # Deprecated fields kept for backward compatibility during migration
    category: str | None = None
    quantity: float | None = None
    unit: str | None = None
    description: str | None = None
    value: float | None = None
    location: str | None = None
