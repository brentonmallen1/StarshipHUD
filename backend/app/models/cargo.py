"""
Cargo inventory models.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .base import BaseSchema


class CargoBase(BaseModel):
    """Base cargo fields."""

    name: str
    category: Optional[str] = None
    quantity: float = 0
    unit: str = "units"
    description: Optional[str] = None
    value: Optional[float] = None  # monetary value per unit
    location: Optional[str] = None  # cargo bay, storage, etc.


class CargoCreate(CargoBase):
    """Schema for creating cargo."""

    id: Optional[str] = None  # Allow custom ID for seed data
    ship_id: str


class CargoUpdate(BaseModel):
    """Schema for updating cargo."""

    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    value: Optional[float] = None
    location: Optional[str] = None


class Cargo(CargoBase, BaseSchema):
    """Full cargo schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
