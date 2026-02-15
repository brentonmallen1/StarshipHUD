"""
Sensor contact models for radar/sensor displays.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseSchema
from .contact import ThreatLevel


class SensorContactBase(BaseModel):
    """Base sensor contact fields."""

    label: str = Field(min_length=1)
    contact_id: Optional[str] = None
    confidence: int = Field(50, ge=0, le=100)
    threat_level: ThreatLevel = ThreatLevel.UNKNOWN
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
    threat_level: Optional[ThreatLevel] = None
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
