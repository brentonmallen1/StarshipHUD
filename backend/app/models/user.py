"""
User models for authentication and user management.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.base import Role


class UserBase(BaseModel):
    """Base user fields."""

    username: str = Field(..., min_length=3, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    role: Role = Role.PLAYER


class UserCreate(UserBase):
    """Fields for creating a new user."""

    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """Fields for updating a user (all optional)."""

    username: str | None = Field(None, min_length=3, max_length=50)
    display_name: str | None = Field(None, min_length=1, max_length=100)
    role: Role | None = None
    is_active: bool | None = None


class UserFull(UserBase):
    """Full user representation (no password)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    is_active: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserPublic(BaseModel):
    """Public user info (for /me endpoint and other users)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    display_name: str
    role: Role
    must_change_password: bool


class LoginRequest(BaseModel):
    """Login credentials."""

    username: str
    password: str


class LoginResponse(BaseModel):
    """Login response with user info."""

    user: UserPublic
    message: str = "Login successful"


class ChangePasswordRequest(BaseModel):
    """Password change request."""

    current_password: str
    new_password: str = Field(..., min_length=8)


class ResetPasswordResponse(BaseModel):
    """Response from admin password reset."""

    temporary_password: str
    message: str = "Password reset successful. User must change password on next login."


class ShipAccessBase(BaseModel):
    """Base ship access fields."""

    role_override: Role | None = None
    can_edit: bool = False


class ShipAccessCreate(ShipAccessBase):
    """Fields for granting ship access."""

    user_id: str


class ShipAccessUpdate(BaseModel):
    """Fields for updating ship access."""

    role_override: Role | None = None
    can_edit: bool | None = None


class ShipAccessFull(ShipAccessBase):
    """Full ship access representation."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    ship_id: str
    created_at: datetime


class ShipAccessWithUser(ShipAccessFull):
    """Ship access with user info."""

    username: str
    display_name: str
    user_role: Role


class ShipAccessWithShip(ShipAccessFull):
    """Ship access with ship info (for user-centric view)."""

    ship_name: str
    ship_class: str | None
    ship_registry: str | None
