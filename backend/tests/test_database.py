"""
Tests for production database connection setup.

conftest.py builds its own in-memory connection, so these exercise the real
get_db() against a temporary file to make sure pragmas are applied.
"""

import aiosqlite

from app import database
from app.database import SCHEMA


async def _open_via_get_db(monkeypatch, path):
    monkeypatch.setattr(database, "DB_PATH", str(path))
    gen = database.get_db()
    db = await gen.__anext__()
    return gen, db


async def test_get_db_enables_foreign_keys(monkeypatch, tmp_path):
    gen, db = await _open_via_get_db(monkeypatch, tmp_path / "test.db")
    try:
        cursor = await db.execute("PRAGMA foreign_keys")
        assert (await cursor.fetchone())[0] == 1
    finally:
        await gen.aclose()


async def test_get_db_cascades_ship_delete(monkeypatch, tmp_path):
    path = tmp_path / "test.db"
    async with aiosqlite.connect(path) as setup:
        await setup.executescript(SCHEMA)
        await setup.execute("INSERT INTO ships (id, name) VALUES ('s1', 'Test')")
        await setup.execute(
            "INSERT INTO system_states (id, ship_id, name) VALUES ('sys1', 's1', 'Reactor')"
        )
        await setup.commit()

    gen, db = await _open_via_get_db(monkeypatch, path)
    try:
        await db.execute("DELETE FROM ships WHERE id = 's1'")
        await db.commit()
        cursor = await db.execute("SELECT COUNT(*) FROM system_states")
        assert (await cursor.fetchone())[0] == 0
    finally:
        await gen.aclose()
