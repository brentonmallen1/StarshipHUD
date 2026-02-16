"""Tests for the Incidents API."""


async def create_incident(client, ship_id, name="Hull Breach", severity="major", **kwargs):
    """Helper to create an incident."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "severity": severity,
    }
    for key in ("description", "linked_system_ids", "effects", "source", "source_id"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post("/api/incidents", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestIncidentCRUD:
    async def test_create_incident(self, client, ship):
        incident = await create_incident(client, ship["id"], "Power Surge", "minor")
        assert incident["name"] == "Power Surge"
        assert incident["severity"] == "minor"
        assert incident["status"] == "active"
        assert incident["ship_id"] == ship["id"]

    async def test_create_incident_with_linked_systems(self, client, ship):
        incident = await create_incident(
            client, ship["id"],
            linked_system_ids=["sys-1", "sys-2"],
            effects=[{"type": "disable", "target": "shields"}],
        )
        assert incident["linked_system_ids"] == ["sys-1", "sys-2"]
        assert len(incident["effects"]) == 1

    async def test_create_incident_with_source(self, client, ship):
        incident = await create_incident(
            client, ship["id"],
            source="scenario",
            source_id="scn-123",
        )
        assert incident["source"] == "scenario"
        assert incident["source_id"] == "scn-123"

    async def test_list_incidents(self, client, ship):
        await create_incident(client, ship["id"], "Incident A")
        await create_incident(client, ship["id"], "Incident B")

        resp = await client.get(f"/api/incidents?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_get_incident(self, client, ship):
        incident = await create_incident(client, ship["id"])
        resp = await client.get(f"/api/incidents/{incident['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == incident["id"]

    async def test_get_incident_not_found(self, client):
        resp = await client.get("/api/incidents/nonexistent")
        assert resp.status_code == 404

    async def test_delete_incident(self, client, ship):
        incident = await create_incident(client, ship["id"])
        resp = await client.delete(f"/api/incidents/{incident['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_incident_not_found(self, client):
        resp = await client.delete("/api/incidents/nonexistent")
        assert resp.status_code == 404


class TestIncidentFiltering:
    async def test_filter_by_status(self, client, ship):
        await create_incident(client, ship["id"], "Active One")
        inc = await create_incident(client, ship["id"], "Resolved One")
        await client.patch(f"/api/incidents/{inc['id']}", json={"status": "resolved"})

        resp = await client.get(f"/api/incidents?ship_id={ship['id']}&status=active")
        incidents = resp.json()
        assert all(i["status"] == "active" for i in incidents)

    async def test_filter_by_severity(self, client, ship):
        await create_incident(client, ship["id"], "Minor", severity="minor")
        await create_incident(client, ship["id"], "Major", severity="major")

        resp = await client.get(f"/api/incidents?ship_id={ship['id']}&severity=major")
        incidents = resp.json()
        assert all(i["severity"] == "major" for i in incidents)


class TestIncidentLifecycle:
    async def test_update_status_to_resolved_sets_resolved_at(self, client, ship):
        incident = await create_incident(client, ship["id"])
        assert incident["resolved_at"] is None

        resp = await client.patch(f"/api/incidents/{incident['id']}", json={"status": "resolved"})
        updated = resp.json()
        assert updated["status"] == "resolved"
        assert updated["resolved_at"] is not None

    async def test_update_status_to_failed_sets_resolved_at(self, client, ship):
        incident = await create_incident(client, ship["id"])
        resp = await client.patch(f"/api/incidents/{incident['id']}", json={"status": "failed"})
        updated = resp.json()
        assert updated["status"] == "failed"
        assert updated["resolved_at"] is not None

    async def test_update_status_to_contained_no_resolved_at(self, client, ship):
        incident = await create_incident(client, ship["id"])
        resp = await client.patch(f"/api/incidents/{incident['id']}", json={"status": "contained"})
        updated = resp.json()
        assert updated["status"] == "contained"
        assert updated["resolved_at"] is None

    async def test_update_fields(self, client, ship):
        incident = await create_incident(client, ship["id"])
        resp = await client.patch(f"/api/incidents/{incident['id']}", json={
            "name": "Updated Name",
            "severity": "critical",
            "description": "New description",
            "linked_system_ids": ["sys-new"],
            "effects": [{"type": "damage", "amount": 50}],
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["name"] == "Updated Name"
        assert updated["severity"] == "critical"
        assert updated["description"] == "New description"
        assert updated["linked_system_ids"] == ["sys-new"]

    async def test_update_incident_not_found(self, client):
        resp = await client.patch("/api/incidents/nonexistent", json={"name": "x"})
        assert resp.status_code == 404


class TestIncidentEventEmission:
    async def test_create_emits_event(self, client, ship):
        await create_incident(client, ship["id"], "Critical Failure", severity="major")

        resp = await client.get(f"/api/events?ship_id={ship['id']}&type=incident_created")
        events = resp.json()
        assert len(events) >= 1
        assert any("Critical Failure" in e["message"] for e in events)

    async def test_severity_event_mapping_critical(self, client, ship):
        await create_incident(client, ship["id"], "Big Problem", severity="critical")

        resp = await client.get(f"/api/events?ship_id={ship['id']}&type=incident_created")
        events = resp.json()
        critical_events = [e for e in events if "Big Problem" in e["message"]]
        assert len(critical_events) >= 1
        assert critical_events[0]["severity"] == "critical"

    async def test_severity_event_mapping_minor(self, client, ship):
        await create_incident(client, ship["id"], "Small Issue", severity="minor")

        resp = await client.get(f"/api/events?ship_id={ship['id']}&type=incident_created")
        events = resp.json()
        minor_events = [e for e in events if "Small Issue" in e["message"]]
        assert len(minor_events) >= 1
        assert minor_events[0]["severity"] == "warning"
