"""
Tests for authentication and user management API endpoints.
"""

import os
import pytest
from httpx import ASGITransport, AsyncClient

# Set bcrypt to a simpler backend before importing passlib
os.environ.setdefault("PASSLIB_BUILTIN_BCRYPT", "enabled")

from app.database import SCHEMA, get_db
from app.main import app
from app.config import settings
from app.services.auth import hash_password


@pytest.fixture
async def auth_db():
    """Provide an in-memory SQLite database with schema and auth enabled."""
    import aiosqlite

    conn = await aiosqlite.connect(":memory:")
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    await conn.executescript(SCHEMA)
    await conn.commit()
    try:
        yield conn
    finally:
        await conn.close()


@pytest.fixture
async def auth_client(auth_db):
    """Provide an httpx AsyncClient with auth enabled."""
    original_auth_enabled = settings.auth_enabled
    settings.auth_enabled = True

    async def _override_get_db():
        yield auth_db

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    settings.auth_enabled = original_auth_enabled


@pytest.fixture
async def admin_user(auth_db):
    """Create an admin user for testing."""
    from nanoid import generate as nanoid

    user_id = nanoid(size=21)
    password_hash = hash_password("adminpassword")

    await auth_db.execute(
        """
        INSERT INTO users (id, username, display_name, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, 'admin', 1)
        """,
        (user_id, "admin", "Test Admin", password_hash),
    )
    await auth_db.commit()

    return {
        "id": user_id,
        "username": "admin",
        "password": "adminpassword",
    }


@pytest.fixture
async def player_user(auth_db):
    """Create a player user for testing."""
    from nanoid import generate as nanoid

    user_id = nanoid(size=21)
    password_hash = hash_password("playerpassword")

    await auth_db.execute(
        """
        INSERT INTO users (id, username, display_name, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, 'player', 1)
        """,
        (user_id, "player", "Test Player", password_hash),
    )
    await auth_db.commit()

    return {
        "id": user_id,
        "username": "player",
        "password": "playerpassword",
    }


# Auth Status Tests

async def test_auth_status_when_enabled(auth_client):
    """Test /api/auth/status returns enabled status."""
    resp = await auth_client.get("/api/auth/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["auth_enabled"] is True
    assert "session_lifetime_days" in data


# Login Tests

async def test_login_success(auth_client, admin_user):
    """Test successful login returns user info and sets cookie."""
    resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"
    assert "starship_hud_session" in resp.cookies


async def test_login_invalid_username(auth_client, admin_user):
    """Test login with invalid username fails."""
    resp = await auth_client.post(
        "/api/auth/login",
        json={"username": "nonexistent", "password": "password"},
    )
    assert resp.status_code == 401


async def test_login_invalid_password(auth_client, admin_user):
    """Test login with invalid password fails."""
    resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": "wrongpassword"},
    )
    assert resp.status_code == 401


# Me Endpoint Tests

async def test_me_authenticated(auth_client, admin_user):
    """Test /api/auth/me returns user info when authenticated."""
    # Login first
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    assert login_resp.status_code == 200
    cookies = login_resp.cookies

    # Get user info
    resp = await auth_client.get("/api/auth/me", cookies=cookies)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"


async def test_me_unauthenticated(auth_client):
    """Test /api/auth/me returns 401 when not authenticated."""
    resp = await auth_client.get("/api/auth/me")
    assert resp.status_code == 401


# Logout Tests

async def test_logout(auth_client, admin_user):
    """Test logout clears session."""
    # Login
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    cookies = login_resp.cookies

    # Logout
    resp = await auth_client.post("/api/auth/logout", cookies=cookies)
    assert resp.status_code == 200

    # Verify session is invalidated
    me_resp = await auth_client.get("/api/auth/me", cookies=cookies)
    assert me_resp.status_code == 401


# User CRUD Tests (Admin Only)

async def test_list_users_as_admin(auth_client, admin_user, player_user):
    """Test admin can list all users."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.get("/api/users", cookies=cookies)
    assert resp.status_code == 200
    users = resp.json()
    assert len(users) >= 2
    usernames = [u["username"] for u in users]
    assert "admin" in usernames
    assert "player" in usernames


async def test_list_users_as_player_forbidden(auth_client, player_user):
    """Test player cannot list users."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": player_user["username"], "password": player_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.get("/api/users", cookies=cookies)
    assert resp.status_code == 403


async def test_create_user_as_admin(auth_client, admin_user):
    """Test admin can create a new user."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.post(
        "/api/users",
        json={
            "username": "newuser",
            "display_name": "New User",
            "password": "newpassword123",
            "role": "gm",
        },
        cookies=cookies,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["role"] == "gm"


async def test_create_user_duplicate_username(auth_client, admin_user, player_user):
    """Test creating user with duplicate username fails."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.post(
        "/api/users",
        json={
            "username": "player",  # Already exists
            "display_name": "Duplicate",
            "password": "password123",
        },
        cookies=cookies,
    )
    assert resp.status_code == 409


async def test_update_user_as_admin(auth_client, admin_user, player_user):
    """Test admin can update a user."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.patch(
        f"/api/users/{player_user['id']}",
        json={"display_name": "Updated Player"},
        cookies=cookies,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Updated Player"


async def test_delete_user_as_admin(auth_client, admin_user, player_user):
    """Test admin can delete a user."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.delete(
        f"/api/users/{player_user['id']}",
        cookies=cookies,
    )
    assert resp.status_code == 204


async def test_admin_cannot_delete_self(auth_client, admin_user):
    """Test admin cannot delete their own account."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.delete(
        f"/api/users/{admin_user['id']}",
        cookies=cookies,
    )
    assert resp.status_code == 400


async def test_reset_password(auth_client, admin_user, player_user):
    """Test admin can reset a user's password."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": admin_user["username"], "password": admin_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.post(
        f"/api/users/{player_user['id']}/reset-password",
        cookies=cookies,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "temporary_password" in data
    assert len(data["temporary_password"]) >= 8


# Change Password Tests

async def test_change_password(auth_client, player_user):
    """Test user can change their own password."""
    # Login
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": player_user["username"], "password": player_user["password"]},
    )
    cookies = login_resp.cookies

    # Change password
    resp = await auth_client.post(
        "/api/auth/change-password",
        json={
            "current_password": player_user["password"],
            "new_password": "newpassword123",
        },
        cookies=cookies,
    )
    assert resp.status_code == 200

    # Session should be invalidated, so old cookies should fail
    me_resp = await auth_client.get("/api/auth/me", cookies=cookies)
    assert me_resp.status_code == 401

    # Should be able to login with new password
    new_login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": player_user["username"], "password": "newpassword123"},
    )
    assert new_login_resp.status_code == 200


async def test_change_password_wrong_current(auth_client, player_user):
    """Test change password fails with wrong current password."""
    login_resp = await auth_client.post(
        "/api/auth/login",
        json={"username": player_user["username"], "password": player_user["password"]},
    )
    cookies = login_resp.cookies

    resp = await auth_client.post(
        "/api/auth/change-password",
        json={
            "current_password": "wrongpassword",
            "new_password": "newpassword123",
        },
        cookies=cookies,
    )
    assert resp.status_code == 400
