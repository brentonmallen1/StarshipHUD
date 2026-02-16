"""Tests for the Tasks API."""



async def create_task(client, ship_id, title="Repair Hull", **kwargs):
    """Helper to create a task."""
    payload = {
        "ship_id": ship_id,
        "title": title,
        "station": kwargs.get("station", "engineering"),
    }
    if "description" in kwargs:
        payload["description"] = kwargs["description"]
    if "time_limit" in kwargs:
        payload["time_limit"] = kwargs["time_limit"]
    if "on_success" in kwargs:
        payload["on_success"] = kwargs["on_success"]
    if "on_failure" in kwargs:
        payload["on_failure"] = kwargs["on_failure"]

    resp = await client.post("/api/tasks", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestTaskCRUD:
    async def test_create_task(self, client, ship):
        task = await create_task(client, ship["id"], "Fix Reactor", station="engineering")
        assert task["title"] == "Fix Reactor"
        assert task["station"] == "engineering"
        assert task["status"] == "pending"
        assert task["claimed_by"] is None

    async def test_create_task_with_time_limit(self, client, ship):
        task = await create_task(client, ship["id"], "Emergency Seal", time_limit=300)
        assert task["time_limit"] == 300
        assert task["expires_at"] is not None

    async def test_create_task_emits_event(self, client, ship):
        await create_task(client, ship["id"], "Critical Repair")

        events = (await client.get(f"/api/events?ship_id={ship['id']}&type=task_created")).json()
        assert len(events) >= 1
        assert any("Critical Repair" in e["message"] for e in events)

    async def test_list_tasks(self, client, ship):
        await create_task(client, ship["id"], "Task A")
        await create_task(client, ship["id"], "Task B")

        resp = await client.get(f"/api/tasks?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_list_tasks_filter_by_station(self, client, ship):
        await create_task(client, ship["id"], "Eng Task", station="engineering")
        await create_task(client, ship["id"], "Cmd Task", station="command")

        resp = await client.get(f"/api/tasks?ship_id={ship['id']}&station=engineering")
        assert resp.status_code == 200
        tasks = resp.json()
        assert len(tasks) == 1
        assert tasks[0]["title"] == "Eng Task"

    async def test_list_tasks_filter_by_status(self, client, ship):
        t = await create_task(client, ship["id"], "Active Task")
        await client.post(
            f"/api/tasks/{t['id']}/claim",
            params={"claimed_by": "Player1"},
        )

        pending = (await client.get(f"/api/tasks?ship_id={ship['id']}&status=pending")).json()
        active = (await client.get(f"/api/tasks?ship_id={ship['id']}&status=active")).json()

        assert len(pending) == 0
        assert len(active) == 1

    async def test_get_task(self, client, ship):
        task = await create_task(client, ship["id"])
        resp = await client.get(f"/api/tasks/{task['id']}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Repair Hull"

    async def test_get_task_not_found(self, client):
        resp = await client.get("/api/tasks/nonexistent")
        assert resp.status_code == 404

    async def test_update_task_status(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.patch(f"/api/tasks/{task['id']}", json={"status": "active"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["started_at"] is not None

    async def test_update_task_claimed_by(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.patch(f"/api/tasks/{task['id']}", json={"claimed_by": "Player1"})
        assert resp.status_code == 200
        assert resp.json()["claimed_by"] == "Player1"

    async def test_update_task_title(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.patch(f"/api/tasks/{task['id']}", json={"title": "New Title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "New Title"

    async def test_update_task_description(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.patch(
            f"/api/tasks/{task['id']}",
            json={"description": "Updated description"},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "Updated description"

    async def test_update_task_station(self, client, ship):
        task = await create_task(client, ship["id"], station="engineering")

        resp = await client.patch(f"/api/tasks/{task['id']}", json={"station": "command"})
        assert resp.status_code == 200
        assert resp.json()["station"] == "command"

    async def test_update_task_time_limit(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.patch(f"/api/tasks/{task['id']}", json={"time_limit": 600})
        assert resp.status_code == 200
        data = resp.json()
        assert data["time_limit"] == 600
        assert data["expires_at"] is not None

    async def test_delete_task(self, client, ship):
        task = await create_task(client, ship["id"])
        resp = await client.delete(f"/api/tasks/{task['id']}")
        assert resp.status_code == 200

        resp = await client.get(f"/api/tasks/{task['id']}")
        assert resp.status_code == 404


class TestTaskClaim:
    async def test_claim_pending_task(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.post(
            f"/api/tasks/{task['id']}/claim",
            params={"claimed_by": "Player1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["claimed_by"] == "Player1"
        assert data["status"] == "active"
        assert data["started_at"] is not None

    async def test_claim_non_pending_task_fails(self, client, ship):
        task = await create_task(client, ship["id"])

        # Claim once
        await client.post(
            f"/api/tasks/{task['id']}/claim",
            params={"claimed_by": "Player1"},
        )

        # Try to claim again (now active)
        resp = await client.post(
            f"/api/tasks/{task['id']}/claim",
            params={"claimed_by": "Player2"},
        )
        assert resp.status_code == 400
        assert "not pending" in resp.json()["detail"].lower()

    async def test_claim_not_found(self, client):
        resp = await client.post(
            "/api/tasks/nonexistent/claim",
            params={"claimed_by": "Player1"},
        )
        assert resp.status_code == 404


class TestTaskComplete:
    async def test_complete_succeeded(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.post(
            f"/api/tasks/{task['id']}/complete",
            params={"status": "succeeded"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "succeeded"
        assert data["completed_at"] is not None

    async def test_complete_failed(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.post(
            f"/api/tasks/{task['id']}/complete",
            params={"status": "failed"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "failed"

    async def test_complete_invalid_status(self, client, ship):
        task = await create_task(client, ship["id"])

        resp = await client.post(
            f"/api/tasks/{task['id']}/complete",
            params={"status": "invalid"},
        )
        assert resp.status_code == 400

    async def test_complete_emits_event(self, client, ship):
        task = await create_task(client, ship["id"], "Engine Fix")

        await client.post(
            f"/api/tasks/{task['id']}/complete",
            params={"status": "succeeded"},
        )

        events = (await client.get(f"/api/events?ship_id={ship['id']}&type=task_completed")).json()
        assert len(events) >= 1
        assert any("succeeded" in e["message"].lower() for e in events)

    async def test_complete_not_found(self, client):
        resp = await client.post(
            "/api/tasks/nonexistent/complete",
            params={"status": "succeeded"},
        )
        assert resp.status_code == 404


class TestTaskOutcomeExecution:
    async def test_success_outcome_sets_status(self, client, ship):
        """Task on_success outcome should set system status when completed."""
        # Create a system state
        await client.post(
            "/api/system-states",
            json={
                "id": "hull",
                "ship_id": ship["id"],
                "name": "Hull",
                "status": "critical",
                "value": 10,
                "max_value": 100,
                "depends_on": [],
            },
        )

        # Create task with on_success outcome
        task = await create_task(
            client,
            ship["id"],
            "Repair Hull",
            on_success=[{"type": "set_status", "target": "hull", "value": "operational"}],
        )

        # Complete the task
        resp = await client.post(
            f"/api/tasks/{task['id']}/complete",
            params={"status": "succeeded"},
        )
        assert resp.status_code == 200

        # Hull should now be operational
        hull = (await client.get("/api/system-states/hull")).json()
        assert hull["status"] == "operational"

    async def test_failure_outcome_emits_event(self, client, ship):
        """Task on_failure outcome should emit event when task fails."""
        task = await create_task(
            client,
            ship["id"],
            "Risky Repair",
            on_failure=[
                {
                    "type": "emit_event",
                    "target": None,
                    "value": None,
                    "data": {
                        "type": "task_outcome",
                        "severity": "warning",
                        "message": "Repair failed catastrophically",
                    },
                }
            ],
        )

        await client.post(
            f"/api/tasks/{task['id']}/complete",
            params={"status": "failed"},
        )

        events = (await client.get(f"/api/events?ship_id={ship['id']}&type=task_outcome")).json()
        assert len(events) >= 1
        assert any("catastrophically" in e["message"] for e in events)
