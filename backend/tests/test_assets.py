"""Tests for the Assets API (weapons, drones, probes)."""


import uuid


async def create_system(client, ship_id, name="Weapons Array", **kwargs):
    """Helper to create a system state."""
    payload = {
        "id": kwargs.get("id", str(uuid.uuid4())),
        "ship_id": ship_id,
        "name": name,
        "status": kwargs.get("status", "optimal"),
        "value": kwargs.get("value", 100),
        "max_value": kwargs.get("max_value", 100),
        "unit": kwargs.get("unit", "%"),
        "depends_on": kwargs.get("depends_on", []),
    }

    resp = await client.post("/api/system-states", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_asset(client, ship_id, name="Railgun Alpha", **kwargs):
    """Helper to create an asset."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "asset_type": kwargs.get("asset_type", "railgun"),
    }
    for key in ("status", "ammo_current", "ammo_max", "ammo_type", "range",
                "damage", "accuracy", "fire_mode", "is_armed", "is_ready",
                "mount_location", "depends_on", "id", "cooldown"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post("/api/assets", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestAssetCRUD:
    async def test_create_asset(self, client, ship):
        asset = await create_asset(
            client, ship["id"],
            name="PDC Turret",
            asset_type="railgun",
            ammo_current=1000,
            ammo_max=2000,
            is_armed=True,
            is_ready=True,
            mount_location="dorsal",
        )
        assert asset["name"] == "PDC Turret"
        assert asset["asset_type"] == "railgun"
        assert asset["ammo_current"] == 1000
        assert asset["ammo_max"] == 2000
        assert asset["is_armed"] is True
        assert asset["mount_location"] == "dorsal"

    async def test_create_asset_with_depends_on(self, client, ship):
        system = await create_system(client, ship["id"], "Targeting Computer")
        asset = await create_asset(
            client, ship["id"],
            depends_on=[system["id"]],
        )
        assert system["id"] in asset["depends_on"]

    async def test_create_asset_invalid_depends_on(self, client, ship):
        resp = await client.post("/api/assets", json={
            "ship_id": ship["id"],
            "name": "Bad Weapon",
            "asset_type": "railgun",
            "depends_on": ["nonexistent-system"],
        })
        assert resp.status_code == 400
        assert "Invalid depends_on" in resp.json()["detail"]

    async def test_list_assets(self, client, ship):
        await create_asset(client, ship["id"], "Asset A")
        await create_asset(client, ship["id"], "Asset B")

        resp = await client.get(f"/api/assets?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_list_assets_by_type(self, client, ship):
        await create_asset(client, ship["id"], "Torpedo A", asset_type="torpedo")
        await create_asset(client, ship["id"], "Laser A", asset_type="laser")

        resp = await client.get(f"/api/assets?ship_id={ship['id']}&asset_type=torpedo")
        assets = resp.json()
        assert all(a["asset_type"] == "torpedo" for a in assets)

    async def test_get_asset(self, client, ship):
        asset = await create_asset(client, ship["id"])
        resp = await client.get(f"/api/assets/{asset['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == asset["id"]

    async def test_get_asset_not_found(self, client):
        resp = await client.get("/api/assets/nonexistent")
        assert resp.status_code == 404

    async def test_delete_asset(self, client, ship):
        asset = await create_asset(client, ship["id"])
        resp = await client.delete(f"/api/assets/{asset['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_asset_not_found(self, client):
        resp = await client.delete("/api/assets/nonexistent")
        assert resp.status_code == 404

    async def test_update_asset_fields(self, client, ship):
        asset = await create_asset(client, ship["id"], is_armed=False)
        resp = await client.patch(f"/api/assets/{asset['id']}", json={
            "name": "Updated Weapon",
            "is_armed": True,
            "status": "degraded",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["name"] == "Updated Weapon"
        assert updated["is_armed"] is True
        assert updated["status"] == "degraded"

    async def test_update_asset_not_found(self, client):
        resp = await client.patch("/api/assets/nonexistent", json={"name": "x"})
        assert resp.status_code == 404


class TestAssetEffectiveStatus:
    async def test_standalone_effective_equals_own(self, client, ship):
        asset = await create_asset(client, ship["id"], status="operational")
        assert asset["effective_status"] == "operational"
        assert asset["limiting_parent"] is None

    async def test_parent_caps_child(self, client, ship):
        system = await create_system(client, ship["id"], "Power Grid", status="degraded")
        asset = await create_asset(
            client, ship["id"],
            status="optimal",
            depends_on=[system["id"]],
        )
        assert asset["effective_status"] == "degraded"
        assert asset["limiting_parent"] is not None
        assert asset["limiting_parent"]["id"] == system["id"]

    async def test_worst_parent_wins(self, client, ship):
        good_sys = await create_system(client, ship["id"], "Good System", status="operational")
        bad_sys = await create_system(client, ship["id"], "Bad System", status="critical")
        asset = await create_asset(
            client, ship["id"],
            status="optimal",
            depends_on=[good_sys["id"], bad_sys["id"]],
        )
        assert asset["effective_status"] == "critical"
        assert asset["limiting_parent"]["id"] == bad_sys["id"]

    async def test_update_depends_on(self, client, ship):
        system = await create_system(client, ship["id"], "Reactor", status="compromised")
        asset = await create_asset(client, ship["id"], status="optimal")
        assert asset["effective_status"] == "optimal"

        resp = await client.patch(f"/api/assets/{asset['id']}", json={
            "depends_on": [system["id"]],
        })
        updated = resp.json()
        assert updated["effective_status"] == "compromised"

    async def test_update_depends_on_invalid(self, client, ship):
        asset = await create_asset(client, ship["id"])
        resp = await client.patch(f"/api/assets/{asset['id']}", json={
            "depends_on": ["nonexistent-id"],
        })
        assert resp.status_code == 400


class TestAssetAmmoLogic:
    async def test_ammo_zero_sets_not_ready(self, client, ship):
        asset = await create_asset(
            client, ship["id"],
            ammo_current=10,
            ammo_max=100,
            is_ready=True,
        )
        resp = await client.patch(f"/api/assets/{asset['id']}", json={"ammo_current": 0})
        updated = resp.json()
        assert updated["ammo_current"] == 0
        assert updated["is_ready"] is False


class TestAssetFire:
    async def test_fire_weapon(self, client, ship):
        asset = await create_asset(
            client, ship["id"],
            ammo_current=10,
            ammo_max=100,
            is_armed=True,
            is_ready=True,
            status="operational",
        )
        resp = await client.post(f"/api/assets/{asset['id']}/fire")
        assert resp.status_code == 200
        fired = resp.json()
        assert fired["ammo_current"] == 9
        assert fired["is_ready"] is False

    async def test_fire_energy_weapon_no_ammo(self, client, ship):
        """Energy weapons (ammo_max=0) don't decrement ammo."""
        asset = await create_asset(
            client, ship["id"],
            asset_type="energy_weapon",
            ammo_current=0,
            ammo_max=0,
            is_armed=True,
            is_ready=True,
            status="operational",
        )
        resp = await client.post(f"/api/assets/{asset['id']}/fire")
        assert resp.status_code == 200
        fired = resp.json()
        assert fired["ammo_current"] == 0
        assert fired["is_ready"] is False

    async def test_fire_not_armed(self, client, ship):
        asset = await create_asset(
            client, ship["id"],
            is_armed=False,
            is_ready=True,
        )
        resp = await client.post(f"/api/assets/{asset['id']}/fire")
        assert resp.status_code == 400
        assert "not armed" in resp.json()["detail"]

    async def test_fire_not_ready(self, client, ship):
        asset = await create_asset(
            client, ship["id"],
            is_armed=True,
            is_ready=False,
        )
        resp = await client.post(f"/api/assets/{asset['id']}/fire")
        assert resp.status_code == 400
        assert "not ready" in resp.json()["detail"]

    async def test_fire_no_ammo(self, client, ship):
        asset = await create_asset(
            client, ship["id"],
            ammo_current=0,
            ammo_max=100,
            is_armed=True,
            is_ready=True,
        )
        resp = await client.post(f"/api/assets/{asset['id']}/fire")
        assert resp.status_code == 400
        assert "ammunition" in resp.json()["detail"].lower()

    async def test_fire_destroyed_weapon(self, client, ship):
        asset = await create_asset(
            client, ship["id"],
            ammo_current=10,
            ammo_max=100,
            is_armed=True,
            is_ready=True,
            status="destroyed",
        )
        resp = await client.post(f"/api/assets/{asset['id']}/fire")
        assert resp.status_code == 400
        assert "destroyed" in resp.json()["detail"]

    async def test_fire_not_found(self, client):
        resp = await client.post("/api/assets/nonexistent/fire")
        assert resp.status_code == 404
