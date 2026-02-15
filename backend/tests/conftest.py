"""
Shared test fixtures for the Starship HUD backend.

Uses an in-memory SQLite database and httpx AsyncClient for testing.
"""

import pytest
import aiosqlite
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import get_db, SCHEMA
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
async def client(db):
    """Provide an httpx AsyncClient wired to the FastAPI app with test DB."""

    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db

    # Disable auth for tests (empty token = auth disabled)
    original_token = settings.admin_token
    settings.admin_token = ""

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    settings.admin_token = original_token
    app.dependency_overrides.clear()


@pytest.fixture
async def ship(client):
    """Create a blank test ship and return its JSON representation."""
    resp = await client.post(
        "/api/ships",
        json={
            "name": "Test Ship",
            "ship_class": "Test Class",
            "registry": "TST-001",
            "seed_type": "blank",
        },
    )
    assert resp.status_code == 200
    return resp.json()


@pytest.fixture
async def seeded_ship(client):
    """Create a fully-seeded test ship with demo data."""
    resp = await client.post(
        "/api/ships",
        json={
            "name": "Seeded Ship",
            "ship_class": "Explorer",
            "registry": "SED-001",
            "seed_type": "full",
        },
    )
    assert resp.status_code == 200
    return resp.json()
