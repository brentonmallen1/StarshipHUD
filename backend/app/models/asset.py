"""
Asset models (weapons, drones, probes).
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseSchema, SystemStatus


class AssetType(str, Enum):
    """Asset type categories."""

    ENERGY_WEAPON = "energy_weapon"
    TORPEDO = "torpedo"
    MISSILE = "missile"
    RAILGUN = "railgun"
    LASER = "laser"
    PARTICLE_BEAM = "particle_beam"
    DRONE = "drone"
    PROBE = "probe"


class FireMode(str, Enum):
    """Weapon fire modes."""

    SINGLE = "single"
    BURST = "burst"
    SUSTAINED = "sustained"
    AUTO = "auto"


class MountLocation(str, Enum):
    """Weapon mount locations."""

    PORT = "port"
    STARBOARD = "starboard"
    DORSAL = "dorsal"
    VENTRAL = "ventral"
    FORE = "fore"
    AFT = "aft"


class AssetBase(BaseModel):
    """Base asset fields."""

    name: str
    asset_type: AssetType
    status: SystemStatus = SystemStatus.OPERATIONAL

    # Ammo/Resources
    ammo_current: int = 0
    ammo_max: int = 0
    ammo_type: Optional[str] = None

    # Combat Stats
    range: float = 0
    range_unit: str = "km"
    damage: Optional[float] = None
    accuracy: Optional[float] = None  # percentage

    # Timing
    charge_time: Optional[float] = None  # seconds to charge/ready
    cooldown: Optional[float] = None  # seconds between shots

    # Weapon Mode
    fire_mode: Optional[FireMode] = None

    # State
    is_armed: bool = False
    is_ready: bool = True
    current_target: Optional[str] = None

    # Mount/Location
    mount_location: Optional[MountLocation] = None


class AssetCreate(AssetBase):
    """Schema for creating an asset."""

    id: Optional[str] = None  # Allow custom ID for seed data
    ship_id: str


class AssetUpdate(BaseModel):
    """Schema for updating an asset."""

    name: Optional[str] = None
    asset_type: Optional[AssetType] = None
    status: Optional[SystemStatus] = None

    # Ammo/Resources
    ammo_current: Optional[int] = None
    ammo_max: Optional[int] = None
    ammo_type: Optional[str] = None

    # Combat Stats
    range: Optional[float] = None
    range_unit: Optional[str] = None
    damage: Optional[float] = None
    accuracy: Optional[float] = None

    # Timing
    charge_time: Optional[float] = None
    cooldown: Optional[float] = None

    # Weapon Mode
    fire_mode: Optional[FireMode] = None

    # State
    is_armed: Optional[bool] = None
    is_ready: Optional[bool] = None
    current_target: Optional[str] = None

    # Mount/Location
    mount_location: Optional[MountLocation] = None


class Asset(AssetBase, BaseSchema):
    """Full asset schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
