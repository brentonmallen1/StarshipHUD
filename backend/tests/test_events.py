"""Tests for the Events API."""


async def create_event(client, ship_id, type="alert", severity="info", message="Test event", **kwargs):
    """Helper to create an event."""
    payload = {
        "ship_id": ship_id,
        "type": type,
        "severity": severity,
        "message": message,
    }
    if "data" in kwargs:
        payload["data"] = kwargs["data"]
    if "transmitted" in kwargs:
        payload["transmitted"] = kwargs["transmitted"]

    resp = await client.post("/api/events", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestEventCRUD:
    async def test_create_event(self, client, ship):
        event = await create_event(client, ship["id"], type="status_change", severity="warning", message="Hull breach")
        assert event["type"] == "status_change"
        assert event["severity"] == "warning"
        assert event["message"] == "Hull breach"
        assert event["ship_id"] == ship["id"]
        assert event["transmitted"] is True  # default

    async def test_create_event_with_data(self, client, ship):
        event = await create_event(
            client, ship["id"],
            type="alert",
            data={"system_id": "abc", "old_status": "operational"},
        )
        assert event["data"]["system_id"] == "abc"
        assert event["data"]["old_status"] == "operational"

    async def test_create_event_not_transmitted(self, client, ship):
        event = await create_event(client, ship["id"], transmitted=False)
        assert event["transmitted"] is False

    async def test_list_events(self, client, ship):
        await create_event(client, ship["id"], message="Event A")
        await create_event(client, ship["id"], message="Event B")

        resp = await client.get(f"/api/events?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_get_event(self, client, ship):
        event = await create_event(client, ship["id"])
        resp = await client.get(f"/api/events/{event['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == event["id"]

    async def test_get_event_not_found(self, client):
        resp = await client.get("/api/events/nonexistent")
        assert resp.status_code == 404

    async def test_delete_event(self, client, ship):
        event = await create_event(client, ship["id"])
        resp = await client.delete(f"/api/events/{event['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

        resp = await client.get(f"/api/events/{event['id']}")
        assert resp.status_code == 404

    async def test_delete_event_not_found(self, client):
        resp = await client.delete("/api/events/nonexistent")
        assert resp.status_code == 404


class TestEventUpdate:
    async def test_update_event(self, client, ship):
        event = await create_event(client, ship["id"], type="alert", severity="info", message="Original")

        resp = await client.patch(f"/api/events/{event['id']}", json={
            "message": "Updated",
            "severity": "critical",
            "type": "system_failure",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["message"] == "Updated"
        assert updated["severity"] == "critical"
        assert updated["type"] == "system_failure"

    async def test_update_event_data(self, client, ship):
        event = await create_event(client, ship["id"])
        resp = await client.patch(f"/api/events/{event['id']}", json={
            "data": {"key": "value"},
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["key"] == "value"

    async def test_update_event_transmitted(self, client, ship):
        event = await create_event(client, ship["id"], transmitted=True)
        resp = await client.patch(f"/api/events/{event['id']}", json={"transmitted": False})
        assert resp.status_code == 200
        assert resp.json()["transmitted"] is False

    async def test_update_event_not_found(self, client):
        resp = await client.patch("/api/events/nonexistent", json={"message": "x"})
        assert resp.status_code == 404


class TestEventFiltering:
    async def test_filter_by_type(self, client, ship):
        await create_event(client, ship["id"], type="alert")
        await create_event(client, ship["id"], type="transmission")

        resp = await client.get(f"/api/events?ship_id={ship['id']}&type=alert")
        events = resp.json()
        assert all(e["type"] == "alert" for e in events)

    async def test_filter_by_types_comma_separated(self, client, ship):
        await create_event(client, ship["id"], type="alert")
        await create_event(client, ship["id"], type="transmission")
        await create_event(client, ship["id"], type="status_change")

        resp = await client.get(f"/api/events?ship_id={ship['id']}&types=alert,transmission")
        events = resp.json()
        assert all(e["type"] in ("alert", "transmission") for e in events)
        assert len(events) >= 2

    async def test_filter_by_severity(self, client, ship):
        await create_event(client, ship["id"], severity="info")
        await create_event(client, ship["id"], severity="critical")

        resp = await client.get(f"/api/events?ship_id={ship['id']}&severity=critical")
        events = resp.json()
        assert all(e["severity"] == "critical" for e in events)

    async def test_filter_by_transmitted(self, client, ship):
        await create_event(client, ship["id"], transmitted=True)
        await create_event(client, ship["id"], transmitted=False)

        resp = await client.get(f"/api/events?ship_id={ship['id']}&transmitted=false")
        events = resp.json()
        assert all(e["transmitted"] is False for e in events)

    async def test_filter_by_since(self, client, ship):
        event = await create_event(client, ship["id"])
        # Use a timestamp before the event was created
        resp = await client.get(f"/api/events?ship_id={ship['id']}&since=2020-01-01T00:00:00")
        assert len(resp.json()) >= 1


class TestEventFeed:
    async def test_event_feed(self, client, ship):
        await create_event(client, ship["id"], message="Feed Event 1")
        await create_event(client, ship["id"], message="Feed Event 2")

        resp = await client.get(f"/api/events/feed/{ship['id']}")
        assert resp.status_code == 200
        events = resp.json()
        assert len(events) >= 2

    async def test_event_feed_with_types(self, client, ship):
        await create_event(client, ship["id"], type="alert")
        await create_event(client, ship["id"], type="transmission")

        resp = await client.get(f"/api/events/feed/{ship['id']}?types=alert")
        events = resp.json()
        assert all(e["type"] == "alert" for e in events)

    async def test_event_feed_with_transmitted(self, client, ship):
        await create_event(client, ship["id"], transmitted=False)
        await create_event(client, ship["id"], transmitted=True)

        resp = await client.get(f"/api/events/feed/{ship['id']}?transmitted=true")
        events = resp.json()
        assert all(e["transmitted"] is True for e in events)
