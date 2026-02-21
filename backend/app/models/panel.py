"""
Panel and widget instance models.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .base import BaseSchema, Role, StationGroup


class PanelBase(BaseModel):
    """Base panel fields."""

    name: str = Field(min_length=1)
    station_group: StationGroup
    role_visibility: list[Role] = Field(default_factory=lambda: [Role.PLAYER, Role.GM])
    sort_order: int = 0
    icon_id: str | None = None
    description: str | None = None
    grid_columns: int = Field(default=24, gt=0)
    grid_rows: int = Field(default=16, gt=0)
    compact_type: str = 'vertical'


class PanelCreate(PanelBase):
    """Schema for creating a panel."""

    ship_id: str


class PanelUpdate(BaseModel):
    """Schema for updating a panel."""

    name: str | None = None
    station_group: StationGroup | None = None
    role_visibility: list[Role] | None = None
    sort_order: int | None = None
    icon_id: str | None = None
    description: str | None = None
    grid_columns: int | None = Field(None, gt=0)
    grid_rows: int | None = Field(None, gt=0)
    compact_type: str | None = None


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
    label: str | None = None


class WidgetInstanceCreate(WidgetInstanceBase):
    """Schema for creating a widget instance."""

    panel_id: str


class WidgetInstanceUpdate(BaseModel):
    """Schema for updating a widget instance."""

    widget_type: str | None = None
    x: int | None = None
    y: int | None = None
    width: int | None = None
    height: int | None = None
    config: dict[str, Any] | None = None
    bindings: dict[str, Any] | None = None
    label: str | None = None


class WidgetInstance(WidgetInstanceBase, BaseSchema):
    """Full widget instance schema."""

    id: str
    panel_id: str
    created_at: datetime
    updated_at: datetime


class PanelWithWidgets(Panel):
    """Panel with its widget instances."""

    widgets: list[WidgetInstance] = Field(default_factory=list)
