"""Tests for the Cargo Placements API (polyomino cargo management)."""


async def create_bay(client, ship_id, name="Bay 1", **kwargs):
    """Helper to create a cargo bay."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "bay_size": kwargs.get("bay_size", "medium"),
    }
    for key in ("width", "height"):
        if key in kwargs:
            payload[key] = kwargs[key]
    resp = await client.post("/api/cargo-bays", json=payload)
    assert resp.status_code == 200
    return resp.json()


async def create_cargo(client, ship_id, name="Crate", **kwargs):
    """Helper to create a cargo item."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "size_class": kwargs.get("size_class", "tiny"),
        "shape_variant": kwargs.get("shape_variant", 0),
    }
    for key in ("color", "id"):
        if key in kwargs:
            payload[key] = kwargs[key]
    resp = await client.post("/api/cargo", json=payload)
    assert resp.status_code == 200
    return resp.json()


async def create_placement(client, cargo_id, bay_id, x=0, y=0, **kwargs):
    """Helper to create a cargo placement."""
    payload = {
        "cargo_id": cargo_id,
        "bay_id": bay_id,
        "x": x,
        "y": y,
        "rotation": kwargs.get("rotation", 0),
    }
    resp = await client.post("/api/cargo-placements", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestCargoPlacementCRUD:
    async def test_create_placement(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"])
        placement = await create_placement(client, cargo["id"], bay["id"], x=1, y=2)
        assert placement["cargo_id"] == cargo["id"]
        assert placement["bay_id"] == bay["id"]
        assert placement["x"] == 1
        assert placement["y"] == 2

    async def test_list_placements(self, client, ship):
        bay = await create_bay(client, ship["id"])
        c1 = await create_cargo(client, ship["id"], "C1")
        c2 = await create_cargo(client, ship["id"], "C2")
        await create_placement(client, c1["id"], bay["id"], x=0, y=0)
        await create_placement(client, c2["id"], bay["id"], x=2, y=0)

        resp = await client.get(f"/api/cargo-placements?bay_id={bay['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_list_placements_by_cargo(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"])
        await create_placement(client, cargo["id"], bay["id"])

        resp = await client.get(f"/api/cargo-placements?cargo_id={cargo['id']}")
        assert len(resp.json()) == 1

    async def test_get_placement(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"])
        placement = await create_placement(client, cargo["id"], bay["id"])

        resp = await client.get(f"/api/cargo-placements/{placement['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == placement["id"]

    async def test_get_placement_not_found(self, client):
        resp = await client.get("/api/cargo-placements/nonexistent")
        assert resp.status_code == 404

    async def test_delete_placement(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"])
        placement = await create_placement(client, cargo["id"], bay["id"])

        resp = await client.delete(f"/api/cargo-placements/{placement['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_placement_not_found(self, client):
        resp = await client.delete("/api/cargo-placements/nonexistent")
        assert resp.status_code == 404

    async def test_delete_by_cargo(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"])
        await create_placement(client, cargo["id"], bay["id"])

        resp = await client.delete(f"/api/cargo-placements/by-cargo/{cargo['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_by_cargo_not_found(self, client, ship):
        cargo = await create_cargo(client, ship["id"])
        resp = await client.delete(f"/api/cargo-placements/by-cargo/{cargo['id']}")
        assert resp.status_code == 404


class TestCargoPlacementValidation:
    async def test_validate_valid_placement(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"], size_class="tiny")

        resp = await client.post("/api/cargo-placements/validate", json={
            "cargo_id": cargo["id"],
            "bay_id": bay["id"],
            "x": 0, "y": 0,
        })
        assert resp.status_code == 200
        result = resp.json()
        assert result["valid"] is True

    async def test_validate_out_of_bounds(self, client, ship):
        bay = await create_bay(client, ship["id"], bay_size="small")  # 6x4
        cargo = await create_cargo(client, ship["id"], size_class="small", shape_variant=0)  # 3-tile line

        resp = await client.post("/api/cargo-placements/validate", json={
            "cargo_id": cargo["id"],
            "bay_id": bay["id"],
            "x": 5, "y": 0,  # Line extends to x=7, past width=6
        })
        result = resp.json()
        assert result["valid"] is False
        assert "out of bounds" in result["reason"].lower()

    async def test_validate_overlap(self, client, ship):
        bay = await create_bay(client, ship["id"])
        c1 = await create_cargo(client, ship["id"], "C1", size_class="tiny")
        c2 = await create_cargo(client, ship["id"], "C2", size_class="tiny")

        await create_placement(client, c1["id"], bay["id"], x=0, y=0)

        resp = await client.post("/api/cargo-placements/validate", json={
            "cargo_id": c2["id"],
            "bay_id": bay["id"],
            "x": 0, "y": 0,
        })
        result = resp.json()
        assert result["valid"] is False
        assert "overlap" in result["reason"].lower()

    async def test_create_already_placed(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"])
        await create_placement(client, cargo["id"], bay["id"], x=0, y=0)

        resp = await client.post("/api/cargo-placements", json={
            "cargo_id": cargo["id"],
            "bay_id": bay["id"],
            "x": 2, "y": 0,
        })
        assert resp.status_code == 400
        assert "already placed" in resp.json()["detail"].lower()

    async def test_create_out_of_bounds(self, client, ship):
        bay = await create_bay(client, ship["id"], bay_size="small")  # 6x4
        cargo = await create_cargo(client, ship["id"], size_class="small")  # 3-tile

        resp = await client.post("/api/cargo-placements", json={
            "cargo_id": cargo["id"],
            "bay_id": bay["id"],
            "x": 5, "y": 0,
        })
        assert resp.status_code == 400

    async def test_create_overlap(self, client, ship):
        bay = await create_bay(client, ship["id"])
        c1 = await create_cargo(client, ship["id"], "C1")
        c2 = await create_cargo(client, ship["id"], "C2")
        await create_placement(client, c1["id"], bay["id"], x=0, y=0)

        resp = await client.post("/api/cargo-placements", json={
            "cargo_id": c2["id"],
            "bay_id": bay["id"],
            "x": 0, "y": 0,
        })
        assert resp.status_code == 400

    async def test_validate_cargo_not_found(self, client, ship):
        bay = await create_bay(client, ship["id"])
        resp = await client.post("/api/cargo-placements/validate", json={
            "cargo_id": "nonexistent",
            "bay_id": bay["id"],
            "x": 0, "y": 0,
        })
        result = resp.json()
        assert result["valid"] is False
        assert "not found" in result["reason"].lower()

    async def test_validate_bay_not_found(self, client, ship):
        cargo = await create_cargo(client, ship["id"])
        resp = await client.post("/api/cargo-placements/validate", json={
            "cargo_id": cargo["id"],
            "bay_id": "nonexistent",
            "x": 0, "y": 0,
        })
        result = resp.json()
        assert result["valid"] is False
        assert "not found" in result["reason"].lower()


class TestCargoPlacementUpdate:
    async def test_update_position(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"])
        placement = await create_placement(client, cargo["id"], bay["id"], x=0, y=0)

        resp = await client.patch(f"/api/cargo-placements/{placement['id']}", json={
            "x": 3, "y": 2,
        })
        assert resp.status_code == 200
        assert resp.json()["x"] == 3
        assert resp.json()["y"] == 2

    async def test_update_rotation(self, client, ship):
        bay = await create_bay(client, ship["id"])
        cargo = await create_cargo(client, ship["id"], size_class="small")
        placement = await create_placement(client, cargo["id"], bay["id"], x=0, y=0)

        resp = await client.patch(f"/api/cargo-placements/{placement['id']}", json={
            "rotation": 90,
        })
        assert resp.status_code == 200
        assert resp.json()["rotation"] == 90

    async def test_update_overlap(self, client, ship):
        bay = await create_bay(client, ship["id"])
        c1 = await create_cargo(client, ship["id"], "C1")
        c2 = await create_cargo(client, ship["id"], "C2")
        await create_placement(client, c1["id"], bay["id"], x=0, y=0)
        p2 = await create_placement(client, c2["id"], bay["id"], x=3, y=0)

        resp = await client.patch(f"/api/cargo-placements/{p2['id']}", json={"x": 0, "y": 0})
        assert resp.status_code == 400

    async def test_update_placement_not_found(self, client):
        resp = await client.patch("/api/cargo-placements/nonexistent", json={"x": 0})
        assert resp.status_code == 404


class TestShapeDefinitions:
    async def test_get_all_shapes(self, client):
        resp = await client.get("/api/cargo-placements/shapes/all")
        assert resp.status_code == 200
        shapes = resp.json()
        assert "tiny" in shapes
        assert "small" in shapes
        assert "medium" in shapes
        assert "large" in shapes
        assert "huge" in shapes

    async def test_shape_tile_counts(self, client):
        resp = await client.get("/api/cargo-placements/shapes/all")
        shapes = resp.json()
        # tiny = 1 tile, x_small = 2, small = 3, medium = 4, large = 5, x_large = 6, huge = 7
        assert shapes["tiny"][0]["tile_count"] == 1
        assert shapes["x_small"][0]["tile_count"] == 2
        assert shapes["small"][0]["tile_count"] == 3
        assert shapes["medium"][0]["tile_count"] == 4
        assert shapes["large"][0]["tile_count"] == 5
        assert shapes["x_large"][0]["tile_count"] == 6
        assert shapes["huge"][0]["tile_count"] == 7
