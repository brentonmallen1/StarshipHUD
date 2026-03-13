"""
Ship access API endpoints.

Admins can manage access for any ship.
GMs can manage player access for ships where they have role_override='gm'.
"""

from datetime import datetime, timezone

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status
from nanoid import generate as nanoid

from app.database import get_db
from app.models.base import Role
from app.models.user import (
    ShipAccessCreate,
    ShipAccessUpdate,
    ShipAccessWithUser,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/ships/{ship_id}/access", tags=["ship_access"])


async def require_ship_manager(
    ship_id: str,
    user: dict,
    db: aiosqlite.Connection,
) -> bool:
    """
    Check if user can manage access for this ship.
    Returns True if admin, False if GM (to indicate restricted permissions).
    Raises 403 if neither.
    """
    if user["role"] == "admin":
        return True  # Admin has full permissions

    # Check if user is GM for this ship
    cursor = await db.execute(
        "SELECT role_override FROM ship_access WHERE user_id = ? AND ship_id = ?",
        (user["user_id"], ship_id),
    )
    row = await cursor.fetchone()
    if row and row["role_override"] == "gm":
        return False  # GM has restricted permissions (can't grant GM role)

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to manage this ship's access",
    )


@router.get("", response_model=list[ShipAccessWithUser])
async def list_ship_access(
    ship_id: str,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all users with access to a ship (admin or ship GM)."""
    await require_ship_manager(ship_id, user, db)
    # Verify ship exists
    cursor = await db.execute("SELECT id FROM ships WHERE id = ?", (ship_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ship not found",
        )

    cursor = await db.execute(
        """
        SELECT sa.id, sa.user_id, sa.ship_id, sa.role_override, sa.can_edit, sa.created_at,
               u.username, u.display_name, u.role as user_role
        FROM ship_access sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.ship_id = ?
        ORDER BY u.username
        """,
        (ship_id,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("", response_model=ShipAccessWithUser, status_code=status.HTTP_201_CREATED)
async def grant_ship_access(
    ship_id: str,
    data: ShipAccessCreate,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Grant a user access to a ship (admin or ship GM)."""
    is_admin = await require_ship_manager(ship_id, user, db)

    # GMs cannot grant GM role override - only admins can
    if not is_admin and data.role_override == Role.GM:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can grant GM access to ships",
        )

    # Verify ship exists
    cursor = await db.execute("SELECT id FROM ships WHERE id = ?", (ship_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ship not found",
        )

    # Verify user exists
    cursor = await db.execute(
        "SELECT id, username, display_name, role FROM users WHERE id = ?",
        (data.user_id,),
    )
    user_row = await cursor.fetchone()
    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if access already exists
    cursor = await db.execute(
        "SELECT id FROM ship_access WHERE user_id = ? AND ship_id = ?",
        (data.user_id, ship_id),
    )
    if await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already has access to this ship",
        )

    access_id = nanoid(size=21)
    now = datetime.now(timezone.utc).isoformat()

    await db.execute(
        """
        INSERT INTO ship_access (id, user_id, ship_id, role_override, can_edit, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            access_id,
            data.user_id,
            ship_id,
            data.role_override.value if data.role_override else None,
            1 if data.can_edit else 0,
            now,
        ),
    )
    await db.commit()

    return {
        "id": access_id,
        "user_id": data.user_id,
        "ship_id": ship_id,
        "role_override": data.role_override,
        "can_edit": data.can_edit,
        "created_at": now,
        "username": user_row["username"],
        "display_name": user_row["display_name"],
        "user_role": user_row["role"],
    }


@router.patch("/{user_id}", response_model=ShipAccessWithUser)
async def update_ship_access(
    ship_id: str,
    user_id: str,
    data: ShipAccessUpdate,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a user's ship access settings (admin or ship GM)."""
    is_admin = await require_ship_manager(ship_id, user, db)

    # GMs cannot set GM role override - only admins can
    if not is_admin and data.role_override == Role.GM:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can grant GM access to ships",
        )
    cursor = await db.execute(
        """
        SELECT sa.id, u.username, u.display_name, u.role as user_role
        FROM ship_access sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.user_id = ? AND sa.ship_id = ?
        """,
        (user_id, ship_id),
    )
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ship access not found",
        )

    # Build update query
    updates = []
    values = []
    if data.role_override is not None:
        updates.append("role_override = ?")
        values.append(data.role_override.value if data.role_override else None)
    if data.can_edit is not None:
        updates.append("can_edit = ?")
        values.append(1 if data.can_edit else 0)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    values.extend([user_id, ship_id])
    await db.execute(
        f"UPDATE ship_access SET {', '.join(updates)} WHERE user_id = ? AND ship_id = ?",
        values,
    )
    await db.commit()

    # Return updated access
    cursor = await db.execute(
        """
        SELECT sa.id, sa.user_id, sa.ship_id, sa.role_override, sa.can_edit, sa.created_at,
               u.username, u.display_name, u.role as user_role
        FROM ship_access sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.user_id = ? AND sa.ship_id = ?
        """,
        (user_id, ship_id),
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_ship_access(
    ship_id: str,
    user_id: str,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Revoke a user's access to a ship (admin or ship GM)."""
    is_admin = await require_ship_manager(ship_id, user, db)

    # Check if access exists and get role_override
    cursor = await db.execute(
        "SELECT id, role_override FROM ship_access WHERE user_id = ? AND ship_id = ?",
        (user_id, ship_id),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ship access not found",
        )

    # GMs cannot revoke GM access - only admins can
    if not is_admin and row["role_override"] == "gm":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can revoke GM access",
        )

    await db.execute(
        "DELETE FROM ship_access WHERE user_id = ? AND ship_id = ?",
        (user_id, ship_id),
    )
    await db.commit()
