"""Tests for the Panels and Widgets API."""



async def create_panel(client, ship_id, name="Test Panel", **kwargs):
    """Helper to create a panel."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "station_group": kwargs.get("station_group", "command"),
        "grid_columns": kwargs.get("grid_columns", 24),
        "grid_rows": kwargs.get("grid_rows", 8),
        "role_visibility": kwargs.get("role_visibility", ["player", "gm"]),
    }
    if "description" in kwargs:
        payload["description"] = kwargs["description"]
    resp = await client.post("/api/panels", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_widget(client, panel_id, widget_type="health_bar", **kwargs):
    """Helper to create a widget."""
    payload = {
        "panel_id": panel_id,
        "widget_type": widget_type,
        "x": kwargs.get("x", 0),
        "y": kwargs.get("y", 0),
        "width": kwargs.get("width", 4),
        "height": kwargs.get("height", 2),
        "config": kwargs.get("config", {}),
        "bindings": kwargs.get("bindings", {}),
        "label": kwargs.get("label"),
    }
    resp = await client.post(f"/api/panels/{panel_id}/widgets", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestPanelCRUD:
    async def test_create_panel(self, client, ship):
        panel = await create_panel(client, ship["id"], "Bridge")
        assert panel["name"] == "Bridge"
        assert panel["station_group"] == "command"
        assert panel["grid_columns"] == 24
        assert panel["role_visibility"] == ["player", "gm"]

    async def test_list_panels(self, client, ship):
        await create_panel(client, ship["id"], "Bridge", station_group="command")
        await create_panel(client, ship["id"], "Engine Room", station_group="engineering")

        resp = await client.get(f"/api/panels?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_list_panels_by_station_group(self, client, ship):
        await create_panel(client, ship["id"], "Bridge", station_group="command")
        await create_panel(client, ship["id"], "Engine Room", station_group="engineering")

        resp = await client.get(f"/api/panels?ship_id={ship['id']}&station_group=command")
        assert resp.status_code == 200
        panels = resp.json()
        assert len(panels) == 1
        assert panels[0]["name"] == "Bridge"

    async def test_list_panels_by_station(self, client, ship):
        await create_panel(client, ship["id"], "Bridge", station_group="command")
        await create_panel(client, ship["id"], "Tactical", station_group="tactical")

        resp = await client.get(f"/api/panels/by-station?ship_id={ship['id']}")
        assert resp.status_code == 200
        grouped = resp.json()
        assert "command" in grouped
        assert "tactical" in grouped
        assert len(grouped["command"]) == 1

    async def test_get_panel_with_widgets(self, client, ship):
        panel = await create_panel(client, ship["id"])
        await create_widget(client, panel["id"], "health_bar")

        resp = await client.get(f"/api/panels/{panel['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Panel"
        assert len(data["widgets"]) == 1
        assert data["widgets"][0]["widget_type"] == "health_bar"

    async def test_get_panel_not_found(self, client):
        resp = await client.get("/api/panels/nonexistent")
        assert resp.status_code == 404

    async def test_update_panel(self, client, ship):
        panel = await create_panel(client, ship["id"])

        resp = await client.patch(
            f"/api/panels/{panel['id']}",
            json={"name": "Updated Bridge", "grid_columns": 12},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Bridge"
        assert data["grid_columns"] == 12

    async def test_update_panel_visibility(self, client, ship):
        panel = await create_panel(client, ship["id"])

        resp = await client.patch(
            f"/api/panels/{panel['id']}",
            json={"role_visibility": ["gm"]},
        )
        assert resp.status_code == 200
        assert resp.json()["role_visibility"] == ["gm"]

    async def test_update_panel_not_found(self, client):
        resp = await client.patch("/api/panels/nonexistent", json={"name": "Ghost"})
        assert resp.status_code == 404

    async def test_delete_panel(self, client, ship):
        panel = await create_panel(client, ship["id"])
        resp = await client.delete(f"/api/panels/{panel['id']}")
        assert resp.status_code == 200

        resp = await client.get(f"/api/panels/{panel['id']}")
        assert resp.status_code == 404

    async def test_delete_panel_cascades_widgets(self, client, ship):
        panel = await create_panel(client, ship["id"])
        widget = await create_widget(client, panel["id"])

        await client.delete(f"/api/panels/{panel['id']}")

        # Widget should be gone (fetching panel returns 404, so verify via list)
        resp = await client.get(f"/api/panels/{panel['id']}/widgets")
        # Panel is gone so widgets list will be empty
        assert resp.status_code == 200
        assert len(resp.json()) == 0


class TestWidgetCRUD:
    async def test_create_widget(self, client, ship):
        panel = await create_panel(client, ship["id"])
        widget = await create_widget(
            client,
            panel["id"],
            "status_display",
            x=2,
            y=1,
            width=6,
            height=3,
            config={"show_label": True},
            label="Engine Status",
        )
        assert widget["widget_type"] == "status_display"
        assert widget["x"] == 2
        assert widget["y"] == 1
        assert widget["width"] == 6
        assert widget["height"] == 3
        assert widget["config"]["show_label"] is True
        assert widget["label"] == "Engine Status"

    async def test_create_widget_panel_not_found(self, client):
        resp = await client.post(
            "/api/panels/nonexistent/widgets",
            json={
                "panel_id": "nonexistent",
                "widget_type": "health_bar",
                "x": 0,
                "y": 0,
                "width": 4,
                "height": 2,
                "config": {},
                "bindings": {},
            },
        )
        assert resp.status_code == 404

    async def test_list_widgets(self, client, ship):
        panel = await create_panel(client, ship["id"])
        await create_widget(client, panel["id"], "health_bar", x=0, y=0)
        await create_widget(client, panel["id"], "status_display", x=4, y=0)

        resp = await client.get(f"/api/panels/{panel['id']}/widgets")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_widget(self, client, ship):
        panel = await create_panel(client, ship["id"])
        widget = await create_widget(client, panel["id"])

        resp = await client.patch(
            f"/api/panels/widgets/{widget['id']}",
            json={"config": {"new_setting": 42}, "label": "Updated Label"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["config"]["new_setting"] == 42
        assert data["label"] == "Updated Label"

    async def test_update_widget_not_found(self, client):
        resp = await client.patch(
            "/api/panels/widgets/nonexistent",
            json={"label": "Ghost"},
        )
        assert resp.status_code == 404

    async def test_delete_widget(self, client, ship):
        panel = await create_panel(client, ship["id"])
        widget = await create_widget(client, panel["id"])

        resp = await client.delete(f"/api/panels/widgets/{widget['id']}")
        assert resp.status_code == 200

        # Verify gone from panel
        resp = await client.get(f"/api/panels/{panel['id']}")
        assert len(resp.json()["widgets"]) == 0


class TestBatchLayout:
    async def test_batch_update_layout(self, client, ship):
        panel = await create_panel(client, ship["id"])
        w1 = await create_widget(client, panel["id"], x=0, y=0, width=4, height=2)
        w2 = await create_widget(client, panel["id"], x=4, y=0, width=4, height=2)

        resp = await client.post(
            f"/api/panels/{panel['id']}/layout",
            json=[
                {"id": w1["id"], "x": 0, "y": 0, "width": 6, "height": 3},
                {"id": w2["id"], "x": 6, "y": 0, "width": 6, "height": 3},
            ],
        )
        assert resp.status_code == 200
        assert resp.json()["updated"] == 2

        # Verify positions updated
        resp = await client.get(f"/api/panels/{panel['id']}")
        widgets = resp.json()["widgets"]
        w1_data = next(w for w in widgets if w["id"] == w1["id"])
        assert w1_data["width"] == 6
        assert w1_data["height"] == 3

    async def test_batch_update_rejects_overlaps(self, client, ship):
        panel = await create_panel(client, ship["id"])
        w1 = await create_widget(client, panel["id"], x=0, y=0, width=4, height=2)
        w2 = await create_widget(client, panel["id"], x=4, y=0, width=4, height=2)

        # Try overlapping layout
        resp = await client.post(
            f"/api/panels/{panel['id']}/layout",
            json=[
                {"id": w1["id"], "x": 0, "y": 0, "width": 6, "height": 3},
                {"id": w2["id"], "x": 3, "y": 0, "width": 6, "height": 3},
            ],
        )
        assert resp.status_code == 400
        assert "overlap" in resp.json()["detail"].lower()

    async def test_batch_update_panel_not_found(self, client):
        resp = await client.post(
            "/api/panels/nonexistent/layout",
            json=[{"id": "w1", "x": 0, "y": 0, "width": 4, "height": 2}],
        )
        assert resp.status_code == 404
