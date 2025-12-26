"""
Contact models.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from .base import BaseSchema


class ThreatLevel(str, Enum):
    """Threat level enum for contacts."""

    FRIENDLY = "friendly"
    NEUTRAL = "neutral"
    SUSPICIOUS = "suspicious"
    HOSTILE = "hostile"
    UNKNOWN = "unknown"


class ContactBase(BaseModel):
    """Base contact fields."""

    name: str
    affiliation: Optional[str] = None
    threat_level: ThreatLevel = ThreatLevel.UNKNOWN
    role: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    tags: list[str] = []


class ContactCreate(ContactBase):
    """Schema for creating a contact."""

    id: Optional[str] = None  # Allow custom ID for seed data
    ship_id: str


class ContactUpdate(BaseModel):
    """Schema for updating a contact."""

    name: Optional[str] = None
    affiliation: Optional[str] = None
    threat_level: Optional[ThreatLevel] = None
    role: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[list[str]] = None
    last_contacted_at: Optional[str] = None


class Contact(ContactBase, BaseSchema):
    """Full contact schema."""

    id: str
    ship_id: str
    last_contacted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
