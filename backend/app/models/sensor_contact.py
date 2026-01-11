"""
Sensor contact models for radar/sensor displays.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseSchema


class IFF(str, Enum):
    """Identification Friend or Foe."""

    FRIENDLY = "friendly"
    HOSTILE = "hostile"
    NEUTRAL = "neutral"
    UNKNOWN = "unknown"


class RadarThreatLevel(str, Enum):
    """Threat assessment level for sensor contacts."""

    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class SensorContactBase(BaseModel):
    """Base sensor contact fields."""

    label: str
    contact_id: Optional[str] = None
    confidence: int = Field(50, ge=0, le=100)
    iff: IFF = IFF.UNKNOWN
    threat: RadarThreatLevel = RadarThreatLevel.UNKNOWN
    bearing_deg: Optional[float] = Field(None, ge=0, lt=360)
    range_km: Optional[float] = Field(None, ge=0)
    vector: Optional[str] = None
    signal_strength: Optional[int] = None
    notes: Optional[str] = None
    visible: bool = False


class SensorContactCreate(SensorContactBase):
    """Schema for creating a sensor contact."""

    id: Optional[str] = None
    ship_id: str


class SensorContactUpdate(BaseModel):
    """Schema for updating a sensor contact."""

    label: Optional[str] = None
    contact_id: Optional[str] = None
    confidence: Optional[int] = Field(None, ge=0, le=100)
    iff: Optional[IFF] = None
    threat: Optional[RadarThreatLevel] = None
    bearing_deg: Optional[float] = Field(None, ge=0, lt=360)
    range_km: Optional[float] = Field(None, ge=0)
    vector: Optional[str] = None
    signal_strength: Optional[int] = None
    notes: Optional[str] = None
    visible: Optional[bool] = None


class SensorContact(SensorContactBase, BaseSchema):
    """Full sensor contact schema."""

    id: str
    ship_id: str
    first_detected_at: datetime
    last_updated_at: datetime
    lost_contact_at: Optional[datetime] = None


class SensorContactWithDossier(SensorContact):
    """Sensor contact with linked contact dossier."""

    dossier: Optional[dict] = None
