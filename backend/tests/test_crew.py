"""Tests for the Crew API."""


async def create_crew(client, ship_id, name="Lt. Mercer", **kwargs):
    """Helper to create a crew member."""
    payload = {
        "ship_id": ship_id,
        "name": name,
    }
    for key in ("role", "status", "player_name", "is_npc", "notes", "condition_tags", "id"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post("/api/crew", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestCrewCRUD:
    async def test_create_crew_member(self, client, ship):
        crew = await create_crew(client, ship["id"], "Ensign Park", role="Pilot")
        assert crew["name"] == "Ensign Park"
        assert crew["role"] == "Pilot"
        assert crew["status"] == "fit_for_duty"
        assert crew["is_npc"] is True  # default

    async def test_create_pc(self, client, ship):
        crew = await create_crew(
            client, ship["id"],
            name="Commander Shepard",
            is_npc=False,
            player_name="John",
        )
        assert crew["is_npc"] is False
        assert crew["player_name"] == "John"

    async def test_create_with_condition_tags(self, client, ship):
        crew = await create_crew(
            client, ship["id"],
            condition_tags=["broken_arm", "concussion"],
        )
        assert crew["condition_tags"] == ["broken_arm", "concussion"]

    async def test_create_with_custom_id(self, client, ship):
        crew = await create_crew(client, ship["id"], id="crew-custom-1")
        assert crew["id"] == "crew-custom-1"

    async def test_list_crew(self, client, ship):
        await create_crew(client, ship["id"], "Crew A")
        await create_crew(client, ship["id"], "Crew B")

        resp = await client.get(f"/api/crew?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_list_crew_filter_by_status(self, client, ship):
        await create_crew(client, ship["id"], "Healthy", status="fit_for_duty")
        await create_crew(client, ship["id"], "Injured", status="incapacitated")

        resp = await client.get(f"/api/crew?ship_id={ship['id']}&status=incapacitated")
        members = resp.json()
        assert all(c["status"] == "incapacitated" for c in members)

    async def test_list_crew_filter_by_is_npc(self, client, ship):
        await create_crew(client, ship["id"], "NPC Doc", is_npc=True)
        await create_crew(client, ship["id"], "PC Hero", is_npc=False)

        resp = await client.get(f"/api/crew?ship_id={ship['id']}&is_npc=false")
        members = resp.json()
        assert all(c["is_npc"] is False for c in members)

    async def test_get_crew_member(self, client, ship):
        crew = await create_crew(client, ship["id"])
        resp = await client.get(f"/api/crew/{crew['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == crew["id"]

    async def test_get_crew_not_found(self, client):
        resp = await client.get("/api/crew/nonexistent")
        assert resp.status_code == 404

    async def test_delete_crew(self, client, ship):
        crew = await create_crew(client, ship["id"])
        resp = await client.delete(f"/api/crew/{crew['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_crew_not_found(self, client):
        resp = await client.delete("/api/crew/nonexistent")
        assert resp.status_code == 404


class TestCrewUpdate:
    async def test_update_status(self, client, ship):
        crew = await create_crew(client, ship["id"])
        resp = await client.patch(f"/api/crew/{crew['id']}", json={"status": "light_duty"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "light_duty"

    async def test_update_condition_tags(self, client, ship):
        crew = await create_crew(client, ship["id"])
        resp = await client.patch(f"/api/crew/{crew['id']}", json={
            "condition_tags": ["radiation_exposure"],
        })
        assert resp.json()["condition_tags"] == ["radiation_exposure"]

    async def test_update_is_npc(self, client, ship):
        crew = await create_crew(client, ship["id"], is_npc=True)
        resp = await client.patch(f"/api/crew/{crew['id']}", json={"is_npc": False})
        assert resp.json()["is_npc"] is False

    async def test_update_crew_not_found(self, client):
        resp = await client.patch("/api/crew/nonexistent", json={"name": "x"})
        assert resp.status_code == 404
