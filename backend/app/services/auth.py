"""
Authentication service - password hashing, session management, and auth dependencies.
"""

import hashlib
import hmac
import logging
import os
import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated

import aiosqlite
from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
from nanoid import generate as nanoid
from passlib.context import CryptContext

from app.config import settings
from app.database import DB_PATH, get_db
from app.models.base import Role

logger = logging.getLogger(__name__)

# Password hashing context - use argon2 (modern, secure)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Session cookie name
SESSION_COOKIE_NAME = "starship_hud_session"

# JWT settings
JWT_ALGORITHM = "HS256"

MIN_SECRET_KEY_LENGTH = 32
SECRET_KEY_FILENAME = ".secret_key"
_generated_secret_key: str | None = None


def secret_key_path() -> Path:
    """Where a generated secret key is persisted: next to the SQLite database."""
    return Path(DB_PATH).parent / SECRET_KEY_FILENAME


def _load_or_create_secret_key(path: Path) -> str:
    if path.exists():
        key = path.read_text().strip()
        if key:
            return key
    path.parent.mkdir(parents=True, exist_ok=True)
    key = secrets.token_urlsafe(48)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(key)
    try:
        # link() fails if another process won the race; use theirs.
        os.link(tmp, path)
        logger.info("Generated session secret key at %s", path)
    except FileExistsError:
        key = path.read_text().strip()
    finally:
        tmp.unlink(missing_ok=True)
    return key


def get_secret_key() -> str:
    """Session signing key: SECRET_KEY if set, else one generated once and kept on disk.

    Persisting the generated key means restarts don't invalidate every session.
    """
    global _generated_secret_key
    configured = (settings.secret_key or "").strip()
    if configured:
        return configured
    if _generated_secret_key is None:
        _generated_secret_key = _load_or_create_secret_key(secret_key_path())
    return _generated_secret_key


def validate_secret_key() -> None:
    """Fail startup on a weak configured key when auth is enabled; materialize the key."""
    configured = (settings.secret_key or "").strip()
    if settings.auth_enabled and configured and len(configured) < MIN_SECRET_KEY_LENGTH:
        raise RuntimeError(
            f"SECRET_KEY is {len(configured)} characters; at least {MIN_SECRET_KEY_LENGTH} are required "
            "when AUTH_ENABLED=true. Generate one with: python -c 'import secrets; print(secrets.token_hex(32))' "
            "or leave SECRET_KEY empty to have one generated and stored in the data directory."
        )
    get_secret_key()


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


def create_signed_session_token(session_id: str, user_id: str, token: str) -> str:
    """Create a JWT-signed session token carrying the session ID and its random secret.

    The secret's hash is stored in sessions.token_hash, so a session row alone
    (e.g. from a leaked DB) is not enough to forge a cookie.
    """
    payload = {
        "session_id": session_id,
        "user_id": user_id,
        "tok": token,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, get_secret_key(), algorithm=JWT_ALGORITHM)


def decode_session_token(token: str) -> dict | None:
    """Decode and verify a signed session token. Returns None if invalid."""
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def create_session(db: aiosqlite.Connection, user_id: str) -> str:
    """Create a new session and return the signed token."""
    session_id = nanoid(size=21)
    token = generate_session_token()
    token_hash = hash_token(token)
    expires_at = datetime.now(UTC) + timedelta(days=settings.session_lifetime_days)

    await db.execute(
        """
        INSERT INTO sessions (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (session_id, user_id, token_hash, expires_at.isoformat()),
    )
    await db.commit()

    # Return a signed token that includes session_id and the token secret
    return create_signed_session_token(session_id, user_id, token)


async def validate_session(db: aiosqlite.Connection, token: str) -> dict | None:
    """Validate a session token and return user data if valid."""
    payload = decode_session_token(token)
    if not payload:
        return None

    session_id = payload.get("session_id")
    token_secret = payload.get("tok")
    if not session_id or not isinstance(token_secret, str):
        return None

    cursor = await db.execute(
        """
        SELECT s.id, s.user_id, s.token_hash, s.expires_at, u.username, u.display_name, u.role,
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

    if not hmac.compare_digest(hash_token(token_secret), row["token_hash"]):
        return None

    # Check expiration
    expires_at = datetime.fromisoformat(row["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if datetime.now(UTC) > expires_at:
        return None

    # Check if user is active
    if not row["is_active"]:
        return None

    # Update last activity
    await db.execute(
        "UPDATE sessions SET last_activity_at = ? WHERE id = ?",
        (datetime.now(UTC).isoformat(), session_id),
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
        (datetime.now(UTC).isoformat(),),
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
