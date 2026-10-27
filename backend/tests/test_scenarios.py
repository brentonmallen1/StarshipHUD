"""Tests for the Scenarios API."""

import json


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


async def insert_raw_scenario(db, ship_id, actions, scenario_id="legacy-scenario"):
    """Store a scenario directly, bypassing validation (e.g. data saved before actions were typed)."""
    await db.execute(
        "INSERT INTO scenarios (id, ship_id, name, actions, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        (scenario_id, ship_id, "Legacy", json.dumps(actions)),
    )
    await db.commit()
    return scenario_id


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

    async def test_create_rejects_unknown_action_type(self, client, ship):
        """Actions are a typed union; unknown types are rejected when saving."""
        resp = await client.post(
            "/api/scenarios",
            json={
                "ship_id": ship["id"],
                "name": "Bad Type",
                "actions": [{"type": "warp_drive_engage", "target": "hull", "value": "yes"}],
            },
        )
        assert resp.status_code == 422

    async def test_create_rejects_invalid_status_value(self, client, ship):
        resp = await client.post(
            "/api/scenarios",
            json={
                "ship_id": ship["id"],
                "name": "Bad Status",
                "actions": [{"type": "set_status", "target": "hull", "value": "super_duper"}],
            },
        )
        assert resp.status_code == 422

    async def test_execute_legacy_unknown_action_type(self, client, ship, db):
        """A stored action that no longer validates still loads, but execution refuses it."""
        await create_system(client, ship["id"], "hull", "Hull")
        scenario_id = await insert_raw_scenario(
            db,
            ship["id"],
            [
                {"type": "set_status", "target": "hull", "value": "critical"},
                {"type": "warp_drive_engage", "target": "hull", "value": "yes"},
            ],
        )

        loaded = await client.get(f"/api/scenarios/{scenario_id}")
        assert loaded.status_code == 200
        assert loaded.json()["actions"][1]["type"] == "warp_drive_engage"

        resp = await client.post(f"/api/scenarios/{scenario_id}/execute")
        assert resp.status_code == 422
        assert "Unknown action type: warp_drive_engage" in resp.json()["detail"]
        # The valid first action was rolled back too
        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["status"] == "optimal"

    async def test_execute_legacy_invalid_status_value(self, client, ship, db):
        await create_system(client, ship["id"], "hull", "Hull")
        scenario_id = await insert_raw_scenario(
            db, ship["id"], [{"type": "set_status", "target": "hull", "value": "super_duper"}]
        )
        resp = await client.post(f"/api/scenarios/{scenario_id}/execute")
        assert resp.status_code == 422
        assert "Invalid status value: super_duper" in resp.json()["detail"]

    async def test_execute_set_value_missing_target(self, client, ship):
        """A target that doesn't exist on the ship fails the whole scenario."""
        scenario = await create_scenario(
            client,
            ship["id"],
            "Ghost Target",
            [{"type": "set_value", "target": "nonexistent_system", "value": 50}],
        )
        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 422
        assert "System not found: nonexistent_system" in resp.json()["detail"]

    async def test_execute_adjust_value_missing_target(self, client, ship):
        scenario = await create_scenario(
            client,
            ship["id"],
            "Ghost Adjust",
            [{"type": "adjust_value", "target": "nonexistent_system", "value": -10}],
        )
        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 422
        assert "System not found: nonexistent_system" in resp.json()["detail"]


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

    async def test_rehearse_legacy_unknown_action_type(self, client, ship, db):
        """Rehearsal reports what execution would refuse."""
        scenario_id = await insert_raw_scenario(db, ship["id"], [{"type": "self_destruct"}])

        resp = await client.post(f"/api/scenarios/{scenario_id}/rehearse")
        assert resp.status_code == 200
        result = resp.json()
        assert result["can_execute"] is False
        assert any("Unknown action type: self_destruct" in e for e in result["errors"])

    async def test_rehearse_legacy_invalid_status(self, client, ship, db):
        await create_system(client, ship["id"], "hull", "Hull")
        scenario_id = await insert_raw_scenario(
            db, ship["id"], [{"type": "set_status", "target": "hull", "value": "super_duper"}]
        )

        resp = await client.post(f"/api/scenarios/{scenario_id}/rehearse")
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


async def ship_events(client, ship_id):
    resp = await client.get("/api/events", params={"ship_id": ship_id, "limit": 500})
    assert resp.status_code == 200
    return resp.json()


