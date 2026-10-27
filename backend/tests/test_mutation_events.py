"""
Events emitted by state-changing mutations (app/services/events.py).

Player-visible changes are transmitted; GM authoring (hidden content, layout,
presets) is logged for the GM but never transmitted; pure moves aren't logged.
"""

from app.services.events import SYSTEM_EVENT_CAP, emit_event


async def events_of(client, ship_id, event_type=None):
    resp = await client.get("/api/events", params={"ship_id": ship_id, "limit": 500})
    assert resp.status_code == 200
    return [e for e in resp.json() if event_type is None or e["type"] == event_type]


async def post_ok(client, path, payload):
    resp = await client.post(path, json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def patch_ok(client, path, payload):
    resp = await client.patch(path, json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestEmitEvent:
    async def test_defaults_and_no_commit(self, db, ship):
        event_id = await emit_event(db, ship["id"], "alert", "Hello")
        await db.rollback()
        cursor = await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))
        assert await cursor.fetchone() is None  # caller owns the transaction

        event_id = await emit_event(db, ship["id"], "alert", "Hello", data={"a": 1}, transmitted=False)
        await db.commit()
        row = await (await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))).fetchone()
        assert (row["severity"], row["transmitted"], row["source"], row["data"]) == ("info", 0, "system", '{"a": 1}')

    async def test_prunes_system_events_beyond_cap(self, db, ship):
        for i in range(SYSTEM_EVENT_CAP + 5):
            await emit_event(db, ship["id"], "alert", f"#{i}", created_at=f"2024-01-01T00:{i // 60:02d}:{i % 60:02d}")
        await emit_event(db, ship["id"], "log_entry", "kept", source="gm", created_at="2000-01-01T00:00:00")
        cursor = await db.execute(
            "SELECT source, COUNT(*) AS n FROM events WHERE ship_id = ? GROUP BY source", (ship["id"],)
        )
        counts = {r["source"]: r["n"] for r in await cursor.fetchall()}
        assert counts == {"system": SYSTEM_EVENT_CAP, "gm": 1}


class TestPlayerVisibleChanges:
    async def test_cargo_lifecycle_is_transmitted(self, client, ship):
        cargo = await post_ok(client, "/api/cargo", {"ship_id": ship["id"], "name": "Medkits", "size_class": "tiny"})
        bay = await post_ok(client, "/api/cargo-bays", {"ship_id": ship["id"], "name": "Bay 1", "bay_size": "medium"})
        placement = await post_ok(
            client, "/api/cargo-placements", {"cargo_id": cargo["id"], "bay_id": bay["id"], "x": 0, "y": 0}
        )
        # Moving within the bay is not logged
        await patch_ok(client, f"/api/cargo-placements/{placement['id']}", {"x": 1})
        assert (await client.delete(f"/api/cargo-placements/{placement['id']}")).status_code == 200
        await patch_ok(client, f"/api/cargo/{cargo['id']}", {"notes": "Expired"})
        await patch_ok(client, f"/api/cargo/{cargo['id']}", {"notes": "Expired"})  # no-op: not logged
        assert (await client.delete(f"/api/cargo/{cargo['id']}")).status_code == 200

        events = await events_of(client, ship["id"])
        cargo_events = [e for e in events if e["type"].startswith("cargo_") and not e["type"].startswith("cargo_bay")]
        assert sorted(e["type"] for e in cargo_events) == sorted(
            ["cargo_added", "cargo_stowed", "cargo_unstowed", "cargo_updated", "cargo_removed"]
        )
        assert all(e["transmitted"] for e in cargo_events)
        stowed = next(e for e in cargo_events if e["type"] == "cargo_stowed")
        assert stowed["message"] == "Medkits stowed in Bay 1"

    async def test_crew_status_change_transmitted_roster_edits_not(self, client, ship):
        crew = await post_ok(client, "/api/crew", {"ship_id": ship["id"], "name": "Mercer"})
        await patch_ok(client, f"/api/crew/{crew['id']}", {"notes": "Allergic to tribbles"})
        await patch_ok(client, f"/api/crew/{crew['id']}", {"status": "critical"})

        [added] = await events_of(client, ship["id"], "crew_added")
        assert added["transmitted"] is False
        [change] = await events_of(client, ship["id"], "crew_status_change")
        assert change["transmitted"] is True
        assert change["severity"] == "critical"
        assert change["data"]["from"] == "fit_for_duty" and change["data"]["to"] == "critical"

    async def test_incident_status_change(self, client, ship):
        incident = await post_ok(client, "/api/incidents", {"ship_id": ship["id"], "name": "Fire", "severity": "major"})
        await patch_ok(client, f"/api/incidents/{incident['id']}", {"description": "Spreading"})
        await patch_ok(client, f"/api/incidents/{incident['id']}", {"status": "resolved"})

        [change] = await events_of(client, ship["id"], "incident_status_change")
        assert change["message"] == "Incident resolved: Fire"
        assert change["transmitted"] is True  # same audience as incident_created
        assert change["data"]["to"] == "resolved"


