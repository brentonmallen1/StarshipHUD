"""
Cargo bay models for polyomino cargo management.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseSchema, CargoBaySize


class CargoBayBase(BaseModel):
    """Base cargo bay fields."""

    name: str = Field(min_length=1)
    bay_size: CargoBaySize = CargoBaySize.MEDIUM
    width: int = Field(default=8, gt=0)
    height: int = Field(default=6, gt=0)
    sort_order: int = 0


class CargoBayCreate(CargoBayBase):
    """Schema for creating a cargo bay."""

    id: Optional[str] = None  # Allow custom ID for seed data
    ship_id: str


class CargoBayUpdate(BaseModel):
    """Schema for updating a cargo bay."""

    name: Optional[str] = None
    bay_size: Optional[CargoBaySize] = None
    width: Optional[int] = Field(None, gt=0)
    height: Optional[int] = Field(None, gt=0)
    sort_order: Optional[int] = None


class CargoBay(CargoBayBase, BaseSchema):
    """Full cargo bay schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
