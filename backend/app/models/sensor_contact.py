"""
Sensor contact models for radar/sensor displays.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .base import BaseSchema
from .contact import ThreatLevel


class SensorContactBase(BaseModel):
    """Base sensor contact fields."""

    label: str = Field(min_length=1)
    contact_id: str | None = None
    confidence: int = Field(50, ge=0, le=100)
    threat_level: ThreatLevel = ThreatLevel.UNKNOWN
    bearing_deg: float | None = Field(None, ge=0, lt=360)
    range_km: float | None = Field(None, ge=0)
    vector: str | None = None
    signal_strength: int | None = None
    notes: str | None = None
    visible: bool = False


class SensorContactCreate(SensorContactBase):
    """Schema for creating a sensor contact."""

    id: str | None = None
    ship_id: str


class SensorContactUpdate(BaseModel):
    """Schema for updating a sensor contact."""

    label: str | None = None
    contact_id: str | None = None
    confidence: int | None = Field(None, ge=0, le=100)
    threat_level: ThreatLevel | None = None
    bearing_deg: float | None = Field(None, ge=0, lt=360)
    range_km: float | None = Field(None, ge=0)
    vector: str | None = None
    signal_strength: int | None = None
    notes: str | None = None
    visible: bool | None = None


class SensorContact(SensorContactBase, BaseSchema):
    """Full sensor contact schema."""

    id: str
    ship_id: str
    first_detected_at: datetime
    last_updated_at: datetime
    lost_contact_at: datetime | None = None


class SensorContactWithDossier(SensorContact):
    """Sensor contact with linked contact dossier."""

    dossier: dict | None = None