class TestHiddenContent:
    async def test_sensor_contact_hidden_until_revealed(self, client, ship):
        contact = await post_ok(
            client, "/api/sensor-contacts", {"ship_id": ship["id"], "label": "Raider", "threat_level": "hostile"}
        )
        [added] = await events_of(client, ship["id"], "sensor_contact_added")
        assert added["transmitted"] is False

        # Track updates are not logged; classification of a hidden contact stays GM-only
        await patch_ok(client, f"/api/sensor-contacts/{contact['id']}", {"bearing_deg": 90, "range_km": 5})
        assert await events_of(client, ship["id"], "sensor_contact_updated") == []

        await patch_ok(client, f"/api/sensor-contacts/{contact['id']}/reveal", {})
        [detected] = await events_of(client, ship["id"], "sensor_contact_detected")
        assert detected["transmitted"] is True
        assert detected["severity"] == "warning"

        await patch_ok(client, f"/api/sensor-contacts/{contact['id']}", {"threat_level": "neutral"})
        [classified] = await events_of(client, ship["id"], "sensor_contact_classified")
        assert classified["transmitted"] is True

        await patch_ok(client, f"/api/sensor-contacts/{contact['id']}/hide", {})
        [lost] = await events_of(client, ship["id"], "sensor_contact_lost")
        assert lost["transmitted"] is False

    async def test_holomap_marker_visibility(self, client, ship):
        layer = await post_ok(client, "/api/holomap/layers", {"ship_id": ship["id"], "name": "Deck 1"})
        hidden = await post_ok(
            client, f"/api/holomap/layers/{layer['id']}/markers", {"type": "fire", "x": 0.5, "y": 0.5, "visible": False}
        )
        await patch_ok(client, f"/api/holomap/markers/{hidden['id']}", {"x": 0.6, "y": 0.4})  # move: not logged
        await patch_ok(client, f"/api/holomap/markers/{hidden['id']}", {"visible": True})

        [layer_created] = await events_of(client, ship["id"], "holomap_layer_created")
        assert layer_created["transmitted"] is False
        [added] = await events_of(client, ship["id"], "holomap_marker_added")
        assert added["transmitted"] is False
        [revealed] = await events_of(client, ship["id"], "holomap_marker_revealed")
        assert revealed["transmitted"] is True
        assert revealed["message"] == "Fire marked on Deck 1"
        assert await events_of(client, ship["id"], "holomap_marker_updated") == []


