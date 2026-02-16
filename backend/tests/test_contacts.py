"""Tests for the Contacts API."""


async def create_contact(client, ship_id, name="Captain Xara", **kwargs):
    """Helper to create a contact."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "threat_level": kwargs.get("threat_level", "unknown"),
    }
    for key in ("affiliation", "role", "notes", "image_url", "tags", "id"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post("/api/contacts", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestContactCRUD:
    async def test_create_contact(self, client, ship):
        contact = await create_contact(client, ship["id"], "Admiral Voss", threat_level="friendly")
        assert contact["name"] == "Admiral Voss"
        assert contact["threat_level"] == "friendly"
        assert contact["ship_id"] == ship["id"]

    async def test_create_contact_with_tags(self, client, ship):
        contact = await create_contact(
            client, ship["id"],
            tags=["diplomat", "belter"],
        )
        assert contact["tags"] == ["diplomat", "belter"]

    async def test_create_contact_with_all_fields(self, client, ship):
        contact = await create_contact(
            client, ship["id"],
            name="Ambassador Kel",
            affiliation="Mars Congressional Republic",
            threat_level="neutral",
            role="Diplomat",
            notes="Negotiating treaty",
            image_url="/uploads/kel.png",
        )
        assert contact["affiliation"] == "Mars Congressional Republic"
        assert contact["role"] == "Diplomat"
        assert contact["notes"] == "Negotiating treaty"

    async def test_create_contact_custom_id(self, client, ship):
        contact = await create_contact(client, ship["id"], id="custom-id-123")
        assert contact["id"] == "custom-id-123"

    async def test_list_contacts(self, client, ship):
        await create_contact(client, ship["id"], "Contact A")
        await create_contact(client, ship["id"], "Contact B")

        resp = await client.get(f"/api/contacts?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_list_contacts_by_threat_level(self, client, ship):
        await create_contact(client, ship["id"], "Friend", threat_level="friendly")
        await create_contact(client, ship["id"], "Foe", threat_level="hostile")

        resp = await client.get(f"/api/contacts?ship_id={ship['id']}&threat_level=hostile")
        contacts = resp.json()
        assert all(c["threat_level"] == "hostile" for c in contacts)

    async def test_get_contact(self, client, ship):
        contact = await create_contact(client, ship["id"])
        resp = await client.get(f"/api/contacts/{contact['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == contact["id"]

    async def test_get_contact_not_found(self, client):
        resp = await client.get("/api/contacts/nonexistent")
        assert resp.status_code == 404

    async def test_delete_contact(self, client, ship):
        contact = await create_contact(client, ship["id"])
        resp = await client.delete(f"/api/contacts/{contact['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_contact_not_found(self, client):
        resp = await client.delete("/api/contacts/nonexistent")
        assert resp.status_code == 404


class TestContactUpdate:
    async def test_update_contact(self, client, ship):
        contact = await create_contact(client, ship["id"])
        resp = await client.patch(f"/api/contacts/{contact['id']}", json={
            "name": "Updated Name",
            "threat_level": "hostile",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["name"] == "Updated Name"
        assert updated["threat_level"] == "hostile"

    async def test_update_tags(self, client, ship):
        contact = await create_contact(client, ship["id"])
        resp = await client.patch(f"/api/contacts/{contact['id']}", json={
            "tags": ["updated", "tags"],
        })
        assert resp.json()["tags"] == ["updated", "tags"]

    async def test_update_contact_not_found(self, client):
        resp = await client.patch("/api/contacts/nonexistent", json={"name": "x"})
        assert resp.status_code == 404
