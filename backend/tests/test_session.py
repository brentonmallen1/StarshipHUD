"""Tests for the Session API (ship selection via cookies)."""


class TestSession:
    async def test_set_ship(self, client, ship):
        resp = await client.post("/api/session/ship", json={"ship_id": ship["id"]})
        assert resp.status_code == 200
        assert resp.json()["ship_id"] == ship["id"]

    async def test_get_ship_no_cookie(self, client):
        resp = await client.get("/api/session/ship")
        assert resp.status_code == 200
        assert resp.json()["ship_id"] is None

    async def test_get_ship_with_cookie(self, client, ship):
        # Set the cookie first
        await client.post("/api/session/ship", json={"ship_id": ship["id"]})

        # Read it back (httpx client preserves cookies)
        resp = await client.get("/api/session/ship")
        assert resp.status_code == 200
        assert resp.json()["ship_id"] == ship["id"]

    async def test_clear_ship(self, client, ship):
        await client.post("/api/session/ship", json={"ship_id": ship["id"]})
        resp = await client.delete("/api/session/ship")
        assert resp.status_code == 200
        assert resp.json()["ship_id"] is None

    async def test_set_and_get_roundtrip(self, client, ship):
        """Verify full set → get → clear → get cycle."""
        await client.post("/api/session/ship", json={"ship_id": ship["id"]})
        resp = await client.get("/api/session/ship")
        assert resp.json()["ship_id"] == ship["id"]

        await client.delete("/api/session/ship")
        resp = await client.get("/api/session/ship")
        assert resp.json()["ship_id"] is None
