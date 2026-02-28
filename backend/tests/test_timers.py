"""Tests for the Timers API (countdown displays)."""

from datetime import datetime, timedelta, UTC


async def create_timer(client, ship_id, label="Test Timer", duration_seconds=60, **kwargs):
    """Helper to create a timer."""
    payload = {
        "ship_id": ship_id,
        "label": label,
        "duration_seconds": duration_seconds,
        **kwargs,
    }
    resp = await client.post("/api/timers", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestTimerCRUD:
    async def test_create_timer(self, client, ship):
        timer = await create_timer(client, ship["id"], "Jump Countdown", 120)
        assert timer["label"] == "Jump Countdown"
        assert timer["ship_id"] == ship["id"]
        assert timer["visible"] is True
        assert timer["severity"] == "warning"
        assert timer["end_time"] is not None

    async def test_create_timer_with_end_time(self, client, ship):
        end_time = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
        resp = await client.post("/api/timers", json={
            "ship_id": ship["id"],
            "label": "Specific End Time",
            "end_time": end_time,
        })
        assert resp.status_code == 200
        timer = resp.json()
        assert timer["label"] == "Specific End Time"

    async def test_list_timers(self, client, ship):
        await create_timer(client, ship["id"], "Timer A")
        await create_timer(client, ship["id"], "Timer B")

        resp = await client.get(f"/api/timers?ship_id={ship['id']}")
        assert resp.status_code == 200
        timers = resp.json()
        assert len(timers) >= 2

    async def test_list_timers_visible_only(self, client, ship):
        await create_timer(client, ship["id"], "Visible Timer", visible=True)
        await create_timer(client, ship["id"], "Hidden Timer", visible=False)

        resp = await client.get(f"/api/timers?ship_id={ship['id']}&visible_only=true")
        assert resp.status_code == 200
        timers = resp.json()
        assert all(t["visible"] for t in timers)

    async def test_get_timer(self, client, ship):
        timer = await create_timer(client, ship["id"])
        resp = await client.get(f"/api/timers/{timer['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == timer["id"]

    async def test_get_timer_not_found(self, client):
        resp = await client.get("/api/timers/nonexistent")
        assert resp.status_code == 404

    async def test_update_timer(self, client, ship):
        timer = await create_timer(client, ship["id"], "Original Label")
        resp = await client.patch(f"/api/timers/{timer['id']}", json={
            "label": "Updated Label",
            "severity": "critical",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["label"] == "Updated Label"
        assert updated["severity"] == "critical"

    async def test_delete_timer(self, client, ship):
        timer = await create_timer(client, ship["id"])
        resp = await client.delete(f"/api/timers/{timer['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

        # Verify deleted
        resp = await client.get(f"/api/timers/{timer['id']}")
        assert resp.status_code == 404


class TestTimerPauseResume:
    async def test_pause_timer(self, client, ship):
        timer = await create_timer(client, ship["id"])
        assert timer["paused_at"] is None

        resp = await client.post(f"/api/timers/{timer['id']}/pause")
        assert resp.status_code == 200
        paused = resp.json()
        assert paused["paused_at"] is not None

    async def test_pause_already_paused(self, client, ship):
        timer = await create_timer(client, ship["id"])
        await client.post(f"/api/timers/{timer['id']}/pause")

        resp = await client.post(f"/api/timers/{timer['id']}/pause")
        assert resp.status_code == 400
        assert "already paused" in resp.json()["detail"]

    async def test_resume_timer(self, client, ship):
        timer = await create_timer(client, ship["id"])
        await client.post(f"/api/timers/{timer['id']}/pause")

        resp = await client.post(f"/api/timers/{timer['id']}/resume")
        assert resp.status_code == 200
        resumed = resp.json()
        assert resumed["paused_at"] is None

    async def test_resume_not_paused(self, client, ship):
        timer = await create_timer(client, ship["id"])
        resp = await client.post(f"/api/timers/{timer['id']}/resume")
        assert resp.status_code == 400
        assert "not paused" in resp.json()["detail"]


class TestTimerTrigger:
    async def test_trigger_timer(self, client, ship):
        timer = await create_timer(client, ship["id"], "Triggerable Timer")
        resp = await client.post(f"/api/timers/{timer['id']}/trigger")
        assert resp.status_code == 200
        result = resp.json()
        assert result["triggered"] is True

        # Timer should be deleted
        resp = await client.get(f"/api/timers/{timer['id']}")
        assert resp.status_code == 404

    async def test_trigger_emits_event(self, client, ship):
        timer = await create_timer(client, ship["id"], "Event Timer")
        await client.post(f"/api/timers/{timer['id']}/trigger")

        # Check for timer_expired event
        resp = await client.get(f"/api/events?ship_id={ship['id']}&types=timer_expired")
        assert resp.status_code == 200
        events = resp.json()
        assert len(events) >= 1
        assert events[0]["type"] == "timer_expired"
        assert "Event Timer" in events[0]["message"]
