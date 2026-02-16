"""Tests for the authentication middleware."""

import aiosqlite
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import SCHEMA, get_db
from app.main import app


@pytest.fixture
async def db():
    """Provide an in-memory SQLite database with schema applied."""
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
async def auth_client(db):
    """Client with auth enabled (token = 'test-token')."""

    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db

    original_token = settings.admin_token
    settings.admin_token = "test-token"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    settings.admin_token = original_token
    app.dependency_overrides.clear()


class TestAuthMiddleware:
    async def test_get_requests_allowed_without_token(self, auth_client):
        resp = await auth_client.get("/api/health")
        assert resp.status_code == 200

    async def test_write_blocked_without_token(self, auth_client):
        resp = await auth_client.post(
            "/api/ships",
            json={"name": "Test", "ship_class": "X", "registry": "T-1", "seed_type": "blank"},
        )
        assert resp.status_code == 403
        assert "Authentication required" in resp.json()["detail"]

    async def test_write_blocked_with_wrong_token(self, auth_client):
        resp = await auth_client.post(
            "/api/ships",
            json={"name": "Test", "ship_class": "X", "registry": "T-1", "seed_type": "blank"},
            headers={"Authorization": "Bearer wrong-token"},
        )
        assert resp.status_code == 403
        assert "Invalid" in resp.json()["detail"]

    async def test_write_allowed_with_correct_token(self, auth_client):
        resp = await auth_client.post(
            "/api/ships",
            json={"name": "Test", "ship_class": "X", "registry": "T-1", "seed_type": "blank"},
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code == 200

    async def test_session_exempt_from_auth(self, auth_client):
        """Session endpoints should work without auth (ship selection is for all roles)."""
        resp = await auth_client.post(
            "/api/session/ship",
            json={"ship_id": "some-id"},
        )
        # Should not be 403 — may be 404 if ship doesn't exist, but not auth-blocked
        assert resp.status_code != 403

    async def test_auth_disabled_when_empty_token(self, auth_client):
        """When admin_token is empty, all writes should pass through."""
        original = settings.admin_token
        settings.admin_token = ""

        resp = await auth_client.post(
            "/api/ships",
            json={"name": "Test", "ship_class": "X", "registry": "T-1", "seed_type": "blank"},
        )
        assert resp.status_code == 200

        settings.admin_token = original
