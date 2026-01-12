"""
Holomap models for deck plans and markers.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseSchema, EventSeverity


class MarkerType(str, Enum):
    """Types of holomap markers."""

    BREACH = "breach"
    FIRE = "fire"
    HAZARD = "hazard"
    CREW = "crew"
    OBJECTIVE = "objective"
    DAMAGE = "damage"
    OTHER = "other"


# =============================================================================
# Layer Models
# =============================================================================


class HolomapLayerBase(BaseModel):
    """Base holomap layer fields."""

    name: str
    image_url: str = "placeholder"  # URL to deck image or "placeholder" for generated SVG
    deck_level: Optional[str] = None
    sort_order: int = 0
    visible: bool = True
    image_scale: float = Field(1.0, ge=0.1, le=5.0, description="Image scale factor")
    image_offset_x: float = Field(0.0, ge=-1.0, le=1.0, description="Horizontal offset as fraction of container width")
    image_offset_y: float = Field(0.0, ge=-1.0, le=1.0, description="Vertical offset as fraction of container height")


class HolomapLayerCreate(HolomapLayerBase):
    """Schema for creating a layer."""

    id: Optional[str] = None  # Allow custom ID for seed data
    ship_id: str


class HolomapLayerUpdate(BaseModel):
    """Schema for updating a layer."""

    name: Optional[str] = None
    image_url: Optional[str] = None
    deck_level: Optional[str] = None
    sort_order: Optional[int] = None
    visible: Optional[bool] = None
    image_scale: Optional[float] = Field(None, ge=0.1, le=5.0)
    image_offset_x: Optional[float] = Field(None, ge=-1.0, le=1.0)
    image_offset_y: Optional[float] = Field(None, ge=-1.0, le=1.0)


class HolomapLayer(HolomapLayerBase, BaseSchema):
    """Full layer schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Marker Models
# =============================================================================


class HolomapMarkerBase(BaseModel):
    """Base marker fields."""

    type: MarkerType
    x: float = Field(..., ge=0, le=1, description="Normalized X coordinate (0-1)")
    y: float = Field(..., ge=0, le=1, description="Normalized Y coordinate (0-1)")
    severity: Optional[EventSeverity] = None
    label: Optional[str] = None
    description: Optional[str] = None
    linked_incident_id: Optional[str] = None
    linked_task_id: Optional[str] = None
    visible: bool = Field(True, description="Whether marker is visible to players")


class HolomapMarkerCreate(HolomapMarkerBase):
    """Schema for creating a marker."""

    id: Optional[str] = None  # Allow custom ID for seed data
    layer_id: str


class HolomapMarkerUpdate(BaseModel):
    """Schema for updating a marker."""

    type: Optional[MarkerType] = None
    x: Optional[float] = Field(None, ge=0, le=1)
    y: Optional[float] = Field(None, ge=0, le=1)
    severity: Optional[EventSeverity] = None
    label: Optional[str] = None
    description: Optional[str] = None
    linked_incident_id: Optional[str] = None
    linked_task_id: Optional[str] = None
    visible: Optional[bool] = None


class HolomapMarker(HolomapMarkerBase, BaseSchema):
    """Full marker schema."""

    id: str
    layer_id: str
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Composite Models
# =============================================================================


class HolomapLayerWithMarkers(HolomapLayer):
    """Layer with nested markers for full data fetch."""

    markers: list[HolomapMarker] = []
