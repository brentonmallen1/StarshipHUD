"""Tests for the System Categories API."""


async def create_category(client, ship_id, name="Power", **kwargs):
    """Helper to create a system category."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "color": kwargs.get("color", "#00ffcc"),
        "sort_order": kwargs.get("sort_order", 0),
    }
    if "id" in kwargs:
        payload["id"] = kwargs["id"]

    resp = await client.post("/api/system-categories", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_system(client, ship_id, name="Reactor", category_id=None):
    """Helper to create a system state."""
    payload = {
        "id": f"test-{name.lower().replace(' ', '-')}",
        "ship_id": ship_id,
        "name": name,
        "status": "operational",
        "value": 100,
        "max_value": 100,
    }
    if category_id:
        payload["category_id"] = category_id

    resp = await client.post("/api/system-states", json=payload)
    assert resp.status_code == 200
    return resp.json()


class TestSystemCategoryCRUD:
    async def test_create_category(self, client, ship):
        cat = await create_category(client, ship["id"], "Weapons", color="#ff0000")
        assert cat["name"] == "Weapons"
        assert cat["color"] == "#ff0000"
        assert cat["ship_id"] == ship["id"]
        assert cat["sort_order"] == 0

    async def test_create_category_with_sort_order(self, client, ship):
        cat = await create_category(client, ship["id"], "Engineering", sort_order=5)
        assert cat["sort_order"] == 5

    async def test_create_category_duplicate_name(self, client, ship):
        await create_category(client, ship["id"], "Power")
        resp = await client.post("/api/system-categories", json={
            "ship_id": ship["id"],
            "name": "Power",
            "color": "#ff0000",
        })
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    async def test_list_categories(self, client, ship):
        await create_category(client, ship["id"], "Cat A", sort_order=1)
        await create_category(client, ship["id"], "Cat B", sort_order=0)

        resp = await client.get(f"/api/system-categories?ship_id={ship['id']}")
        assert resp.status_code == 200
        cats = resp.json()
        assert len(cats) >= 2
        # Should be ordered by sort_order, then name
        assert cats[0]["name"] == "Cat B"  # sort_order 0
        assert cats[1]["name"] == "Cat A"  # sort_order 1

    async def test_get_category(self, client, ship):
        cat = await create_category(client, ship["id"])
        resp = await client.get(f"/api/system-categories/{cat['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == cat["id"]

    async def test_get_category_not_found(self, client):
        resp = await client.get("/api/system-categories/nonexistent")
        assert resp.status_code == 404

    async def test_update_category(self, client, ship):
        cat = await create_category(client, ship["id"])
        resp = await client.patch(f"/api/system-categories/{cat['id']}", json={
            "name": "Updated Name",
            "color": "#00ff00",
            "sort_order": 10,
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"
        assert resp.json()["color"] == "#00ff00"
        assert resp.json()["sort_order"] == 10

    async def test_update_category_duplicate_name(self, client, ship):
        await create_category(client, ship["id"], "Existing")
        cat = await create_category(client, ship["id"], "Other")
        resp = await client.patch(f"/api/system-categories/{cat['id']}", json={
            "name": "Existing",
        })
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    async def test_update_category_not_found(self, client):
        resp = await client.patch("/api/system-categories/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    async def test_delete_category_nullifies_systems(self, client, ship):
        cat = await create_category(client, ship["id"], "Deletable")
        system = await create_system(client, ship["id"], "Linked System", category_id=cat["id"])
        assert system["category_id"] == cat["id"]

        resp = await client.delete(f"/api/system-categories/{cat['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

        # Verify system's category_id is now null
        resp = await client.get(f"/api/system-states/{system['id']}")
        assert resp.json()["category_id"] is None

    async def test_delete_category_not_found(self, client):
        resp = await client.delete("/api/system-categories/nonexistent")
        assert resp.status_code == 404
