"""Tests for the Scenarios API."""



async def create_system(client, ship_id, system_id, name, **kwargs):
    """Helper to create a system state for scenario tests."""
    payload = {
        "id": system_id,
        "ship_id": ship_id,
        "name": name,
        "status": kwargs.get("status", "optimal"),
        "value": kwargs.get("value", 100),
        "max_value": kwargs.get("max_value", 100),
        "depends_on": kwargs.get("depends_on", []),
    }
    resp = await client.post("/api/system-states", json=payload)
    assert resp.status_code == 200
    return resp.json()


async def create_scenario(client, ship_id, name, actions, **kwargs):
    """Helper to create a scenario."""
    payload = {
        "ship_id": ship_id,
        "name": name,
        "actions": actions,
    }
    if "description" in kwargs:
        payload["description"] = kwargs["description"]
    resp = await client.post("/api/scenarios", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestScenarioCRUD:
    async def test_create_scenario(self, client, ship):
        scenario = await create_scenario(
            client,
            ship["id"],
            "Hull Breach",
            [{"type": "set_status", "target": "hull", "value": "critical"}],
            description="Simulates a hull breach event",
        )
        assert scenario["name"] == "Hull Breach"
        assert len(scenario["actions"]) == 1
        assert scenario["description"] == "Simulates a hull breach event"

    async def test_list_scenarios(self, client, ship):
        await create_scenario(client, ship["id"], "Scenario A", [])
        await create_scenario(client, ship["id"], "Scenario B", [])

        resp = await client.get(f"/api/scenarios?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_get_scenario(self, client, ship):
        s = await create_scenario(client, ship["id"], "Test", [])
        resp = await client.get(f"/api/scenarios/{s['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test"

    async def test_get_scenario_not_found(self, client):
        resp = await client.get("/api/scenarios/nonexistent")
        assert resp.status_code == 404

    async def test_update_scenario(self, client, ship):
        s = await create_scenario(client, ship["id"], "Old Name", [])
        resp = await client.patch(
            f"/api/scenarios/{s['id']}",
            json={"name": "New Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    async def test_delete_scenario(self, client, ship):
        s = await create_scenario(client, ship["id"], "Doomed", [])
        resp = await client.delete(f"/api/scenarios/{s['id']}")
        assert resp.status_code == 200

        resp = await client.get(f"/api/scenarios/{s['id']}")
        assert resp.status_code == 404

    async def test_duplicate_scenario(self, client, ship):
        s = await create_scenario(
            client,
            ship["id"],
            "Original",
            [{"type": "emit_event", "target": None, "value": None, "data": {"message": "test"}}],
        )
        resp = await client.post(f"/api/scenarios/{s['id']}/duplicate")
        assert resp.status_code == 200
        copy = resp.json()
        assert copy["name"] == "Original (Copy)"
        assert copy["id"] != s["id"]
        assert len(copy["actions"]) == 1

    async def test_reorder_scenarios(self, client, ship):
        s1 = await create_scenario(client, ship["id"], "First", [])
        s2 = await create_scenario(client, ship["id"], "Second", [])
        s3 = await create_scenario(client, ship["id"], "Third", [])

        resp = await client.post(
            f"/api/scenarios/reorder?ship_id={ship['id']}",
            json=[s3["id"], s1["id"], s2["id"]],
        )
        assert resp.status_code == 200
        reordered = resp.json()
        assert reordered[0]["id"] == s3["id"]
        assert reordered[1]["id"] == s1["id"]
        assert reordered[2]["id"] == s2["id"]


class TestScenarioExecution:
    async def test_execute_set_status(self, client, ship):
        await create_system(client, ship["id"], "hull", "Hull")

        scenario = await create_scenario(
            client,
            ship["id"],
            "Hull Breach",
            [{"type": "set_status", "target": "hull", "value": "critical"}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200
        result = resp.json()
        assert result["success"] is True
        assert result["actions_executed"] == 1

        # Verify hull is now critical
        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["status"] == "critical"

    async def test_execute_set_value(self, client, ship):
        await create_system(client, ship["id"], "shields", "Shields")

        scenario = await create_scenario(
            client,
            ship["id"],
            "Shield Drain",
            [{"type": "set_value", "target": "shields", "value": 40}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        shields = (await client.get("/api/system-states/shields")).json()
        assert shields["value"] == 40
        assert shields["status"] == "compromised"

    async def test_execute_adjust_value(self, client, ship):
        await create_system(client, ship["id"], "hull", "Hull", value=80)

        scenario = await create_scenario(
            client,
            ship["id"],
            "Minor Damage",
            [{"type": "adjust_value", "target": "hull", "value": -30}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200

        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["value"] == 50

    async def test_execute_adjust_value_clamped(self, client, ship):
        """Values should be clamped to [0, max_value]."""
        await create_system(client, ship["id"], "hull", "Hull", value=10)

        scenario = await create_scenario(
            client,
            ship["id"],
            "Massive Damage",
            [{"type": "adjust_value", "target": "hull", "value": -50}],
        )

        await client.post(f"/api/scenarios/{scenario['id']}/execute")
        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["value"] == 0  # Clamped at 0

    async def test_execute_emit_event(self, client, ship):
        scenario = await create_scenario(
            client,
            ship["id"],
            "Alert",
            [
                {
                    "type": "emit_event",
                    "target": None,
                    "value": None,
                    "data": {
                        "type": "alert",
                        "severity": "warning",
                        "message": "Hostile detected",
                    },
                }
            ],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        result = resp.json()
        assert result["success"] is True
        # Should have 2 events: the custom one + scenario_executed
        assert len(result["events_emitted"]) == 2

    async def test_execute_set_posture(self, client, ship):
        scenario = await create_scenario(
            client,
            ship["id"],
            "Battle Stations",
            [{"type": "set_posture", "target": None, "value": "red"}],
        )

        await client.post(f"/api/scenarios/{scenario['id']}/execute")

        posture = (await client.get(f"/api/ships/{ship['id']}/posture")).json()
        assert posture["posture"] == "red"

    async def test_execute_multiple_actions(self, client, ship):
        await create_system(client, ship["id"], "hull", "Hull")
        await create_system(client, ship["id"], "shields", "Shields")

        scenario = await create_scenario(
            client,
            ship["id"],
            "Ambush",
            [
                {"type": "set_status", "target": "hull", "value": "degraded"},
                {"type": "set_value", "target": "shields", "value": 20},
                {"type": "set_posture", "target": None, "value": "red"},
                {
                    "type": "emit_event",
                    "target": None,
                    "value": None,
                    "data": {"message": "Ambush!"},
                },
            ],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        result = resp.json()
        assert result["success"] is True
        assert result["actions_executed"] == 4

    async def test_execute_not_found(self, client):
        resp = await client.post("/api/scenarios/nonexistent/execute")
        assert resp.status_code == 404


class TestScenarioRehearsal:
    async def test_rehearse_shows_preview(self, client, ship):
        await create_system(client, ship["id"], "hull", "Hull")

        scenario = await create_scenario(
            client,
            ship["id"],
            "Hull Breach Preview",
            [{"type": "set_status", "target": "hull", "value": "critical"}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert result["can_execute"] is True
        assert len(result["system_changes"]) == 1

        change = result["system_changes"][0]
        assert change["system_id"] == "hull"
        assert change["before_status"] == "optimal"
        assert change["after_status"] == "critical"

    async def test_rehearse_does_not_mutate(self, client, ship):
        """Rehearsal should not change actual system state."""
        await create_system(client, ship["id"], "hull", "Hull")

        scenario = await create_scenario(
            client,
            ship["id"],
            "Preview Only",
            [{"type": "set_status", "target": "hull", "value": "destroyed"}],
        )

        await client.post(f"/api/scenarios/{scenario['id']}/rehearse")

        # Hull should still be optimal
        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["status"] == "optimal"

    async def test_rehearse_posture_preview(self, client, ship):
        scenario = await create_scenario(
            client,
            ship["id"],
            "Red Alert",
            [{"type": "set_posture", "target": None, "value": "red"}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        result = resp.json()
        assert result["posture_change"]["before_posture"] == "green"
        assert result["posture_change"]["after_posture"] == "red"

    async def test_rehearse_not_found(self, client):
        resp = await client.post("/api/scenarios/nonexistent/rehearse")
        assert resp.status_code == 404
