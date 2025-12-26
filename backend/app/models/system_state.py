"""
System state models.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .base import BaseSchema, SystemStatus


class SystemStateBase(BaseModel):
    """Base system state fields."""

    name: str
    status: SystemStatus = SystemStatus.OPERATIONAL
    value: float = 100
    max_value: float = 100
    unit: str = "%"
    category: Optional[str] = None


class SystemStateCreate(SystemStateBase):
    """Schema for creating a system state."""

    id: str  # Allow custom ID for seed data
    ship_id: str


class SystemStateUpdate(BaseModel):
    """Schema for updating a system state."""

    name: Optional[str] = None
    status: Optional[SystemStatus] = None
    value: Optional[float] = None
    max_value: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None


class SystemState(SystemStateBase, BaseSchema):
    """Full system state schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
