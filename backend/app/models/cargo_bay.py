"""
Cargo bay models for polyomino cargo management.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .base import BaseSchema, CargoBaySize


class CargoBayBase(BaseModel):
    """Base cargo bay fields."""

    name: str
    bay_size: CargoBaySize = CargoBaySize.MEDIUM
    width: int = 8
    height: int = 6
    sort_order: int = 0


class CargoBayCreate(CargoBayBase):
    """Schema for creating a cargo bay."""

    id: Optional[str] = None  # Allow custom ID for seed data
    ship_id: str


class CargoBayUpdate(BaseModel):
    """Schema for updating a cargo bay."""

    name: Optional[str] = None
    bay_size: Optional[CargoBaySize] = None
    width: Optional[int] = None
    height: Optional[int] = None
    sort_order: Optional[int] = None


class CargoBay(CargoBayBase, BaseSchema):
    """Full cargo bay schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
