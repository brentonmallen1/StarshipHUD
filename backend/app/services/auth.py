"""
Authentication service - password hashing, session management, and auth dependencies.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

import aiosqlite
from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
from nanoid import generate as nanoid
from passlib.context import CryptContext

from app.config import settings
from app.database import get_db
from app.models.base import Role

# Password hashing context - use argon2 (modern, secure)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Session cookie name
SESSION_COOKIE_NAME = "starship_hud_session"

# JWT settings
JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def generate_session_token() -> str:
    """Generate a cryptographically secure session token."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Hash a session token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_random_password(length: int = 16) -> str:
    """Generate a random password for admin bootstrap or password resets."""
    return secrets.token_urlsafe(length)


def create_signed_session_token(session_id: str, user_id: str) -> str:
    """Create a JWT-signed session token containing session ID and user ID."""
    payload = {
        "session_id": session_id,
        "user_id": user_id,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_session_token(token: str) -> dict | None:
    """Decode and verify a signed session token. Returns None if invalid."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def create_session(db: aiosqlite.Connection, user_id: str) -> str:
    """Create a new session and return the signed token."""
    session_id = nanoid(size=21)
    token = generate_session_token()
    token_hash = hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.session_lifetime_days)

    await db.execute(
        """
        INSERT INTO sessions (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (session_id, user_id, token_hash, expires_at.isoformat()),
    )
    await db.commit()

    # Return a signed token that includes session_id
    return create_signed_session_token(session_id, user_id)


async def validate_session(db: aiosqlite.Connection, token: str) -> dict | None:
    """Validate a session token and return user data if valid."""
    payload = decode_session_token(token)
    if not payload:
        return None

    session_id = payload.get("session_id")
    if not session_id:
        return None

    cursor = await db.execute(
        """
        SELECT s.id, s.user_id, s.expires_at, u.username, u.display_name, u.role,
               u.is_active, u.must_change_password
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
        """,
        (session_id,),
    )
    row = await cursor.fetchone()

    if not row:
        return None

    # Check expiration
    expires_at = datetime.fromisoformat(row["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        return None

    # Check if user is active
    if not row["is_active"]:
        return None

    # Update last activity
    await db.execute(
        "UPDATE sessions SET last_activity_at = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), session_id),
    )
    await db.commit()

    return {
        "session_id": row["id"],
        "user_id": row["user_id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "role": row["role"],
        "must_change_password": bool(row["must_change_password"]),
    }


async def invalidate_session(db: aiosqlite.Connection, session_id: str) -> None:
    """Invalidate (delete) a session."""
    await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    await db.commit()


async def invalidate_all_user_sessions(db: aiosqlite.Connection, user_id: str) -> None:
    """Invalidate all sessions for a user (e.g., on password change)."""
    await db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    await db.commit()


async def cleanup_expired_sessions(db: aiosqlite.Connection) -> int:
    """Remove expired sessions. Returns count of removed sessions."""
    cursor = await db.execute(
        "DELETE FROM sessions WHERE expires_at < ?",
        (datetime.now(timezone.utc).isoformat(),),
    )
    await db.commit()
    return cursor.rowcount


# Role hierarchy helpers
ROLE_HIERARCHY = {Role.ADMIN: 3, Role.GM: 2, Role.PLAYER: 1}


def has_role_access(user_role: Role, required_role: Role) -> bool:
    """Check if user_role has sufficient privileges for required_role."""
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(required_role, 0)


# FastAPI dependencies for auth


async def get_current_user_optional(
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict | None:
    """Get current user from session cookie, or None if not authenticated.

    Use this dependency when auth is optional.
    """
    if not settings.auth_enabled:
        # When auth is disabled, return a mock admin user for backward compatibility
        return {
            "user_id": "system",
            "username": "system",
            "display_name": "System",
            "role": Role.ADMIN,
            "must_change_password": False,
        }

    if not session_token:
        return None

    return await validate_session(db, session_token)


async def get_current_user(
    user: Annotated[dict | None, Depends(get_current_user_optional)],
) -> dict:
    """Get current user, raising 401 if not authenticated.

    Use this dependency when auth is required.
    """
    if not settings.auth_enabled:
        # Return mock admin when auth is disabled
        return {
            "user_id": "system",
            "username": "system",
            "display_name": "System",
            "role": Role.ADMIN,
            "must_change_password": False,
        }

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user


def require_role(required_role: Role):
    """Factory for role-checking dependency.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: dict = Depends(require_role(Role.ADMIN))):
            ...
    """

    async def check_role(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if not settings.auth_enabled:
            return user

        user_role = Role(user["role"])
        if not has_role_access(user_role, required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role.value} role or higher",
            )
        return user

    return check_role


async def get_ship_access(
    db: aiosqlite.Connection, user_id: str, ship_id: str
) -> dict | None:
    """Get user's access to a specific ship."""
    cursor = await db.execute(
        """
        SELECT sa.role_override, sa.can_edit, u.role as user_role
        FROM ship_access sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.user_id = ? AND sa.ship_id = ?
        """,
        (user_id, ship_id),
    )
    row = await cursor.fetchone()
    if not row:
        return None

    return {
        "role_override": row["role_override"],
        "can_edit": bool(row["can_edit"]),
        "user_role": row["user_role"],
    }


def get_effective_role(user: dict, ship_access: dict | None) -> Role:
    """Calculate effective role for a user on a specific ship."""
    user_role = Role(user["role"])

    # Admin always has full access
    if user_role == Role.ADMIN:
        return Role.ADMIN

    # If no ship access record, use global role
    if not ship_access:
        return user_role

    # Use role_override if set, otherwise user's global role
    if ship_access["role_override"]:
        return Role(ship_access["role_override"])

    return user_role
