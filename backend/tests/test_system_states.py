"""Tests for the System States API."""



async def create_system(client, ship_id, system_id, name, **kwargs):
    """Helper to create a system state."""
    payload = {
        "id": system_id,
        "ship_id": ship_id,
        "name": name,
        "status": kwargs.get("status", "optimal"),
        "value": kwargs.get("value", 100),
        "max_value": kwargs.get("max_value", 100),
        "unit": kwargs.get("unit", "%"),
        "category": kwargs.get("category"),
        "depends_on": kwargs.get("depends_on", []),
    }
    resp = await client.post("/api/system-states", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestSystemStateCRUD:
    async def test_create_system_state(self, client, ship):
        data = await create_system(client, ship["id"], "reactor", "Main Reactor")
        assert data["id"] == "reactor"
        assert data["name"] == "Main Reactor"
        assert data["status"] == "optimal"
        assert data["value"] == 100
        assert data["effective_status"] == "optimal"

    async def test_list_system_states(self, client, ship):
        await create_system(client, ship["id"], "hull", "Hull")
        await create_system(client, ship["id"], "shields", "Shields")

        resp = await client.get(f"/api/system-states?ship_id={ship['id']}")
        assert resp.status_code == 200
        systems = resp.json()
        assert len(systems) == 2

    async def test_list_by_category(self, client, ship):
        await create_system(client, ship["id"], "reactor", "Reactor", category="power")
        await create_system(client, ship["id"], "hull", "Hull", category="structural")

        resp = await client.get(f"/api/system-states?ship_id={ship['id']}&category=power")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["name"] == "Reactor"

    async def test_get_system_state(self, client, ship):
        await create_system(client, ship["id"], "reactor", "Main Reactor")
        resp = await client.get("/api/system-states/reactor")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Main Reactor"

    async def test_get_system_state_not_found(self, client):
        resp = await client.get("/api/system-states/nonexistent")
        assert resp.status_code == 404

    async def test_delete_system_state(self, client, ship):
        await create_system(client, ship["id"], "reactor", "Reactor")
        resp = await client.delete("/api/system-states/reactor")
        assert resp.status_code == 200

        resp = await client.get("/api/system-states/reactor")
        assert resp.status_code == 404

    async def test_delete_not_found(self, client):
        resp = await client.delete("/api/system-states/nonexistent")
        assert resp.status_code == 404


class TestStatusCalculation:
    async def test_update_status_sets_value(self, client, ship):
        """Updating status only should auto-calculate value."""
        await create_system(client, ship["id"], "reactor", "Reactor")

        resp = await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"status": "degraded"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "degraded"
        # Value should be set to max of degraded range (79% of 100)
        assert data["value"] == 79.0

    async def test_update_value_sets_status(self, client, ship):
        """Updating value only should auto-calculate status."""
        await create_system(client, ship["id"], "hull", "Hull")

        resp = await client.patch(
            "/api/system-states/hull?emit_event=false",
            json={"value": 50},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["value"] == 50
        assert data["status"] == "compromised"  # 40-59%

    async def test_update_both_manual_override(self, client, ship):
        """Updating both status and value should use both as-is."""
        await create_system(client, ship["id"], "reactor", "Reactor")

        resp = await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"status": "offline", "value": 50},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "offline"
        assert data["value"] == 50

    async def test_status_thresholds(self, client, ship):
        """Test all status threshold boundaries."""
        await create_system(client, ship["id"], "sys", "System")

        test_cases = [
            (100, "optimal"),
            (99, "operational"),
            (80, "operational"),
            (79, "degraded"),
            (60, "degraded"),
            (59, "compromised"),
            (40, "compromised"),
            (39, "critical"),
            (1, "critical"),
            (0, "destroyed"),
        ]
        for value, expected_status in test_cases:
            resp = await client.patch(
                "/api/system-states/sys?emit_event=false",
                json={"value": value},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == expected_status, (
                f"value={value}: expected {expected_status}, got {data['status']}"
            )

    async def test_status_change_emits_event(self, client, ship):
        """Changing status should emit a status_change event by default."""
        await create_system(client, ship["id"], "reactor", "Reactor")

        await client.patch(
            "/api/system-states/reactor",
            json={"status": "critical"},
        )

        events = await client.get(f"/api/events?ship_id={ship['id']}&type=status_change")
        assert events.status_code == 200
        event_list = events.json()
        assert len(event_list) >= 1

    async def test_emit_event_false_suppresses_event(self, client, ship):
        """Setting emit_event=false should not emit events."""
        await create_system(client, ship["id"], "reactor", "Reactor")

        await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"status": "critical"},
        )

        events = await client.get(f"/api/events?ship_id={ship['id']}&type=status_change")
        assert events.status_code == 200
        assert len(events.json()) == 0


