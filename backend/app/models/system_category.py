"""
System category models.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .base import BaseSchema


class SystemCategoryBase(BaseModel):
    """Base system category fields."""

    name: str = Field(min_length=1)
    color: str  # hex color like "#00ffcc"


class SystemCategoryCreate(SystemCategoryBase):
    """Schema for creating a system category."""

    id: str | None = None
    ship_id: str
    sort_order: int = 0


class SystemCategoryUpdate(BaseModel):
    """Schema for updating a system category."""

    name: str | None = None
    color: str | None = None
    sort_order: int | None = None


class SystemCategory(SystemCategoryBase, BaseSchema):
    """Full system category schema."""

    id: str
    ship_id: str
    sort_order: int
    created_at: datetime
    updated_at: datetime
