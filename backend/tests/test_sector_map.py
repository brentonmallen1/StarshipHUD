"""Tests for the Sector Map API."""


async def create_map(client, ship_id, name="Alpha Sector", **kwargs):
    """Helper to create a sector map."""
    payload = {"ship_id": ship_id, "name": name, **kwargs}
    resp = await client.post("/api/sector-maps", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_sprite(client, ship_id, name="Planet X", image_url="/uploads/widget-assets/planet.png", **kwargs):
    """Helper to create a sprite."""
    payload = {"ship_id": ship_id, "name": name, "image_url": image_url, **kwargs}
    resp = await client.post("/api/sector-maps/sprites", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_object(client, map_id, hex_q=0, hex_r=0, **kwargs):
    """Helper to place an object on a map."""
    payload = {"map_id": map_id, "hex_q": hex_q, "hex_r": hex_r, **kwargs}
    resp = await client.post(f"/api/sector-maps/{map_id}/objects", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_waypoint(client, map_id, hex_q=0, hex_r=0, **kwargs):
    """Helper to create a waypoint."""
    payload = {"map_id": map_id, "hex_q": hex_q, "hex_r": hex_r, **kwargs}
    resp = await client.post(f"/api/sector-maps/{map_id}/waypoints", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestSectorMapCRUD:
    async def test_create_map(self, client, ship):
        m = await create_map(client, ship["id"], "Beta Sector")
        assert m["name"] == "Beta Sector"
        assert m["ship_id"] == ship["id"]
        assert m["is_active"] is False
        assert m["hex_size"] == 12

    async def test_create_map_custom_fields(self, client, ship):
        m = await create_map(
            client, ship["id"],
            hex_size=64,
            grid_width=30,
            grid_height=20,
            grid_radius=20,
            background_color="#001133",
            description="Outer rim",
        )
        assert m["hex_size"] == 64
        assert m["grid_width"] == 30
        assert m["grid_radius"] == 20
        assert m["description"] == "Outer rim"

    async def test_create_map_bg_transform_fields(self, client, ship):
        m = await create_map(
            client, ship["id"],
            bg_scale=1.5,
            bg_rotation=45.0,
            bg_offset_x=10.0,
            bg_offset_y=-5.0,
        )
        assert m["bg_scale"] == 1.5
        assert m["bg_rotation"] == 45.0
        assert m["bg_offset_x"] == 10.0
        assert m["bg_offset_y"] == -5.0

    async def test_update_map_bg_transform(self, client, ship):
        m = await create_map(client, ship["id"])
        resp = await client.patch(f"/api/sector-maps/{m['id']}", json={
            "bg_scale": 2.0, "bg_rotation": -90.0
        })
        assert resp.status_code == 200
        assert resp.json()["bg_scale"] == 2.0
        assert resp.json()["bg_rotation"] == -90.0

    async def test_list_maps(self, client, ship):
        await create_map(client, ship["id"], "Map A")
        await create_map(client, ship["id"], "Map B")
        resp = await client.get(f"/api/sector-maps?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_get_map(self, client, ship):
        m = await create_map(client, ship["id"])
        resp = await client.get(f"/api/sector-maps/{m['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == m["id"]
        assert "objects" in data
        assert "sprites" in data
        assert "waypoints" in data

    async def test_get_map_not_found(self, client):
        resp = await client.get("/api/sector-maps/nonexistent")
        assert resp.status_code == 404

    async def test_update_map(self, client, ship):
        m = await create_map(client, ship["id"])
        resp = await client.patch(f"/api/sector-maps/{m['id']}", json={"name": "Updated Name", "hex_size": 56})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"
        assert resp.json()["hex_size"] == 56

    async def test_delete_map(self, client, ship):
        m = await create_map(client, ship["id"])
        resp = await client.delete(f"/api/sector-maps/{m['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

        resp = await client.get(f"/api/sector-maps/{m['id']}")
        assert resp.status_code == 404

    async def test_set_active(self, client, ship):
        m1 = await create_map(client, ship["id"], "Map 1")
        m2 = await create_map(client, ship["id"], "Map 2")

        resp = await client.post(f"/api/sector-maps/{m1['id']}/set-active")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

        # m2 should be inactive
        resp = await client.get(f"/api/sector-maps/{m2['id']}")
        assert resp.json()["is_active"] is False

    async def test_set_active_clears_others(self, client, ship):
        m1 = await create_map(client, ship["id"], "Map 1")
        m2 = await create_map(client, ship["id"], "Map 2")

        await client.post(f"/api/sector-maps/{m1['id']}/set-active")
        await client.post(f"/api/sector-maps/{m2['id']}/set-active")

        resp = await client.get(f"/api/sector-maps/{m1['id']}")
        assert resp.json()["is_active"] is False

    async def test_deactivate(self, client, ship):
        m = await create_map(client, ship["id"])
        await client.post(f"/api/sector-maps/{m['id']}/set-active")
        resp = await client.post(f"/api/sector-maps/{m['id']}/deactivate")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    async def test_get_active_map(self, client, ship):
        m = await create_map(client, ship["id"])
        await client.post(f"/api/sector-maps/{m['id']}/set-active")

        resp = await client.get(f"/api/sector-maps/active?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == m["id"]

    async def test_get_active_map_not_found(self, client, ship):
        resp = await client.get(f"/api/sector-maps/active?ship_id={ship['id']}")
        assert resp.status_code == 404


class TestSectorSpriteCRUD:
    async def test_create_sprite(self, client, ship):
        s = await create_sprite(client, ship["id"], "Kepler Station")
        assert s["name"] == "Kepler Station"
        assert s["ship_id"] == ship["id"]
        assert s["category"] == "other"
        assert s["default_locked"] is False

    async def test_create_sprite_with_category(self, client, ship):
        s = await create_sprite(client, ship["id"], "Jupiter", category="celestial", default_locked=True)
        assert s["category"] == "celestial"
        assert s["default_locked"] is True

    async def test_list_sprites(self, client, ship):
        await create_sprite(client, ship["id"], "A")
        await create_sprite(client, ship["id"], "B")
        resp = await client.get(f"/api/sector-maps/sprites/list?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_update_sprite(self, client, ship):
        s = await create_sprite(client, ship["id"])
        resp = await client.patch(f"/api/sector-maps/sprites/{s['id']}", json={"name": "New Name", "category": "ship"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"
        assert resp.json()["category"] == "ship"

    async def test_delete_sprite(self, client, ship):
        s = await create_sprite(client, ship["id"])
        resp = await client.delete(f"/api/sector-maps/sprites/{s['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True


class TestSectorMapObjects:
    async def test_place_object(self, client, ship):
        m = await create_map(client, ship["id"])
        obj = await create_object(client, m["id"], hex_q=3, hex_r=-1, label="Outpost Alpha")
        assert obj["hex_q"] == 3
        assert obj["hex_r"] == -1
        assert obj["label"] == "Outpost Alpha"
        assert obj["visibility_state"] == "visible"
        assert obj["locked"] is False

    async def test_place_object_with_sprite(self, client, ship):
        m = await create_map(client, ship["id"])
        s = await create_sprite(client, ship["id"])
        obj = await create_object(client, m["id"], sprite_id=s["id"])
        assert obj["sprite_id"] == s["id"]

    async def test_place_object_locked_and_hidden(self, client, ship):
        m = await create_map(client, ship["id"])
        obj = await create_object(client, m["id"], locked=True, visibility_state="hidden")
        assert obj["locked"] is True
        assert obj["visibility_state"] == "hidden"

    async def test_place_object_with_rotation(self, client, ship):
        m = await create_map(client, ship["id"])
        obj = await create_object(client, m["id"], rotation=90.0)
        assert obj["rotation"] == 90.0

    async def test_list_objects(self, client, ship):
        m = await create_map(client, ship["id"])
        await create_object(client, m["id"], hex_q=0, hex_r=0)
        await create_object(client, m["id"], hex_q=1, hex_r=0)
        resp = await client.get(f"/api/sector-maps/{m['id']}/objects")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_list_objects_visible_only(self, client, ship):
        """visible_only=true returns visible + anomaly objects, not hidden."""
        m = await create_map(client, ship["id"])
        await create_object(client, m["id"], hex_q=0, hex_r=0, visibility_state="visible", label="Visible")
        await create_object(client, m["id"], hex_q=1, hex_r=0, visibility_state="hidden", label="Hidden")
        await create_object(client, m["id"], hex_q=2, hex_r=0, visibility_state="anomaly", label="Anomaly")

        resp = await client.get(f"/api/sector-maps/{m['id']}/objects?visible_only=true")
        assert resp.status_code == 200
        objects = resp.json()
        assert len(objects) == 2
        labels = {o["label"] for o in objects}
        assert "Visible" in labels
        assert "Anomaly" in labels
        assert "Hidden" not in labels

    async def test_update_object_position(self, client, ship):
        m = await create_map(client, ship["id"])
        obj = await create_object(client, m["id"], hex_q=0, hex_r=0)
        resp = await client.patch(f"/api/sector-maps/objects/{obj['id']}", json={"hex_q": 5, "hex_r": -3})
        assert resp.status_code == 200
        assert resp.json()["hex_q"] == 5
        assert resp.json()["hex_r"] == -3

    async def test_update_object_visibility_state(self, client, ship):
        m = await create_map(client, ship["id"])
        obj = await create_object(client, m["id"])
        resp = await client.patch(
            f"/api/sector-maps/objects/{obj['id']}",
            json={"visibility_state": "anomaly", "locked": True},
        )
        assert resp.status_code == 200
        assert resp.json()["visibility_state"] == "anomaly"
        assert resp.json()["locked"] is True

    async def test_update_object_rotation(self, client, ship):
        m = await create_map(client, ship["id"])
        obj = await create_object(client, m["id"])
        resp = await client.patch(f"/api/sector-maps/objects/{obj['id']}", json={"rotation": 180.0})
        assert resp.status_code == 200
        assert resp.json()["rotation"] == 180.0

    async def test_delete_object(self, client, ship):
        m = await create_map(client, ship["id"])
        obj = await create_object(client, m["id"])
        resp = await client.delete(f"/api/sector-maps/objects/{obj['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_get_map_includes_objects(self, client, ship):
        m = await create_map(client, ship["id"])
        await create_object(client, m["id"], label="Station One")
        resp = await client.get(f"/api/sector-maps/{m['id']}")
        assert resp.status_code == 200
        objects = resp.json()["objects"]
        assert len(objects) == 1
        assert objects[0]["label"] == "Station One"

    async def test_active_map_filters_hidden_objects(self, client, ship):
        """Player endpoint should return visible + anomaly objects, not hidden."""
        m = await create_map(client, ship["id"])
        await client.post(f"/api/sector-maps/{m['id']}/set-active")
        await create_object(client, m["id"], visibility_state="visible", label="Visible")
        await create_object(client, m["id"], visibility_state="hidden", label="Hidden")
        await create_object(client, m["id"], visibility_state="anomaly", label="Anomaly")

        resp = await client.get(f"/api/sector-maps/active?ship_id={ship['id']}&visible_only=true")
        assert resp.status_code == 200
        objects = resp.json()["objects"]
        assert len(objects) == 2
        labels = {o["label"] for o in objects}
        assert "Visible" in labels
        assert "Anomaly" in labels
        assert "Hidden" not in labels

    async def test_delete_map_cascades_objects(self, client, ship):
        m = await create_map(client, ship["id"])
        await create_object(client, m["id"])
        await client.delete(f"/api/sector-maps/{m['id']}")

        # Objects should be gone too (cascade)
        resp = await client.get(f"/api/sector-maps/{m['id']}/objects")
        assert resp.status_code == 404


class TestSectorMapWaypoints:
    async def test_create_waypoint(self, client, ship):
        m = await create_map(client, ship["id"])
        wp = await create_waypoint(client, m["id"], hex_q=2, hex_r=-1, label="Rally Point")
        assert wp["hex_q"] == 2
        assert wp["hex_r"] == -1
        assert wp["label"] == "Rally Point"
        assert wp["color"] == "#ffff00"
        assert wp["created_by"] == "gm"
        assert wp["map_id"] == m["id"]

    async def test_create_player_waypoint(self, client, ship):
        m = await create_map(client, ship["id"])
        wp = await create_waypoint(client, m["id"], hex_q=0, hex_r=0, created_by="player")
        assert wp["created_by"] == "player"

    async def test_list_waypoints(self, client, ship):
        m = await create_map(client, ship["id"])
        await create_waypoint(client, m["id"], hex_q=0, hex_r=0)
        await create_waypoint(client, m["id"], hex_q=1, hex_r=0)
        resp = await client.get(f"/api/sector-maps/{m['id']}/waypoints")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_waypoint(self, client, ship):
        m = await create_map(client, ship["id"])
        wp = await create_waypoint(client, m["id"])
        resp = await client.patch(
            f"/api/sector-maps/waypoints/{wp['id']}",
            json={"label": "Updated", "color": "#ff0000"},
        )
        assert resp.status_code == 200
        assert resp.json()["label"] == "Updated"
        assert resp.json()["color"] == "#ff0000"

    async def test_delete_waypoint(self, client, ship):
        m = await create_map(client, ship["id"])
        wp = await create_waypoint(client, m["id"])
        resp = await client.delete(f"/api/sector-maps/waypoints/{wp['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_get_map_includes_waypoints(self, client, ship):
        m = await create_map(client, ship["id"])
        await create_waypoint(client, m["id"], hex_q=3, hex_r=2, label="Point Bravo")
        resp = await client.get(f"/api/sector-maps/{m['id']}")
        assert resp.status_code == 200
        waypoints = resp.json()["waypoints"]
        assert len(waypoints) == 1
        assert waypoints[0]["label"] == "Point Bravo"

    async def test_active_map_includes_waypoints(self, client, ship):
        m = await create_map(client, ship["id"])
        await client.post(f"/api/sector-maps/{m['id']}/set-active")
        await create_waypoint(client, m["id"], label="Marker")
        resp = await client.get(f"/api/sector-maps/active?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()["waypoints"]) == 1

    async def test_waypoints_cascade_on_map_delete(self, client, ship):
        m = await create_map(client, ship["id"])
        await create_waypoint(client, m["id"])
        await client.delete(f"/api/sector-maps/{m['id']}")

        # Map is gone so waypoints endpoint returns 404
        resp = await client.get(f"/api/sector-maps/{m['id']}/waypoints")
        assert resp.status_code == 404

    async def test_waypoint_not_found(self, client):
        resp = await client.delete("/api/sector-maps/waypoints/nonexistent")
        assert resp.status_code == 404
