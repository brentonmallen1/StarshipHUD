"""Tests for the Cargo API."""


async def create_cargo(client, ship_id, name="Spare Parts", **kwargs):
    """Helper to create a cargo item."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "size_class": kwargs.get("size_class", "small"),
        "shape_variant": kwargs.get("shape_variant", 0),
    }
    for key in ("category_id", "notes", "color", "id"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post("/api/cargo", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_category(client, ship_id, name="Supplies"):
    """Helper to create a cargo category."""
    resp = await client.post("/api/cargo-categories", json={
        "ship_id": ship_id,
        "name": name,
        "color": "#888888",
    })
    assert resp.status_code == 200
    return resp.json()


async def create_bay(client, ship_id, name="Bay 1"):
    """Helper to create a cargo bay."""
    resp = await client.post("/api/cargo-bays", json={
        "ship_id": ship_id,
        "name": name,
        "bay_size": "medium",
    })
    assert resp.status_code == 200
    return resp.json()


class TestCargoCRUD:
    async def test_create_cargo(self, client, ship):
        cargo = await create_cargo(client, ship["id"], "Fuel Cells", size_class="medium")
        assert cargo["name"] == "Fuel Cells"
        assert cargo["size_class"] == "medium"
        assert cargo["ship_id"] == ship["id"]

    async def test_create_cargo_with_category(self, client, ship):
        cat = await create_category(client, ship["id"], "Ammunition")
        cargo = await create_cargo(client, ship["id"], category_id=cat["id"])
        assert cargo["category_id"] == cat["id"]

    async def test_list_cargo(self, client, ship):
        await create_cargo(client, ship["id"], "Cargo A")
        await create_cargo(client, ship["id"], "Cargo B")

        resp = await client.get(f"/api/cargo?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_list_cargo_by_category_id(self, client, ship):
        cat = await create_category(client, ship["id"], "Medical")
        await create_cargo(client, ship["id"], "Medkit", category_id=cat["id"])
        await create_cargo(client, ship["id"], "Ammo Box")

        resp = await client.get(f"/api/cargo?ship_id={ship['id']}&category_id={cat['id']}")
        items = resp.json()
        assert all(c["category_id"] == cat["id"] for c in items)

    async def test_list_cargo_unplaced(self, client, ship):
        bay = await create_bay(client, ship["id"])
        placed = await create_cargo(client, ship["id"], "Placed Item", size_class="tiny")
        await create_cargo(client, ship["id"], "Unplaced Item")

        # Place one item
        await client.post("/api/cargo-placements", json={
            "cargo_id": placed["id"],
            "bay_id": bay["id"],
            "x": 0, "y": 0,
        })

        resp = await client.get(f"/api/cargo?ship_id={ship['id']}&unplaced=true")
        items = resp.json()
        assert all(c["id"] != placed["id"] for c in items)

    async def test_get_cargo(self, client, ship):
        cargo = await create_cargo(client, ship["id"])
        resp = await client.get(f"/api/cargo/{cargo['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == cargo["id"]

    async def test_get_cargo_not_found(self, client):
        resp = await client.get("/api/cargo/nonexistent")
        assert resp.status_code == 404

    async def test_update_cargo(self, client, ship):
        cargo = await create_cargo(client, ship["id"])
        resp = await client.patch(f"/api/cargo/{cargo['id']}", json={
            "name": "Updated Name",
            "color": "#ff0000",
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"
        assert resp.json()["color"] == "#ff0000"

    async def test_update_cargo_not_found(self, client):
        resp = await client.patch("/api/cargo/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    async def test_delete_cargo(self, client, ship):
        cargo = await create_cargo(client, ship["id"])
        resp = await client.delete(f"/api/cargo/{cargo['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_cargo_not_found(self, client):
        resp = await client.delete("/api/cargo/nonexistent")
        assert resp.status_code == 404
