"""
Cargo placement models for tracking cargo positions in bays.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from .base import BaseSchema


class CargoPlacementBase(BaseModel):
    """Base cargo placement fields."""

    x: int
    y: int
    rotation: int = 0  # 0, 90, 180, 270 degrees

    @field_validator("rotation")
    @classmethod
    def validate_rotation(cls, v: int) -> int:
        if v not in (0, 90, 180, 270):
            raise ValueError("Rotation must be 0, 90, 180, or 270 degrees")
        return v


class CargoPlacementCreate(CargoPlacementBase):
    """Schema for creating a cargo placement."""

    id: Optional[str] = None  # Allow custom ID for seed data
    cargo_id: str
    bay_id: str


class CargoPlacementUpdate(BaseModel):
    """Schema for updating a cargo placement (move/rotate)."""

    x: Optional[int] = None
    y: Optional[int] = None
    rotation: Optional[int] = None

    @field_validator("rotation")
    @classmethod
    def validate_rotation(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v not in (0, 90, 180, 270):
            raise ValueError("Rotation must be 0, 90, 180, or 270 degrees")
        return v


class CargoPlacement(CargoPlacementBase, BaseSchema):
    """Full cargo placement schema."""

    id: str
    cargo_id: str
    bay_id: str
    created_at: datetime
    updated_at: datetime
