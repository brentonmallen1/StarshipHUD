"""
Asset models (weapons, drones, probes).
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from .base import BaseSchema, SystemStatus
from .system_state import LimitingParent


class AssetType(StrEnum):
    """Asset type categories."""

    ENERGY_WEAPON = "energy_weapon"
    TORPEDO = "torpedo"
    MISSILE = "missile"
    RAILGUN = "railgun"
    LASER = "laser"
    PARTICLE_BEAM = "particle_beam"
    DRONE = "drone"
    PROBE = "probe"


class FireMode(StrEnum):
    """Weapon fire modes."""

    SINGLE = "single"
    BURST = "burst"
    SUSTAINED = "sustained"
    AUTO = "auto"


class MountLocation(StrEnum):
    """Weapon mount locations."""

    PORT = "port"
    STARBOARD = "starboard"
    DORSAL = "dorsal"
    VENTRAL = "ventral"
    FORE = "fore"
    AFT = "aft"


class AssetBase(BaseModel):
    """Base asset fields."""

    name: str = Field(min_length=1)
    asset_type: AssetType
    status: SystemStatus = SystemStatus.OPERATIONAL

    # Ammo/Resources
    ammo_current: int = 0
    ammo_max: int = 0
    ammo_type: str | None = None

    # Combat Stats
    range: float = 0
    range_unit: str = "km"
    damage: float | None = None
    accuracy: float | None = None  # percentage

    # Timing
    charge_time: float | None = None  # seconds to charge/ready
    cooldown: float | None = None  # seconds between shots

    # Weapon Mode
    fire_mode: FireMode | None = None

    # State
    is_armed: bool = False
    is_ready: bool = True
    current_target: str | None = None

    # Mount/Location
    mount_location: MountLocation | None = None

    # Dependencies (system state IDs this asset depends on)
    depends_on: list[str] = Field(default_factory=list)


class AssetCreate(AssetBase):
    """Schema for creating an asset."""

    id: str | None = None  # Allow custom ID for seed data
    ship_id: str


class AssetUpdate(BaseModel):
    """Schema for updating an asset."""

    name: str | None = None
    asset_type: AssetType | None = None
    status: SystemStatus | None = None

    # Ammo/Resources
    ammo_current: int | None = None
    ammo_max: int | None = None
    ammo_type: str | None = None

    # Combat Stats
    range: float | None = None
    range_unit: str | None = None
    damage: float | None = None
    accuracy: float | None = None

    # Timing
    charge_time: float | None = None
    cooldown: float | None = None

    # Weapon Mode
    fire_mode: FireMode | None = None

    # State
    is_armed: bool | None = None
    is_ready: bool | None = None
    current_target: str | None = None

    # Mount/Location
    mount_location: MountLocation | None = None

    # Dependencies
    depends_on: list[str] | None = None


class Asset(AssetBase, BaseSchema):
    """Full asset schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime

    # Computed fields (based on depends_on)
    effective_status: SystemStatus | None = None  # Status capped by parent systems
    limiting_parent: LimitingParent | None = None  # System causing the status cap
