"""Tests for the Ship API."""

import pytest


class TestShipCRUD:
    async def test_create_blank_ship(self, client):
        resp = await client.post(
            "/api/ships",
            json={"name": "USS Nova", "ship_class": "Frigate", "seed_type": "blank"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "USS Nova"
        assert data["ship_class"] == "Frigate"
        assert data["id"]

    async def test_create_seeded_ship(self, client):
        resp = await client.post(
            "/api/ships",
            json={"name": "USS Seed", "seed_type": "full"},
        )
        assert resp.status_code == 200
        ship = resp.json()

        # Seeded ship should have system states
        states = await client.get(f"/api/system-states?ship_id={ship['id']}")
        assert states.status_code == 200
        assert len(states.json()) > 0

        # Seeded ship should have panels
        panels = await client.get(f"/api/panels?ship_id={ship['id']}")
        assert panels.status_code == 200
        assert len(panels.json()) > 0

    async def test_list_ships(self, client, ship):
        resp = await client.get("/api/ships")
        assert resp.status_code == 200
        ships = resp.json()
        assert any(s["id"] == ship["id"] for s in ships)

    async def test_get_ship(self, client, ship):
        resp = await client.get(f"/api/ships/{ship['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Ship"

    async def test_get_ship_not_found(self, client):
        resp = await client.get("/api/ships/nonexistent")
        assert resp.status_code == 404

    async def test_update_ship(self, client, ship):
        resp = await client.patch(
            f"/api/ships/{ship['id']}",
            json={"name": "Renamed Ship", "ship_class": "Battlecruiser"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Renamed Ship"
        assert data["ship_class"] == "Battlecruiser"
        # Unchanged fields preserved
        assert data["registry"] == "TST-001"

    async def test_update_ship_not_found(self, client):
        resp = await client.patch(
            "/api/ships/nonexistent", json={"name": "Ghost"}
        )
        assert resp.status_code == 404

    async def test_update_ship_attributes(self, client, ship):
        resp = await client.patch(
            f"/api/ships/{ship['id']}",
            json={"attributes": {"morale": "high", "fuel": 95}},
        )
        assert resp.status_code == 200
        assert resp.json()["attributes"]["morale"] == "high"
        assert resp.json()["attributes"]["fuel"] == 95

    async def test_delete_ship(self, client, ship):
        resp = await client.delete(f"/api/ships/{ship['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

        # Confirm gone
        resp = await client.get(f"/api/ships/{ship['id']}")
        assert resp.status_code == 404

    async def test_delete_ship_not_found(self, client):
        resp = await client.delete("/api/ships/nonexistent")
        assert resp.status_code == 404

    async def test_delete_ship_cascades(self, client, ship):
        """Deleting a ship should cascade-delete panels, system states, etc."""
        ship_id = ship["id"]

        # Create a panel belonging to this ship
        panel_resp = await client.post(
            "/api/panels",
            json={
                "ship_id": ship_id,
                "name": "Bridge",
                "station_group": "command",
                "grid_columns": 24,
                "grid_rows": 8,
                "role_visibility": ["player", "gm"],
            },
        )
        assert panel_resp.status_code == 200
        panel_id = panel_resp.json()["id"]

        # Delete ship
        await client.delete(f"/api/ships/{ship_id}")

        # Panel should be gone
        resp = await client.get(f"/api/panels/{panel_id}")
        assert resp.status_code == 404


class TestPosture:
    async def test_get_posture(self, client, ship):
        resp = await client.get(f"/api/ships/{ship['id']}/posture")
        assert resp.status_code == 200
        data = resp.json()
        assert data["posture"] == "green"
        assert "roe" in data

    async def test_update_posture(self, client, ship):
        resp = await client.patch(
            f"/api/ships/{ship['id']}/posture",
            params={"posture": "red", "reason": "incoming hostiles"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["posture"] == "red"
        assert data["roe"]["weapons_safeties"] == "off"

    async def test_update_posture_silent_running(self, client, ship):
        resp = await client.patch(
            f"/api/ships/{ship['id']}/posture",
            params={"posture": "silent_running"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["posture"] == "silent_running"
        assert data["roe"]["transponder"] == "off"
        assert data["roe"]["comms_broadcast"] == "silent"

    async def test_update_posture_invalid(self, client, ship):
        resp = await client.patch(
            f"/api/ships/{ship['id']}/posture",
            params={"posture": "invalid_posture"},
        )
        assert resp.status_code == 400

    async def test_posture_change_emits_event(self, client, ship):
        await client.patch(
            f"/api/ships/{ship['id']}/posture",
            params={"posture": "yellow"},
        )

        events = await client.get(
            f"/api/events?ship_id={ship['id']}&type=posture_changed"
        )
        assert events.status_code == 200
        event_list = events.json()
        assert len(event_list) >= 1
        assert any("YELLOW" in e["message"] for e in event_list)