class TestGmAuthoring:
    async def test_panel_authoring_logged_but_not_transmitted(self, client, ship):
        panel = await post_ok(
            client,
            "/api/panels",
            {"ship_id": ship["id"], "name": "Bridge", "station_group": "command", "role_visibility": ["player"]},
        )
        widget = await post_ok(
            client,
            f"/api/panels/{panel['id']}/widgets",
            {"panel_id": panel["id"], "widget_type": "title", "x": 0, "y": 0, "width": 4, "height": 2},
        )
        # Moves and config saves are not logged
        await patch_ok(client, f"/api/panels/widgets/{widget['id']}", {"x": 2, "config": {"title": "Hi"}})
        resp = await client.post(
            f"/api/panels/{panel['id']}/layout", json=[{"id": widget["id"], "x": 4, "y": 0, "width": 4, "height": 2}]
        )
        assert resp.status_code == 200
        assert (await client.delete(f"/api/panels/widgets/{widget['id']}")).status_code == 200

        events = await events_of(client, ship["id"])
        layout_events = [e for e in events if e["type"].startswith(("panel_", "widget_"))]
        assert sorted(e["type"] for e in layout_events) == ["panel_created", "widget_added", "widget_removed"]
        assert not any(e["transmitted"] for e in layout_events)

    async def test_sector_map_events(self, client, ship):
        sector_map = await post_ok(client, "/api/sector-maps", {"ship_id": ship["id"], "name": "Kepler"})
        preset = await post_ok(client, "/api/sector-maps/gm-presets", {"ship_id": ship["id"], "name": "Rally"})
        await patch_ok(client, f"/api/sector-maps/gm-presets/{preset['id']}", {"color": "#00ff00"})
        obj = await post_ok(
            client,
            f"/api/sector-maps/{sector_map['id']}/objects",
            {"map_id": sector_map["id"], "hex_q": 0, "hex_r": 0, "label": "Derelict", "visibility_state": "hidden"},
        )
        await patch_ok(client, f"/api/sector-maps/objects/{obj['id']}", {"hex_q": 3, "hex_r": -1})  # move
        await patch_ok(client, f"/api/sector-maps/{sector_map['id']}", {"bg_offset_x": 12.0})  # alignment
        await post_ok(client, f"/api/sector-maps/{sector_map['id']}/set-active", {})
        await patch_ok(client, f"/api/sector-maps/objects/{obj['id']}", {"visibility_state": "anomaly"})
        await post_ok(
            client,
            f"/api/sector-maps/{sector_map['id']}/waypoints",
            {"map_id": sector_map["id"], "hex_q": 1, "hex_r": 1},
        )

        events = {e["type"]: e for e in await events_of(client, ship["id"])}
        for gm_only in ("sector_map_created", "gm_waypoint_preset_created", "gm_waypoint_preset_updated",
                        "sector_object_added"):  # fmt: skip
            assert events[gm_only]["transmitted"] is False, gm_only
        assert "sector_object_updated" not in events
        assert "sector_map_updated" not in events
        assert events["sector_map_activated"]["transmitted"] is True
        anomaly = events["sector_anomaly_detected"]
        assert anomaly["transmitted"] is True
        assert "Derelict" not in anomaly["message"]  # identity stays hidden from players
        assert events["waypoint_set"]["transmitted"] is True

    async def test_system_category_and_contact_authoring_not_transmitted(self, client, ship):
        category = await post_ok(
            client, "/api/system-categories", {"ship_id": ship["id"], "name": "Weapons", "color": "#ff0000"}
        )
        await patch_ok(client, f"/api/system-categories/{category['id']}", {"name": "Arms"})
        contact = await post_ok(client, "/api/contacts", {"ship_id": ship["id"], "name": "Vex"})
        assert (await client.delete(f"/api/contacts/{contact['id']}")).status_code == 200

        events = [
            e for e in await events_of(client, ship["id"]) if e["type"].startswith(("system_category_", "contact_"))
        ]
        assert sorted(e["type"] for e in events) == [
            "contact_added",
            "contact_removed",
            "system_category_created",
            "system_category_updated",
        ]
        assert not any(e["transmitted"] for e in events)

    async def test_ship_import_logged_for_gm(self, client, seeded_ship):
        export = await client.get(f"/api/ships/{seeded_ship['id']}/export")
        assert export.status_code == 200
        resp = await client.post(
            "/api/ships/import",
            files={"file": ("ship.zip", export.content, "application/zip")},
            data={"new_name": "Imported Copy"},
        )
        assert resp.status_code == 200, resp.text
        new_ship = resp.json()["ship"]

        [imported] = await events_of(client, new_ship["id"], "ship_imported")
        assert imported["transmitted"] is False
        assert imported["data"]["source_ship_id"] == seeded_ship["id"]
