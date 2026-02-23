"""
Sector map models for the hex grid tactical map system.
"""

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from .base import BaseSchema


class SpriteCategory(StrEnum):
    """Categories for sector map sprites."""

    CELESTIAL = "celestial"
    STATION = "station"
    SHIP = "ship"
    HAZARD = "hazard"
    OTHER = "other"


class VisibilityState(StrEnum):
    """Visibility state for map objects."""

    VISIBLE = "visible"
    HIDDEN = "hidden"
    ANOMALY = "anomaly"


# =============================================================================
# SectorMap Models
# =============================================================================


class SectorMapBase(BaseModel):
    """Base sector map fields."""

    name: str = Field(min_length=1)
    description: str | None = None
    hex_size: int = Field(12, ge=4, le=128, description="Hex size in pixels")
    grid_width: int = Field(60, ge=5, le=200)
    grid_height: int = Field(40, ge=5, le=200)
    grid_radius: int = Field(25, ge=3, le=100, description="Hexagonal grid radius in hexes")
    background_color: str = "#08081a"
    background_image_url: str | None = None
    bg_scale: float = Field(1.0, ge=0.05, le=20.0, description="Background image scale")
    bg_rotation: float = Field(0.0, ge=-360.0, le=360.0, description="Background image rotation in degrees")
    bg_offset_x: float = Field(0.0, description="Background image X offset in pixels")
    bg_offset_y: float = Field(0.0, description="Background image Y offset in pixels")
    bg_opacity: float = Field(1.0, ge=0.0, le=1.0, description="Background image opacity")
    grid_visible: bool = True
    grid_color: str = "cyan"
    grid_opacity: float = Field(0.15, ge=0.0, le=1.0)
    is_active: bool = False
    sort_order: int = 0


class SectorMapCreate(SectorMapBase):
    """Schema for creating a sector map."""

    id: str | None = None  # Allow custom ID for seed data
    ship_id: str


class SectorMapUpdate(BaseModel):
    """Schema for updating a sector map."""

    name: str | None = None
    description: str | None = None
    hex_size: int | None = Field(None, ge=4, le=128)
    grid_width: int | None = Field(None, ge=5, le=200)
    grid_height: int | None = Field(None, ge=5, le=200)
    grid_radius: int | None = Field(None, ge=3, le=100)
    background_color: str | None = None
    background_image_url: str | None = None
    bg_scale: float | None = Field(None, ge=0.05, le=20.0)
    bg_rotation: float | None = Field(None, ge=-360.0, le=360.0)
    bg_offset_x: float | None = None
    bg_offset_y: float | None = None
    bg_opacity: float | None = Field(None, ge=0.0, le=1.0)
    grid_visible: bool | None = None
    grid_color: str | None = None
    grid_opacity: float | None = Field(None, ge=0.0, le=1.0)
    is_active: bool | None = None
    sort_order: int | None = None


class SectorMap(SectorMapBase, BaseSchema):
    """Full sector map schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime


# =============================================================================
# SectorSprite Models
# =============================================================================


class SectorSpriteBase(BaseModel):
    """Base sector sprite fields."""

    name: str = Field(min_length=1)
    category: SpriteCategory = SpriteCategory.OTHER
    image_url: str
    default_locked: bool = False


class SectorSpriteCreate(SectorSpriteBase):
    """Schema for creating a sprite."""

    id: str | None = None
    ship_id: str


class SectorSpriteUpdate(BaseModel):
    """Schema for updating a sprite."""

    name: str | None = None
    category: SpriteCategory | None = None
    image_url: str | None = None
    default_locked: bool | None = None


class SectorSprite(SectorSpriteBase, BaseSchema):
    """Full sprite schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime


# =============================================================================
# SectorMapObject Models
# =============================================================================


class SectorMapObjectBase(BaseModel):
    """Base map object fields."""

    hex_q: int = Field(description="Axial column coordinate")
    hex_r: int = Field(description="Axial row coordinate")
    label: str | None = None
    description: str | None = None
    scale: float = Field(1.0, ge=0.25, le=10.0)
    rotation: float = Field(0.0, ge=-360.0, le=360.0, description="Sprite rotation in degrees")
    visibility_state: VisibilityState = VisibilityState.VISIBLE
    locked: bool = False


class SectorMapObjectCreate(SectorMapObjectBase):
    """Schema for creating a map object."""

    id: str | None = None
    map_id: str
    sprite_id: str | None = None


class SectorMapObjectUpdate(BaseModel):
    """Schema for updating a map object."""

    hex_q: int | None = None
    hex_r: int | None = None
    sprite_id: str | None = None
    label: str | None = None
    description: str | None = None
    scale: float | None = Field(None, ge=0.25, le=10.0)
    rotation: float | None = Field(None, ge=-360.0, le=360.0)
    visibility_state: VisibilityState | None = None
    locked: bool | None = None


class SectorMapObject(SectorMapObjectBase, BaseSchema):
    """Full map object schema."""

    id: str
    map_id: str
    sprite_id: str | None = None
    created_at: datetime
    updated_at: datetime


# =============================================================================
# SectorWaypoint Models
# =============================================================================


class SectorWaypointBase(BaseModel):
    """Base waypoint fields."""

    hex_q: int
    hex_r: int
    label: str | None = None
    color: str = "#ffff00"
    created_by: Literal["gm", "player"] = "gm"


class SectorWaypointCreate(SectorWaypointBase):
    """Schema for creating a waypoint."""

    id: str | None = None
    map_id: str


class SectorWaypointUpdate(BaseModel):
    """Schema for updating a waypoint."""

    hex_q: int | None = None
    hex_r: int | None = None
    label: str | None = None
    color: str | None = None


class SectorWaypoint(SectorWaypointBase, BaseSchema):
    """Full waypoint schema."""

    id: str
    map_id: str
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Composite Models
# =============================================================================


class SectorMapWithObjects(SectorMap):
    """Sector map with nested objects, sprite data, and waypoints."""

    objects: list[SectorMapObject] = Field(default_factory=list)
    sprites: list[SectorSprite] = Field(default_factory=list)
    waypoints: list[SectorWaypoint] = Field(default_factory=list)
