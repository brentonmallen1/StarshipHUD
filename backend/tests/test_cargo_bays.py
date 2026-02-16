"""Tests for the Cargo Bays API."""


async def create_bay(client, ship_id, name="Cargo Bay 1", **kwargs):
    """Helper to create a cargo bay."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "bay_size": kwargs.get("bay_size", "medium"),
    }
    for key in ("width", "height", "sort_order", "id"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post("/api/cargo-bays", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_cargo(client, ship_id, name="Crate", **kwargs):
    """Helper to create a cargo item."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "size_class": kwargs.get("size_class", "tiny"),
        "shape_variant": kwargs.get("shape_variant", 0),
    }
    resp = await client.post("/api/cargo", json=payload)
    assert resp.status_code == 200
    return resp.json()


class TestCargoBayCRUD:
    async def test_create_bay_medium(self, client, ship):
        bay = await create_bay(client, ship["id"], bay_size="medium")
        assert bay["name"] == "Cargo Bay 1"
        assert bay["bay_size"] == "medium"
        assert bay["width"] == 8
        assert bay["height"] == 6

    async def test_create_bay_small(self, client, ship):
        bay = await create_bay(client, ship["id"], bay_size="small")
        assert bay["width"] == 6
        assert bay["height"] == 4

    async def test_create_bay_large(self, client, ship):
        bay = await create_bay(client, ship["id"], bay_size="large")
        assert bay["width"] == 10
        assert bay["height"] == 8

    async def test_create_bay_custom(self, client, ship):
        bay = await create_bay(client, ship["id"], bay_size="custom", width=12, height=10)
        assert bay["bay_size"] == "custom"
        assert bay["width"] == 12
        assert bay["height"] == 10

    async def test_list_bays(self, client, ship):
        await create_bay(client, ship["id"], "Bay A")
        await create_bay(client, ship["id"], "Bay B")

        resp = await client.get(f"/api/cargo-bays?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_get_bay(self, client, ship):
        bay = await create_bay(client, ship["id"])
        resp = await client.get(f"/api/cargo-bays/{bay['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == bay["id"]

    async def test_get_bay_not_found(self, client):
        resp = await client.get("/api/cargo-bays/nonexistent")
        assert resp.status_code == 404

    async def test_update_bay(self, client, ship):
        bay = await create_bay(client, ship["id"])
        resp = await client.patch(f"/api/cargo-bays/{bay['id']}", json={
            "name": "Updated Bay",
            "sort_order": 5,
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Bay"
        assert resp.json()["sort_order"] == 5

    async def test_update_bay_preset_applies_dimensions(self, client, ship):
        bay = await create_bay(client, ship["id"], bay_size="medium")
        resp = await client.patch(f"/api/cargo-bays/{bay['id']}", json={
            "bay_size": "large",
        })
        updated = resp.json()
        assert updated["bay_size"] == "large"
        assert updated["width"] == 10
        assert updated["height"] == 8

    async def test_update_bay_not_found(self, client):
        resp = await client.patch("/api/cargo-bays/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    async def test_delete_bay(self, client, ship):
        bay = await create_bay(client, ship["id"])
        resp = await client.delete(f"/api/cargo-bays/{bay['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_bay_not_found(self, client):
        resp = await client.delete("/api/cargo-bays/nonexistent")
        assert resp.status_code == 404


class TestCargoBayWithPlacements:
    async def test_get_bay_with_placements(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"], "Test Crate")

        await client.post("/api/cargo-placements", json={
            "cargo_id": cargo["id"],
            "bay_id": bay["id"],
            "x": 0, "y": 0,
        })

        resp = await client.get(f"/api/cargo-bays/{bay['id']}/with-placements")
        assert resp.status_code == 200
        result = resp.json()
        assert len(result["placements"]) == 1
        assert result["placements"][0]["cargo"]["name"] == "Test Crate"

    async def test_get_bay_with_placements_empty(self, client, ship):
        bay = await create_bay(client, ship["id"])
        resp = await client.get(f"/api/cargo-bays/{bay['id']}/with-placements")
        assert resp.status_code == 200
        assert resp.json()["placements"] == []

    async def test_get_bay_with_placements_not_found(self, client):
        resp = await client.get("/api/cargo-bays/nonexistent/with-placements")
        assert resp.status_code == 404
