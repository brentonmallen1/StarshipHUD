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

    async def test_update_scenario_actions(self, client, ship):
        """Updating a scenario's actions should JSON-serialize them."""
        s = await create_scenario(client, ship["id"], "Original", [])
        new_actions = [
            {"type": "set_status", "target": "hull", "value": "critical"},
            {"type": "emit_event", "target": None, "value": None, "data": {"message": "boom"}},
        ]
        resp = await client.patch(
            f"/api/scenarios/{s['id']}",
            json={"actions": new_actions},
        )
        assert resp.status_code == 200
        updated = resp.json()
        assert len(updated["actions"]) == 2
        assert updated["actions"][0]["type"] == "set_status"
        assert updated["actions"][1]["type"] == "emit_event"

    async def test_update_scenario_empty(self, client, ship):
        """PATCH with no fields should return scenario unchanged."""
        s = await create_scenario(client, ship["id"], "Unchanged", [])
        resp = await client.patch(
            f"/api/scenarios/{s['id']}",
            json={},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Unchanged"

    async def test_update_scenario_not_found(self, client):
        resp = await client.patch(
            "/api/scenarios/nonexistent",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    async def test_delete_scenario_not_found(self, client):
        resp = await client.delete("/api/scenarios/nonexistent")
        assert resp.status_code == 404

    async def test_duplicate_scenario_not_found(self, client):
        resp = await client.post("/api/scenarios/nonexistent/duplicate")
        assert resp.status_code == 404


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

    async def test_execute_unknown_action_type(self, client, ship):
        """Unknown action types should produce an error in the result."""
        scenario = await create_scenario(
            client,
            ship["id"],
            "Bad Type",
            [{"type": "warp_drive_engage", "target": "hull", "value": "yes"}],
        )
        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200
        result = resp.json()
        assert result["success"] is False
        assert any("Unknown action type: warp_drive_engage" in e for e in result["errors"])
        assert result["actions_executed"] == 0

    async def test_execute_invalid_status_value(self, client, ship):
        """set_status with a bogus status string should produce an error."""
        await create_system(client, ship["id"], "hull", "Hull")
        scenario = await create_scenario(
            client,
            ship["id"],
            "Bad Status",
            [{"type": "set_status", "target": "hull", "value": "super_duper"}],
        )
        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200
        result = resp.json()
        assert result["success"] is False
        assert any("Invalid status value: super_duper" in e for e in result["errors"])
        # The action was not counted as executed
        assert result["actions_executed"] == 0

    async def test_execute_set_value_missing_target(self, client, ship):
        """set_value for a nonexistent system should be silently skipped."""
        scenario = await create_scenario(
            client,
            ship["id"],
            "Ghost Target",
            [{"type": "set_value", "target": "nonexistent_system", "value": 50}],
        )
        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200
        result = resp.json()
        # No error appended; the action is simply skipped
        assert result["actions_executed"] == 0
        assert result["success"] is True

    async def test_execute_adjust_value_missing_target(self, client, ship):
        """adjust_value for a nonexistent system should be silently skipped."""
        scenario = await create_scenario(
            client,
            ship["id"],
            "Ghost Adjust",
            [{"type": "adjust_value", "target": "nonexistent_system", "value": -10}],
        )
        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200
        result = resp.json()
        assert result["actions_executed"] == 0
        assert result["success"] is True


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

    async def test_rehearse_set_value(self, client, ship):
        """Rehearsal of set_value should preview before/after values and computed status."""
        await create_system(client, ship["id"], "shields", "Shields", value=100)

        scenario = await create_scenario(
            client,
            ship["id"],
            "Shield Drain Preview",
            [{"type": "set_value", "target": "shields", "value": 40}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert result["can_execute"] is True
        assert len(result["system_changes"]) == 1

        change = result["system_changes"][0]
        assert change["system_id"] == "shields"
        assert change["system_name"] == "Shields"
        assert change["before_value"] == 100
        assert change["after_value"] == 40
        # 40% => compromised
        assert change["after_status"] == "compromised"

    async def test_rehearse_adjust_value(self, client, ship):
        """Rehearsal of adjust_value should preview clamped before/after values."""
        await create_system(client, ship["id"], "hull", "Hull", value=80)

        scenario = await create_scenario(
            client,
            ship["id"],
            "Minor Damage Preview",
            [{"type": "adjust_value", "target": "hull", "value": -30}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert result["can_execute"] is True
        assert len(result["system_changes"]) == 1

        change = result["system_changes"][0]
        assert change["system_id"] == "hull"
        assert change["before_value"] == 80
        assert change["after_value"] == 50
        # 50% => compromised
        assert change["after_status"] == "compromised"

    async def test_rehearse_chained_actions(self, client, ship):
        """Two actions on the same system: the second should use the simulated value from the first."""
        await create_system(client, ship["id"], "hull", "Hull", value=100)

        scenario = await create_scenario(
            client,
            ship["id"],
            "Double Hit",
            [
                {"type": "adjust_value", "target": "hull", "value": -40},
                {"type": "adjust_value", "target": "hull", "value": -20},
            ],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert len(result["system_changes"]) == 2

        first = result["system_changes"][0]
        assert first["before_value"] == 100
        assert first["after_value"] == 60

        second = result["system_changes"][1]
        # Second action should see the simulated value from the first action
        assert second["before_value"] == 60
        assert second["after_value"] == 40

    async def test_rehearse_missing_target(self, client, ship):
        """Rehearsal with a nonexistent system target should add an error."""
        scenario = await create_scenario(
            client,
            ship["id"],
            "Ghost System",
            [{"type": "set_status", "target": "nonexistent_sys", "value": "critical"}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert result["can_execute"] is False
        assert any("System not found: nonexistent_sys" in e for e in result["errors"])

    async def test_rehearse_missing_target_set_value(self, client, ship):
        """Rehearsal of set_value with nonexistent target should add an error."""
        scenario = await create_scenario(
            client,
            ship["id"],
            "Ghost Set Value",
            [{"type": "set_value", "target": "missing_sys", "value": 50}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert result["can_execute"] is False
        assert any("System not found: missing_sys" in e for e in result["errors"])

    async def test_rehearse_missing_target_adjust_value(self, client, ship):
        """Rehearsal of adjust_value with nonexistent target should add an error."""
        scenario = await create_scenario(
            client,
            ship["id"],
            "Ghost Adjust",
            [{"type": "adjust_value", "target": "missing_sys", "value": -10}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert result["can_execute"] is False
        assert any("System not found: missing_sys" in e for e in result["errors"])

    async def test_rehearse_unknown_action_type(self, client, ship):
        """Rehearsal with unknown action type should add a warning."""
        scenario = await create_scenario(
            client,
            ship["id"],
            "Unknown Type",
            [{"type": "self_destruct", "target": None, "value": None}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        # Unknown types produce warnings, not errors
        assert result["can_execute"] is True
        assert any("Unknown action type: self_destruct" in w for w in result["warnings"])

    async def test_rehearse_invalid_status(self, client, ship):
        """Rehearsal of set_status with invalid status value should add an error."""
        await create_system(client, ship["id"], "hull", "Hull")

        scenario = await create_scenario(
            client,
            ship["id"],
            "Invalid Status Preview",
            [{"type": "set_status", "target": "hull", "value": "super_duper"}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert result["can_execute"] is False
        assert any("Invalid status value: super_duper" in e for e in result["errors"])

    async def test_rehearse_set_posture_no_posture_state(self, client, ship, db):
        """Rehearsal of set_posture when no posture_state row exists should add a warning."""
        # Remove the posture_state row that was auto-created with the ship
        await db.execute("DELETE FROM posture_state WHERE ship_id = ?", (ship["id"],))
        await db.commit()

        scenario = await create_scenario(
            client,
            ship["id"],
            "Posture No State",
            [{"type": "set_posture", "target": None, "value": "red"}],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert any("No posture state found" in w for w in result["warnings"])
