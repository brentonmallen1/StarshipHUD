"""
Authentication API endpoints.
"""

from datetime import datetime, timezone
from typing import Annotated

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_db
from app.models.user import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MyShipAccess,
    UserPublic,
)
from app.services.auth import (
    SESSION_COOKIE_NAME,
    create_session,
    get_current_user,
    hash_password,
    invalidate_all_user_sessions,
    invalidate_session,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    response: Response,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Authenticate user and create session."""
    if not settings.auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is not enabled",
        )

    # Find user by username
    cursor = await db.execute(
        """
        SELECT id, username, display_name, password_hash, role,
               is_active, must_change_password
        FROM users WHERE username = ?
        """,
        (request.username,),
    )
    user = await cursor.fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled",
        )

    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Update last login
    await db.execute(
        "UPDATE users SET last_login_at = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), user["id"]),
    )
    await db.commit()

    # Create session
    token = await create_session(db, user["id"])

    # Set session cookie
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.session_lifetime_days * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=False,  # Set True in production with HTTPS
    )

    return LoginResponse(
        user=UserPublic(
            id=user["id"],
            username=user["username"],
            display_name=user["display_name"],
            role=user["role"],
            must_change_password=bool(user["must_change_password"]),
        ),
    )


@router.post("/logout")
async def logout(
    response: Response,
    user: Annotated[dict, Depends(get_current_user)],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Logout current user and invalidate session."""
    if not settings.auth_enabled:
        return {"message": "Authentication is not enabled"}

    # Invalidate the session in the database
    if "session_id" in user:
        await invalidate_session(db, user["session_id"])

    # Clear the cookie
    response.delete_cookie(key=SESSION_COOKIE_NAME)

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserPublic)
async def get_me(
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get current authenticated user info."""
    return UserPublic(
        id=user["user_id"],
        username=user["username"],
        display_name=user["display_name"],
        role=user["role"],
        must_change_password=user.get("must_change_password", False),
    )


class ProfileUpdate(BaseModel):
    """Self-service profile update (limited fields)."""

    display_name: str | None = Field(None, min_length=1, max_length=100)


@router.patch("/me", response_model=UserPublic)
async def update_my_profile(
    updates: ProfileUpdate,
    user: Annotated[dict, Depends(get_current_user)],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update current user's profile (display_name only).

    Users can only update their own display_name, not username or role.
    """
    if not settings.auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is not enabled",
        )

    if updates.display_name is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    await db.execute(
        """
        UPDATE users
        SET display_name = ?, updated_at = ?
        WHERE id = ?
        """,
        (updates.display_name, datetime.now(timezone.utc).isoformat(), user["user_id"]),
    )
    await db.commit()

    # Return updated user info
    cursor = await db.execute(
        "SELECT id, username, display_name, role, must_change_password FROM users WHERE id = ?",
        (user["user_id"],),
    )
    row = await cursor.fetchone()

    return UserPublic(
        id=row["id"],
        username=row["username"],
        display_name=row["display_name"],
        role=row["role"],
        must_change_password=row["must_change_password"],
    )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    response: Response,
    user: Annotated[dict, Depends(get_current_user)],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Change current user's password.

    For forced password changes (must_change_password=True), current_password
    is not required since the user has already authenticated.

    For voluntary password changes, current_password is required.
    """
    if not settings.auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is not enabled",
        )

    # Get current password hash and must_change_password flag
    cursor = await db.execute(
        "SELECT password_hash, must_change_password FROM users WHERE id = ?",
        (user["user_id"],),
    )
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    is_forced_change = bool(row["must_change_password"])

    # For voluntary changes, require current password verification
    if not is_forced_change:
        if not request.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required",
            )
        if not verify_password(request.current_password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

    # Update password
    new_hash = hash_password(request.new_password)
    await db.execute(
        """
        UPDATE users
        SET password_hash = ?, must_change_password = 0, updated_at = ?
        WHERE id = ?
        """,
        (new_hash, datetime.now(timezone.utc).isoformat(), user["user_id"]),
    )

    # Invalidate all sessions (force re-login with new password)
    await invalidate_all_user_sessions(db, user["user_id"])
    await db.commit()

    # Clear the cookie
    response.delete_cookie(key=SESSION_COOKIE_NAME)

    return {"message": "Password changed successfully. Please log in again."}


@router.get("/status")
async def auth_status():
    """Check if authentication is enabled."""
    return {
        "auth_enabled": settings.auth_enabled,
        "session_lifetime_days": settings.session_lifetime_days,
    }


@router.get("/my-ships", response_model=list[MyShipAccess])
async def get_my_ships(
    user: Annotated[dict, Depends(get_current_user)],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get ships accessible to the current user with default panel info.

    - Admins see all ships
    - Other users see only ships they have access to via ship_access table
    - Includes default panel info from crew assignment if any
    """
    if user["role"] == "admin":
        # Admins see all ships, with their own crew default panel if assigned
        cursor = await db.execute(
            """
            SELECT s.id as ship_id, s.name as ship_name, s.ship_class,
                   s.registry as ship_registry,
                   NULL as role_override, 1 as can_edit,
                   c.default_panel_id, p.slug as default_panel_slug
            FROM ships s
            LEFT JOIN crew c ON c.user_id = ? AND c.ship_id = s.id
            LEFT JOIN panels p ON c.default_panel_id = p.id
            ORDER BY s.name
            """,
            (user["user_id"],),
        )
    else:
        # Non-admins see ships from ship_access table
        cursor = await db.execute(
            """
            SELECT sa.ship_id, s.name as ship_name, s.ship_class,
                   s.registry as ship_registry,
                   sa.role_override, sa.can_edit,
                   c.default_panel_id, p.slug as default_panel_slug
            FROM ship_access sa
            JOIN ships s ON sa.ship_id = s.id
            LEFT JOIN crew c ON c.user_id = sa.user_id AND c.ship_id = sa.ship_id
            LEFT JOIN panels p ON c.default_panel_id = p.id
            WHERE sa.user_id = ?
            ORDER BY s.name
            """,
            (user["user_id"],),
        )

    rows = await cursor.fetchall()
    return [dict(row) for row in rows]
