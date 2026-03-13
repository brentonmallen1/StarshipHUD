"""
User management API endpoints (admin only).
"""

from datetime import datetime, timezone

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status
from nanoid import generate as nanoid

from app.database import get_db
from app.models.base import Role
from app.models.user import (
    ResetPasswordResponse,
    ShipAccessWithShip,
    UserCreate,
    UserFull,
    UserUpdate,
)
from app.services.auth import (
    generate_random_password,
    hash_password,
    invalidate_all_user_sessions,
    require_role,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserFull])
async def list_users(
    _user: dict = Depends(require_role(Role.ADMIN)),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all users (admin only)."""
    cursor = await db.execute(
        """
        SELECT id, username, display_name, role, is_active,
               must_change_password, last_login_at, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
        """
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/{user_id}", response_model=UserFull)
async def get_user(
    user_id: str,
    _user: dict = Depends(require_role(Role.ADMIN)),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get user by ID (admin only)."""
    cursor = await db.execute(
        """
        SELECT id, username, display_name, role, is_active,
               must_change_password, last_login_at, created_at, updated_at
        FROM users WHERE id = ?
        """,
        (user_id,),
    )
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return dict(row)


@router.post("", response_model=UserFull, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    _user: dict = Depends(require_role(Role.ADMIN)),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new user (admin only)."""
    # Check if username already exists
    cursor = await db.execute(
        "SELECT id FROM users WHERE username = ?",
        (data.username,),
    )
    if await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    user_id = nanoid(size=21)
    now = datetime.now(timezone.utc).isoformat()
    password_hash = hash_password(data.password)

    await db.execute(
        """
        INSERT INTO users (id, username, display_name, password_hash, role,
                          is_active, must_change_password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
        """,
        (
            user_id,
            data.username,
            data.display_name,
            password_hash,
            data.role.value,
            now,
            now,
        ),
    )
    await db.commit()

    return {
        "id": user_id,
        "username": data.username,
        "display_name": data.display_name,
        "role": data.role,
        "is_active": True,
        "must_change_password": False,
        "last_login_at": None,
        "created_at": now,
        "updated_at": now,
    }


@router.patch("/{user_id}", response_model=UserFull)
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: dict = Depends(require_role(Role.ADMIN)),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a user (admin only)."""
    # Prevent admin from demoting themselves
    if user_id == current_user["user_id"] and data.role and data.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    # Prevent admin from deactivating themselves
    if user_id == current_user["user_id"] and data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    # Check user exists
    cursor = await db.execute(
        "SELECT id, username FROM users WHERE id = ?",
        (user_id,),
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check username uniqueness if changing
    if data.username and data.username != existing["username"]:
        cursor = await db.execute(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            (data.username, user_id),
        )
        if await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            )

    # Build update query
    updates = []
    values = []
    if data.username is not None:
        updates.append("username = ?")
        values.append(data.username)
    if data.display_name is not None:
        updates.append("display_name = ?")
        values.append(data.display_name)
    if data.role is not None:
        updates.append("role = ?")
        values.append(data.role.value)
    if data.is_active is not None:
        updates.append("is_active = ?")
        values.append(1 if data.is_active else 0)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    updates.append("updated_at = ?")
    values.append(datetime.now(timezone.utc).isoformat())
    values.append(user_id)

    await db.execute(
        f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
        values,
    )
    await db.commit()

    # Return updated user
    return await get_user(user_id, _user=current_user, db=db)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete a user (admin only)."""
    # Prevent admin from deleting themselves
    if user_id == current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    cursor = await db.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Delete user (cascade will handle sessions and ship_access)
    await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    await db.commit()


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    user_id: str,
    _user: dict = Depends(require_role(Role.ADMIN)),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Reset a user's password to a random temporary password (admin only)."""
    cursor = await db.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Generate temporary password
    temp_password = generate_random_password(12)
    password_hash = hash_password(temp_password)

    # Update password and set must_change_password
    await db.execute(
        """
        UPDATE users
        SET password_hash = ?, must_change_password = 1, updated_at = ?
        WHERE id = ?
        """,
        (password_hash, datetime.now(timezone.utc).isoformat(), user_id),
    )

    # Invalidate all existing sessions
    await invalidate_all_user_sessions(db, user_id)
    await db.commit()

    return ResetPasswordResponse(
        temporary_password=temp_password,
    )


@router.get("/{user_id}/ships", response_model=list[ShipAccessWithShip])
async def get_user_ship_access(
    user_id: str,
    _user: dict = Depends(require_role(Role.ADMIN)),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get all ships a user has access to (admin only)."""
    # Verify user exists
    cursor = await db.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    cursor = await db.execute(
        """
        SELECT sa.id, sa.user_id, sa.ship_id, sa.role_override, sa.can_edit, sa.created_at,
               s.name as ship_name, s.ship_class, s.registry as ship_registry
        FROM ship_access sa
        JOIN ships s ON sa.ship_id = s.id
        WHERE sa.user_id = ?
        ORDER BY s.name
        """,
        (user_id,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]