THRESHOLDS = {"optimal": 100, "operational": 90, "degraded": 70, "compromised": 50, "critical": 10, "destroyed": 0}


class TestScenarioEngine:
    async def test_set_status_uses_custom_thresholds(self, client, ship):
        await create_system(client, ship["id"], "hull", "Hull")
        await client.patch("/api/system-states/hull", json={"status_thresholds": THRESHOLDS})
        scenario = await create_scenario(
            client, ship["id"], "Degrade", [{"type": "set_status", "target": "hull", "value": "degraded"}]
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200
        hull = (await client.get("/api/system-states/hull")).json()
        # Custom degraded threshold is 70 (the default band would give 79)
        assert hull["status"] == "degraded"
        assert hull["value"] == 70

    async def test_set_value_matches_patch_with_custom_thresholds(self, client, ship):
        await create_system(client, ship["id"], "hull", "Hull")
        await create_system(client, ship["id"], "hull2", "Hull 2")
        for sid in ("hull", "hull2"):
            await client.patch(f"/api/system-states/{sid}", json={"status_thresholds": THRESHOLDS})
        scenario = await create_scenario(
            client, ship["id"], "Dent", [{"type": "set_value", "target": "hull", "value": 85}]
        )

        await client.post(f"/api/scenarios/{scenario['id']}/execute")
        via_patch = (await client.patch("/api/system-states/hull2", json={"value": 85})).json()
        via_scenario = (await client.get("/api/system-states/hull")).json()
        # 85 is below the custom operational threshold (90); default bands would say operational
        assert via_scenario["status"] == via_patch["status"] == "degraded"

    async def test_emits_status_change_and_cascade_events(self, client, ship):
        await create_system(client, ship["id"], "reactor", "Reactor")
        await create_system(client, ship["id"], "shields", "Shields", depends_on=["reactor"])
        scenario = await create_scenario(
            client, ship["id"], "Meltdown", [{"type": "set_status", "target": "reactor", "value": "critical"}]
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 200
        events = await ship_events(client, ship["id"])
        by_type = {}
        for e in events:
            by_type.setdefault(e["type"], []).append(e)

        assert by_type["status_change"][0]["data"]["system_id"] == "reactor"
        assert by_type["status_change"][0]["severity"] == "critical"
        cascade = by_type["cascade_failure"][0]
        assert cascade["data"]["system_id"] == "shields"
        assert cascade["data"]["cascade_reason"]["id"] == "reactor"
        assert "scenario_executed" in by_type
        assert len(resp.json()["events_emitted"]) == 3

    async def test_cannot_touch_another_ships_records(self, client, ship, db):
        other = (await client.post("/api/ships", json={"name": "Other Ship", "seed_type": "blank"})).json()
        await create_system(client, other["id"], "foreign_hull", "Foreign Hull")
        resp = await client.post(
            "/api/sensor-contacts",
            json={"id": "foreign_contact", "ship_id": other["id"], "label": "Bogey", "visible": False},
        )
        assert resp.status_code == 200, resp.text

        for action in (
            {"type": "set_status", "target": "foreign_hull", "value": "destroyed"},
            {"type": "adjust_value", "target": "foreign_hull", "value": -50},
            {"type": "toggle_sensor_contact", "target": "foreign_contact", "value": True},
        ):
            scenario = await create_scenario(client, ship["id"], f"Sabotage {action['type']}", [action])
            resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
            assert resp.status_code == 422, action
            rehearsal = (await client.post(f"/api/scenarios/{scenario['id']}/rehearse")).json()
            assert rehearsal["can_execute"] is False

        foreign = (await client.get("/api/system-states/foreign_hull")).json()
        assert foreign["status"] == "optimal"
        assert foreign["value"] == 100
        cursor = await db.execute("SELECT visible FROM sensor_contacts WHERE id = 'foreign_contact'")
        assert (await cursor.fetchone())["visible"] == 0

    async def test_invalid_posture_rejected(self, client, ship, db):
        resp = await client.post(
            "/api/scenarios",
            json={"ship_id": ship["id"], "name": "Plaid", "actions": [{"type": "set_posture", "value": "plaid"}]},
        )
        assert resp.status_code == 422

        scenario_id = await insert_raw_scenario(db, ship["id"], [{"type": "set_posture", "value": "plaid"}])
        resp = await client.post(f"/api/scenarios/{scenario_id}/execute")
        assert resp.status_code == 422
        assert "Invalid posture: plaid" in resp.json()["detail"]
        posture = (await client.get(f"/api/ships/{ship['id']}/posture")).json()
        assert posture["posture"] == "green"

    async def test_set_posture_applies_roe_and_emits_event(self, client, ship):
        scenario = await create_scenario(client, ship["id"], "Red", [{"type": "set_posture", "value": "red"}])
        await client.post(f"/api/scenarios/{scenario['id']}/execute")
        posture = (await client.get(f"/api/ships/{ship['id']}/posture")).json()
        assert posture["posture_set_by"] == "scenario"
        assert posture["roe"]["weapons_safeties"] == "off"
        assert any(e["type"] == "posture_change" for e in await ship_events(client, ship["id"]))

    async def test_failing_action_rolls_back_everything(self, client, ship):
        await create_system(client, ship["id"], "hull", "Hull")
        events_before = len(await ship_events(client, ship["id"]))
        scenario = await create_scenario(
            client,
            ship["id"],
            "Half Broken",
            [
                {"type": "set_status", "target": "hull", "value": "critical"},
                {"type": "set_posture", "value": "red"},
                {"type": "initiate_hail", "value": True},
                {"type": "emit_event", "data": {"type": "alert", "message": "Brace!"}},
                {"type": "set_value", "target": "does_not_exist", "value": 10},
            ],
        )

        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert "no changes were applied" in detail
        assert "Action 5" in detail and "System not found: does_not_exist" in detail

        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["status"] == "optimal"
        posture = (await client.get(f"/api/ships/{ship['id']}/posture")).json()
        assert posture["posture"] == "green"
        assert not posture["hail_active"]
        assert len(await ship_events(client, ship["id"])) == events_before

    async def test_rehearse_matches_execute_without_changing_anything(self, client, ship, db):
        await create_system(client, ship["id"], "reactor", "Reactor")
        await create_system(client, ship["id"], "shields", "Shields", depends_on=["reactor"])
        await client.patch("/api/system-states/shields", json={"status_thresholds": THRESHOLDS})
        resp = await client.post(
            "/api/sensor-contacts",
            json={"id": "bogey", "ship_id": ship["id"], "label": "Bogey", "visible": False},
        )
        assert resp.status_code == 200, resp.text
        scenario = await create_scenario(
            client,
            ship["id"],
            "Ambush",
            [
                {"type": "set_status", "target": "reactor", "value": "compromised"},
                {"type": "adjust_value", "target": "shields", "value": -20},
                {"type": "adjust_value", "target": "shields", "value": -20},
                {"type": "set_posture", "value": "red"},
                {"type": "toggle_sensor_contact", "target": "bogey"},
                {"type": "emit_event", "data": {"type": "alert", "severity": "critical", "message": "Ambush!"}},
                {"type": "stop_audio"},
            ],
        )

        async def snapshot():
            result = []
            for sql in (
                "SELECT id, status, value FROM system_states ORDER BY id",
                "SELECT id FROM events ORDER BY id",
                "SELECT posture, hail_active FROM posture_state",
                "SELECT id, visible FROM sensor_contacts",
            ):
                rows = await (await db.execute(sql)).fetchall()
                result.append([tuple(r) for r in rows])
            return result

        before = await snapshot()
        rehearsal = (await client.post(f"/api/scenarios/{scenario['id']}/rehearse")).json()
        assert await snapshot() == before
        assert rehearsal["can_execute"] is True
        assert rehearsal["errors"] == []
        assert rehearsal["warnings"] == []

        event_ids_before = {e["id"] for e in await ship_events(client, ship["id"])}
        result = (await client.post(f"/api/scenarios/{scenario['id']}/execute")).json()
        assert result["success"] is True

        # Final system states match the last preview for each system
        final_preview = {c["system_id"]: c for c in rehearsal["system_changes"]}
        for system_id, change in final_preview.items():
            actual = (await client.get(f"/api/system-states/{system_id}")).json()
            assert (actual["status"], actual["value"]) == (change["after_status"], change["after_value"])
        # Chained adjustments preview from the simulated value: 100 -> 80 -> 60
        shield_changes = [c for c in rehearsal["system_changes"] if c["system_id"] == "shields"]
        assert [c["after_value"] for c in shield_changes] == [80, 60]
        assert shield_changes[1]["after_status"] == "compromised"  # custom thresholds (60 < 70)

        new_events = [e for e in await ship_events(client, ship["id"]) if e["id"] not in event_ids_before]
        assert sorted((e["type"], e["message"]) for e in new_events) == sorted(
            (e["type"], e["message"]) for e in rehearsal["events_preview"]
        )
        assert len(result["events_emitted"]) == len(new_events)

        assert rehearsal["posture_change"]["after_posture"] == "red"
        assert rehearsal["toggles_preview"][0]["after_visible"] is True
        cursor = await db.execute("SELECT visible FROM sensor_contacts WHERE id = 'bogey'")
        assert (await cursor.fetchone())["visible"] == 1
        assert result["audio_commands"] == [{"command": "stop", "audio_url": None, "loop": False, "name": None}]

    async def test_toggles_hail_and_audio(self, client, ship):
        event = (
            await client.post(
                "/api/events",
                json={"ship_id": ship["id"], "type": "transmission_received", "message": "Hello", "transmitted": False},
            )
        ).json()
        layer = (await client.post("/api/holomap/layers", json={"ship_id": ship["id"], "name": "Deck"})).json()
        marker = (
            await client.post(
                f"/api/holomap/layers/{layer['id']}/markers",
                json={"type": "fire", "x": 0.1, "y": 0.1, "visible": False, "label": "Galley fire"},
            )
        ).json()
        scenario = await create_scenario(
            client,
            ship["id"],
            "Comms",
            [
                {"type": "toggle_transmission", "target": event["id"]},
                {"type": "toggle_holomap_marker", "target": marker["id"], "value": True},
                {"type": "initiate_hail"},
                {"type": "play_audio", "target": "/uploads/audio/klaxon.mp3", "data": {"loop": True}},
            ],
        )

        rehearsal = (await client.post(f"/api/scenarios/{scenario['id']}/rehearse")).json()
        assert rehearsal["can_execute"] is True
        assert [(t["target_type"], t["before_visible"], t["after_visible"]) for t in rehearsal["toggles_preview"]] == [
            ("transmission", False, True),
            ("holomap_marker", False, True),
            ("hail", False, True),
        ]

        result = (await client.post(f"/api/scenarios/{scenario['id']}/execute")).json()
        assert result["actions_executed"] == 4
        assert result["audio_commands"] == [
            {"command": "play", "audio_url": "/uploads/audio/klaxon.mp3", "loop": True, "name": "klaxon.mp3"}
        ]
        assert (await client.get(f"/api/events/{event['id']}")).json()["transmitted"] is True
        assert (await client.get(f"/api/holomap/markers/{marker['id']}")).json()["visible"] is True
        assert (await client.get(f"/api/ships/{ship['id']}/posture")).json()["hail_active"]

    async def test_audio_targets_must_resolve(self, client, ship):
        scenario = await create_scenario(
            client,
            ship["id"],
            "Silence",
            [
                {"type": "play_audio", "target": ""},
                {"type": "play_soundboard", "target": "no-such-widget", "value": "btn"},
                {"type": "toggle_holomap_marker", "target": "no-such-marker"},
                {"type": "toggle_transmission", "target": "no-such-event"},
            ],
        )
        rehearsal = (await client.post(f"/api/scenarios/{scenario['id']}/rehearse")).json()
        assert rehearsal["can_execute"] is False
        assert len(rehearsal["errors"]) == 4
        resp = await client.post(f"/api/scenarios/{scenario['id']}/execute")
        assert resp.status_code == 422
        assert "Action 1" in resp.json()["detail"]

    async def test_timer_trigger_reports_failed_scenario(self, client, ship):
        scenario = await create_scenario(
            client, ship["id"], "Broken", [{"type": "set_value", "target": "missing", "value": 1}]
        )
        timer = await client.post(
            "/api/timers",
            json={
                "ship_id": ship["id"],
                "label": "T-minus",
                "direction": "countdown",
                "duration_seconds": 60,
                "scenario_id": scenario["id"],
            },
        )
        assert timer.status_code == 200, timer.text
        resp = await client.post(f"/api/timers/{timer.json()['id']}/trigger")
        assert resp.status_code == 200
        body = resp.json()
        assert body["scenario_executed"] is False
        assert "System not found: missing" in body["scenario_error"]
