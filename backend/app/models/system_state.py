"""
System state models.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseSchema, SystemStatus


class SystemStateBase(BaseModel):
    """Base system state fields."""

    name: str = Field(min_length=1)
    status: SystemStatus = SystemStatus.OPERATIONAL
    value: float = 100
    max_value: float = Field(default=100, gt=0)
    unit: str = "%"
    category: Optional[str] = None
    depends_on: list[str] = Field(default_factory=list)


class SystemStateCreate(SystemStateBase):
    """Schema for creating a system state."""

    id: str  # Allow custom ID for seed data
    ship_id: str


class SystemStateUpdate(BaseModel):
    """Schema for updating a system state."""

    name: Optional[str] = None
    status: Optional[SystemStatus] = None
    value: Optional[float] = None
    max_value: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = None
    category: Optional[str] = None
    depends_on: Optional[list[str]] = None


class LimitingParent(BaseModel):
    """Info about a parent system that is limiting a child's effective status."""

    id: str
    name: str
    effective_status: str


class SystemState(SystemStateBase, BaseSchema):
    """Full system state schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
    effective_status: Optional[SystemStatus] = None  # Computed: status capped by parent dependencies
    limiting_parent: Optional[LimitingParent] = None  # Parent system causing the status cap (if any)


# Bulk Reset Models


class SystemResetSpec(BaseModel):
    """Specification for resetting a single system."""

    system_id: str
    target_status: Optional[str] = "operational"
    target_value: Optional[float] = None  # If None, calculate from status


class BulkResetRequest(BaseModel):
    """Request for bulk resetting systems."""

    ship_id: str
    reset_all: bool = False  # If true, reset all systems for this ship
    systems: list[SystemResetSpec] = Field(default_factory=list)  # Specific systems to reset
    emit_event: bool = True  # Emit "all clear" event


class BulkResetResult(BaseModel):
    """Result of bulk reset operation."""

    systems_reset: int
    event_id: Optional[str] = None
    errors: list[str] = Field(default_factory=list)
