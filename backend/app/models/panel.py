"""
Panel and widget instance models.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from .base import BaseSchema, Role, StationGroup


class PanelBase(BaseModel):
    """Base panel fields."""

    name: str = Field(min_length=1)
    station_group: StationGroup
    role_visibility: list[Role] = Field(default_factory=lambda: [Role.PLAYER, Role.GM])
    sort_order: int = 0
    icon_id: Optional[str] = None
    description: Optional[str] = None
    grid_columns: int = Field(default=24, gt=0)
    grid_rows: int = Field(default=16, gt=0)


class PanelCreate(PanelBase):
    """Schema for creating a panel."""

    ship_id: str


class PanelUpdate(BaseModel):
    """Schema for updating a panel."""

    name: Optional[str] = None
    station_group: Optional[StationGroup] = None
    role_visibility: Optional[list[Role]] = None
    sort_order: Optional[int] = None
    icon_id: Optional[str] = None
    description: Optional[str] = None
    grid_columns: Optional[int] = Field(None, gt=0)
    grid_rows: Optional[int] = Field(None, gt=0)


class Panel(PanelBase, BaseSchema):
    """Full panel schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime


class WidgetInstanceBase(BaseModel):
    """Base widget instance fields."""

    widget_type: str
    x: int = 0
    y: int = 0
    width: int = 2
    height: int = 1
    config: dict[str, Any] = Field(default_factory=dict)
    bindings: dict[str, Any] = Field(default_factory=dict)
    label: Optional[str] = None


class WidgetInstanceCreate(WidgetInstanceBase):
    """Schema for creating a widget instance."""

    panel_id: str


class WidgetInstanceUpdate(BaseModel):
    """Schema for updating a widget instance."""

    widget_type: Optional[str] = None
    x: Optional[int] = None
    y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    config: Optional[dict[str, Any]] = None
    bindings: Optional[dict[str, Any]] = None
    label: Optional[str] = None


class WidgetInstance(WidgetInstanceBase, BaseSchema):
    """Full widget instance schema."""

    id: str
    panel_id: str
    created_at: datetime
    updated_at: datetime


class PanelWithWidgets(Panel):
    """Panel with its widget instances."""

    widgets: list[WidgetInstance] = Field(default_factory=list)