class TestEffectiveStatus:
    async def test_standalone_effective_equals_own(self, client, ship):
        """System with no dependencies: effective_status == own status."""
        sys = await create_system(client, ship["id"], "hull", "Hull")
        assert sys["effective_status"] == sys["status"]

    async def test_parent_caps_child(self, client, ship):
        """Child effective status is capped by parent's effective status."""
        await create_system(client, ship["id"], "reactor", "Reactor")
        await create_system(client, ship["id"], "shields", "Shields", depends_on=["reactor"])

        # Degrade reactor
        await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"status": "degraded"},
        )

        # Shields should be capped by reactor
        resp = await client.get("/api/system-states/shields")
        assert resp.status_code == 200
        shields = resp.json()
        assert shields["status"] == "optimal"  # Own status unchanged
        assert shields["effective_status"] == "degraded"  # Capped by reactor
        assert shields["limiting_parent"]["id"] == "reactor"

    async def test_cascade_through_chain(self, client, ship):
        """Status cascades through a chain: reactor -> power_grid -> shields."""
        await create_system(client, ship["id"], "reactor", "Reactor")
        await create_system(client, ship["id"], "power", "Power Grid", depends_on=["reactor"])
        await create_system(client, ship["id"], "shields", "Shields", depends_on=["power"])

        # Degrade reactor at top of chain
        await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"status": "critical"},
        )

        # Both downstream systems should be capped
        power = (await client.get("/api/system-states/power")).json()
        assert power["effective_status"] == "critical"

        shields = (await client.get("/api/system-states/shields")).json()
        assert shields["effective_status"] == "critical"

    async def test_worst_parent_wins(self, client, ship):
        """When a system has multiple parents, the worst one caps it."""
        await create_system(client, ship["id"], "reactor", "Reactor")
        await create_system(client, ship["id"], "cooling", "Cooling")
        await create_system(
            client,
            ship["id"],
            "shields",
            "Shields",
            depends_on=["reactor", "cooling"],
        )

        # Only degrade cooling
        await client.patch(
            "/api/system-states/cooling?emit_event=false",
            json={"status": "compromised"},
        )

        shields = (await client.get("/api/system-states/shields")).json()
        assert shields["effective_status"] == "compromised"
        assert shields["limiting_parent"]["id"] == "cooling"


