"""Tests for the Cargo Categories API."""


async def create_category(client, ship_id, name="Supplies", **kwargs):
    """Helper to create a cargo category."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "color": kwargs.get("color", "#888888"),
    }
    if "id" in kwargs:
        payload["id"] = kwargs["id"]

    resp = await client.post("/api/cargo-categories", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_cargo(client, ship_id, name="Item", category_id=None):
    """Helper to create a cargo item."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "size_class": "small",
        "shape_variant": 0,
    }
    if category_id:
        payload["category_id"] = category_id

    resp = await client.post("/api/cargo", json=payload)
    assert resp.status_code == 200
    return resp.json()


class TestCargoCategoryCRUD:
    async def test_create_category(self, client, ship):
        cat = await create_category(client, ship["id"], "Weapons", color="#ff0000")
        assert cat["name"] == "Weapons"
        assert cat["color"] == "#ff0000"
        assert cat["ship_id"] == ship["id"]

    async def test_create_category_duplicate_name(self, client, ship):
        await create_category(client, ship["id"], "Ammo")
        resp = await client.post("/api/cargo-categories", json={
            "ship_id": ship["id"],
            "name": "Ammo",
            "color": "#ff0000",
        })
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    async def test_list_categories(self, client, ship):
        await create_category(client, ship["id"], "Cat A")
        await create_category(client, ship["id"], "Cat B")

        resp = await client.get(f"/api/cargo-categories?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_get_category(self, client, ship):
        cat = await create_category(client, ship["id"])
        resp = await client.get(f"/api/cargo-categories/{cat['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == cat["id"]

    async def test_get_category_not_found(self, client):
        resp = await client.get("/api/cargo-categories/nonexistent")
        assert resp.status_code == 404

    async def test_update_category(self, client, ship):
        cat = await create_category(client, ship["id"])
        resp = await client.patch(f"/api/cargo-categories/{cat['id']}", json={
            "name": "Updated Name",
            "color": "#00ff00",
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"
        assert resp.json()["color"] == "#00ff00"

    async def test_update_category_duplicate_name(self, client, ship):
        await create_category(client, ship["id"], "Existing")
        cat = await create_category(client, ship["id"], "Other")
        resp = await client.patch(f"/api/cargo-categories/{cat['id']}", json={
            "name": "Existing",
        })
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    async def test_update_category_not_found(self, client):
        resp = await client.patch("/api/cargo-categories/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    async def test_delete_category_nullifies_cargo(self, client, ship):
        cat = await create_category(client, ship["id"], "Deletable")
        cargo = await create_cargo(client, ship["id"], "Linked Item", category_id=cat["id"])
        assert cargo["category_id"] == cat["id"]

        resp = await client.delete(f"/api/cargo-categories/{cat['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

        # Verify cargo's category_id is now null
        resp = await client.get(f"/api/cargo/{cargo['id']}")
        assert resp.json()["category_id"] is None

    async def test_delete_category_not_found(self, client):
        resp = await client.delete("/api/cargo-categories/nonexistent")
        assert resp.status_code == 404
