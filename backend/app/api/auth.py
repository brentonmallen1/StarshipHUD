"""
Authentication API endpoints.
"""

from datetime import datetime, timezone
from typing import Annotated

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.config import settings
from app.database import get_db
from app.models.user import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
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


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    response: Response,
    user: Annotated[dict, Depends(get_current_user)],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Change current user's password."""
    if not settings.auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is not enabled",
        )

    # Get current password hash
    cursor = await db.execute(
        "SELECT password_hash FROM users WHERE id = ?",
        (user["user_id"],),
    )
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify current password
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