class TestBulkReset:
    async def test_reset_all(self, client, ship):
        """Reset all systems to operational."""
        await create_system(client, ship["id"], "reactor", "Reactor", status="critical", value=10)
        await create_system(client, ship["id"], "hull", "Hull", status="degraded", value=60)

        resp = await client.post(
            "/api/system-states/bulk-reset",
            json={
                "ship_id": ship["id"],
                "reset_all": True,
                "systems": [],
                "emit_event": False,
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["systems_reset"] == 2

        # Verify both are now operational
        systems = (await client.get(f"/api/system-states?ship_id={ship['id']}")).json()
        for s in systems:
            assert s["status"] == "operational"

    async def test_reset_specific_systems(self, client, ship):
        """Reset specific systems with custom targets."""
        await create_system(client, ship["id"], "reactor", "Reactor", status="critical", value=10)
        await create_system(client, ship["id"], "hull", "Hull", status="destroyed", value=0)

        resp = await client.post(
            "/api/system-states/bulk-reset",
            json={
                "ship_id": ship["id"],
                "reset_all": False,
                "systems": [
                    {"system_id": "reactor", "target_status": "optimal"},
                ],
                "emit_event": False,
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["systems_reset"] == 1

        # Reactor should be optimal, hull still destroyed
        reactor = (await client.get("/api/system-states/reactor")).json()
        assert reactor["status"] == "optimal"

        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["status"] == "destroyed"

    async def test_reset_emits_event(self, client, ship):
        await create_system(client, ship["id"], "reactor", "Reactor", status="critical", value=10)

        await client.post(
            "/api/system-states/bulk-reset",
            json={
                "ship_id": ship["id"],
                "reset_all": True,
                "systems": [],
                "emit_event": True,
            },
        )

        events = (await client.get(f"/api/events?ship_id={ship['id']}&type=all_clear")).json()
        assert len(events) >= 1

    async def test_reset_with_target_value(self, client, ship):
        """Reset a system to a specific value (not status)."""
        await create_system(client, ship["id"], "hull", "Hull", status="critical", value=10)

        resp = await client.post(
            "/api/system-states/bulk-reset",
            json={
                "ship_id": ship["id"],
                "reset_all": False,
                "systems": [
                    {"system_id": "hull", "target_value": 75},
                ],
                "emit_event": False,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["systems_reset"] == 1

        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["value"] == 75
        assert hull["status"] == "degraded"  # 75% => degraded

    async def test_reset_nonexistent_system(self, client, ship):
        """Resetting a nonexistent system should produce an error."""
        resp = await client.post(
            "/api/system-states/bulk-reset",
            json={
                "ship_id": ship["id"],
                "reset_all": False,
                "systems": [
                    {"system_id": "nonexistent", "target_status": "optimal"},
                ],
                "emit_event": False,
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["systems_reset"] == 0
        assert any("not found" in e.lower() for e in result["errors"])

    async def test_reset_invalid_status(self, client, ship):
        """Resetting with an invalid status should produce an error."""
        await create_system(client, ship["id"], "hull", "Hull")

        resp = await client.post(
            "/api/system-states/bulk-reset",
            json={
                "ship_id": ship["id"],
                "reset_all": False,
                "systems": [
                    {"system_id": "hull", "target_status": "invalid_status"},
                ],
                "emit_event": False,
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["systems_reset"] == 0
        assert any("invalid" in e.lower() for e in result["errors"])

    async def test_reset_no_event_when_disabled(self, client, ship):
        """emit_event=False should not emit all_clear events."""
        await create_system(client, ship["id"], "reactor", "Reactor", status="critical", value=10)

        await client.post(
            "/api/system-states/bulk-reset",
            json={
                "ship_id": ship["id"],
                "reset_all": True,
                "systems": [],
                "emit_event": False,
            },
        )

        events = (await client.get(f"/api/events?ship_id={ship['id']}&type=all_clear")).json()
        assert len(events) == 0


class TestCascadeEvents:
    async def test_cascade_event_emitted_on_parent_degrade(self, client, ship):
        """When a parent degrades, cascade_failure events should be emitted for capped children."""
        await create_system(client, ship["id"], "reactor", "Reactor")
        await create_system(client, ship["id"], "shields", "Shields", depends_on=["reactor"])

        # Degrade reactor with event emission enabled
        await client.patch(
            "/api/system-states/reactor",
            json={"status": "critical"},
        )

        events = (await client.get(f"/api/events?ship_id={ship['id']}&type=cascade_failure")).json()
        assert len(events) >= 1
        assert any("Shields" in e["message"] for e in events)

    async def test_no_cascade_event_without_dependencies(self, client, ship):
        """Systems without dependencies should not trigger cascade events."""
        await create_system(client, ship["id"], "hull", "Hull")
        await create_system(client, ship["id"], "shields", "Shields")

        await client.patch(
            "/api/system-states/hull",
            json={"status": "critical"},
        )

        events = (await client.get(f"/api/events?ship_id={ship['id']}&type=cascade_failure")).json()
        assert len(events) == 0


class TestUpdateBranches:
    async def test_update_depends_on(self, client, ship):
        """Updating depends_on should serialize to JSON."""
        await create_system(client, ship["id"], "reactor", "Reactor")
        await create_system(client, ship["id"], "shields", "Shields")

        resp = await client.patch(
            "/api/system-states/shields?emit_event=false",
            json={"depends_on": ["reactor"]},
        )
        assert resp.status_code == 200
        assert "reactor" in resp.json()["depends_on"]

    async def test_update_name(self, client, ship):
        await create_system(client, ship["id"], "reactor", "Reactor")

        resp = await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"name": "Main Reactor"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Main Reactor"

    async def test_update_category(self, client, ship):
        await create_system(client, ship["id"], "reactor", "Reactor")

        resp = await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"category": "power"},
        )
        assert resp.status_code == 200
        assert resp.json()["category"] == "power"

    async def test_update_max_value(self, client, ship):
        await create_system(client, ship["id"], "reactor", "Reactor")

        resp = await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"max_value": 200},
        )
        assert resp.status_code == 200
        assert resp.json()["max_value"] == 200

    async def test_update_not_found(self, client):
        resp = await client.patch(
            "/api/system-states/nonexistent?emit_event=false",
            json={"name": "x"},
        )
        assert resp.status_code == 404

    async def test_update_offline_sets_value_zero(self, client, ship):
        """Setting status to offline should set value to 0."""
        await create_system(client, ship["id"], "reactor", "Reactor")

        resp = await client.patch(
            "/api/system-states/reactor?emit_event=false",
            json={"status": "offline"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "offline"
        assert data["value"] == 0
