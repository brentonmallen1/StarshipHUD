"""
Contact models.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from .base import BaseSchema


class ThreatLevel(StrEnum):
    """Threat level enum for contacts."""

    FRIENDLY = "friendly"
    NEUTRAL = "neutral"
    SUSPICIOUS = "suspicious"
    HOSTILE = "hostile"
    UNKNOWN = "unknown"


class ContactBase(BaseModel):
    """Base contact fields."""

    name: str = Field(min_length=1)
    affiliation: str | None = None
    threat_level: ThreatLevel = ThreatLevel.UNKNOWN
    role: str | None = None
    notes: str | None = None
    image_url: str | None = None
    tags: list[str] = Field(default_factory=list)


class ContactCreate(ContactBase):
    """Schema for creating a contact."""

    id: str | None = None  # Allow custom ID for seed data
    ship_id: str


class ContactUpdate(BaseModel):
    """Schema for updating a contact."""

    name: str | None = None
    affiliation: str | None = None
    threat_level: ThreatLevel | None = None
    role: str | None = None
    notes: str | None = None
    image_url: str | None = None
    tags: list[str] | None = None
    last_contacted_at: str | None = None


class Contact(ContactBase, BaseSchema):
    """Full contact schema."""

    id: str
    ship_id: str
    last_contacted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
