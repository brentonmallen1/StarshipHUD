"""Tests for the Sensor Contacts API."""


async def create_contact(client, ship_id, name="Captain Xara", **kwargs):
    """Helper to create a dossier contact."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "threat_level": kwargs.get("threat_level", "unknown"),
    }
    resp = await client.post("/api/contacts", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_sensor_contact(client, ship_id, label="Bogey Alpha", **kwargs):
    """Helper to create a sensor contact."""
    payload = {
        "ship_id": ship_id,
        "label": label,
        "threat_level": kwargs.get("threat_level", "unknown"),
    }
    for key in ("contact_id", "confidence", "bearing_deg", "range_km", "vector",
                "signal_strength", "notes", "visible", "id"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post("/api/sensor-contacts", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestSensorContactCRUD:
    async def test_create_sensor_contact(self, client, ship):
        sc = await create_sensor_contact(
            client, ship["id"],
            label="Unknown Vessel",
            threat_level="hostile",
            bearing_deg=45.0,
            range_km=1200.0,
            confidence=75,
        )
        assert sc["label"] == "Unknown Vessel"
        assert sc["threat_level"] == "hostile"
        assert sc["bearing_deg"] == 45.0
        assert sc["range_km"] == 1200.0
        assert sc["confidence"] == 75
        assert sc["visible"] is False  # default

    async def test_create_with_contact_id(self, client, ship):
        dossier = await create_contact(client, ship["id"], "Known Entity")
        sc = await create_sensor_contact(
            client, ship["id"],
            label="Identified Ship",
            contact_id=dossier["id"],
        )
        assert sc["contact_id"] == dossier["id"]

    async def test_create_visible(self, client, ship):
        sc = await create_sensor_contact(client, ship["id"], visible=True)
        assert sc["visible"] is True

    async def test_list_sensor_contacts(self, client, ship):
        await create_sensor_contact(client, ship["id"], "SC A")
        await create_sensor_contact(client, ship["id"], "SC B")

        resp = await client.get(f"/api/sensor-contacts?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_list_filter_by_visible(self, client, ship):
        await create_sensor_contact(client, ship["id"], "Hidden", visible=False)
        await create_sensor_contact(client, ship["id"], "Shown", visible=True)

        resp = await client.get(f"/api/sensor-contacts?ship_id={ship['id']}&visible=true")
        contacts = resp.json()
        assert all(c["visible"] is True for c in contacts)

    async def test_list_filter_by_threat_level(self, client, ship):
        await create_sensor_contact(client, ship["id"], "Friend", threat_level="friendly")
        await create_sensor_contact(client, ship["id"], "Foe", threat_level="hostile")

        resp = await client.get(f"/api/sensor-contacts?ship_id={ship['id']}&threat_level=hostile")
        contacts = resp.json()
        assert all(c["threat_level"] == "hostile" for c in contacts)

    async def test_get_sensor_contact(self, client, ship):
        sc = await create_sensor_contact(client, ship["id"])
        resp = await client.get(f"/api/sensor-contacts/{sc['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == sc["id"]

    async def test_get_not_found(self, client):
        resp = await client.get("/api/sensor-contacts/nonexistent")
        assert resp.status_code == 404

    async def test_delete_sensor_contact(self, client, ship):
        sc = await create_sensor_contact(client, ship["id"])
        resp = await client.delete(f"/api/sensor-contacts/{sc['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_not_found(self, client):
        resp = await client.delete("/api/sensor-contacts/nonexistent")
        assert resp.status_code == 404


class TestSensorContactUpdate:
    async def test_update_threat_level(self, client, ship):
        sc = await create_sensor_contact(client, ship["id"], threat_level="unknown")
        resp = await client.patch(f"/api/sensor-contacts/{sc['id']}", json={
            "threat_level": "hostile",
        })
        assert resp.status_code == 200
        assert resp.json()["threat_level"] == "hostile"

    async def test_update_position(self, client, ship):
        sc = await create_sensor_contact(client, ship["id"])
        resp = await client.patch(f"/api/sensor-contacts/{sc['id']}", json={
            "bearing_deg": 180.0,
            "range_km": 500.0,
        })
        assert resp.json()["bearing_deg"] == 180.0
        assert resp.json()["range_km"] == 500.0

    async def test_update_not_found(self, client):
        resp = await client.patch("/api/sensor-contacts/nonexistent", json={"label": "x"})
        assert resp.status_code == 404


class TestSensorContactVisibility:
    async def test_reveal(self, client, ship):
        sc = await create_sensor_contact(client, ship["id"], visible=False)
        resp = await client.patch(f"/api/sensor-contacts/{sc['id']}/reveal")
        assert resp.status_code == 200
        assert resp.json()["visible"] is True

    async def test_hide(self, client, ship):
        sc = await create_sensor_contact(client, ship["id"], visible=True)
        resp = await client.patch(f"/api/sensor-contacts/{sc['id']}/hide")
        assert resp.status_code == 200
        assert resp.json()["visible"] is False

    async def test_reveal_not_found(self, client):
        resp = await client.patch("/api/sensor-contacts/nonexistent/reveal")
        assert resp.status_code == 404

    async def test_hide_not_found(self, client):
        resp = await client.patch("/api/sensor-contacts/nonexistent/hide")
        assert resp.status_code == 404


class TestSensorContactWithDossiers:
    async def test_list_with_dossiers(self, client, ship):
        dossier = await create_contact(client, ship["id"], "Known Ship", threat_level="friendly")
        await create_sensor_contact(
            client, ship["id"],
            label="Identified",
            contact_id=dossier["id"],
            visible=True,
        )

        resp = await client.get(f"/api/sensor-contacts/with-dossiers?ship_id={ship['id']}")
        assert resp.status_code == 200
        results = resp.json()
        linked = [r for r in results if r["contact_id"] == dossier["id"]]
        assert len(linked) == 1
        assert linked[0]["dossier"] is not None
        assert linked[0]["dossier"]["name"] == "Known Ship"

    async def test_with_dossiers_no_contact(self, client, ship):
        await create_sensor_contact(client, ship["id"], "Unknown", visible=True)

        resp = await client.get(f"/api/sensor-contacts/with-dossiers?ship_id={ship['id']}")
        results = resp.json()
        unlinked = [r for r in results if r["contact_id"] is None]
        assert len(unlinked) >= 1
        assert unlinked[0]["dossier"] is None

    async def test_with_dossiers_filter_visible(self, client, ship):
        await create_sensor_contact(client, ship["id"], "Hidden", visible=False)
        await create_sensor_contact(client, ship["id"], "Shown", visible=True)

        resp = await client.get(f"/api/sensor-contacts/with-dossiers?ship_id={ship['id']}&visible=true")
        results = resp.json()
        assert all(r["visible"] is True for r in results)

    async def test_with_dossiers_filter_threat_level(self, client, ship):
        await create_sensor_contact(client, ship["id"], "Friendly", threat_level="friendly", visible=True)
        await create_sensor_contact(client, ship["id"], "Hostile", threat_level="hostile", visible=True)

        resp = await client.get(
            f"/api/sensor-contacts/with-dossiers?ship_id={ship['id']}&threat_level=hostile"
        )
        results = resp.json()
        assert all(r["threat_level"] == "hostile" for r in results)
