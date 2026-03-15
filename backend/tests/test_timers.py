"""Tests for the Timers API (countdown/countup displays)."""

from datetime import datetime, timedelta, UTC


async def create_timer(client, ship_id, label="Test Timer", duration_seconds=60, **kwargs):
    """Helper to create a countdown timer."""
    payload = {
        "ship_id": ship_id,
        "label": label,
        "duration_seconds": duration_seconds,
        **kwargs,
    }
    resp = await client.post("/api/timers", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_countup_timer(client, ship_id, label="Elapsed Timer", **kwargs):
    """Helper to create a countup timer."""
    payload = {
        "ship_id": ship_id,
        "label": label,
        "direction": "countup",
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
    async def test_timer_starts_paused(self, client, ship):
        """Timers should start paused - user must explicitly start them."""
        timer = await create_timer(client, ship["id"])
        assert timer["paused_at"] is not None

    async def test_pause_timer(self, client, ship):
        """Start a timer then pause it."""
        timer = await create_timer(client, ship["id"])
        # Timer starts paused, so first resume it
        await client.post(f"/api/timers/{timer['id']}/resume")

        resp = await client.post(f"/api/timers/{timer['id']}/pause")
        assert resp.status_code == 200
        paused = resp.json()
        assert paused["paused_at"] is not None

    async def test_pause_already_paused(self, client, ship):
        """Pausing an already paused timer should fail."""
        timer = await create_timer(client, ship["id"])
        # Timer starts paused, try to pause again
        resp = await client.post(f"/api/timers/{timer['id']}/pause")
        assert resp.status_code == 400
        assert "already paused" in resp.json()["detail"]

    async def test_resume_timer(self, client, ship):
        """Resume a paused timer."""
        timer = await create_timer(client, ship["id"])
        # Timer starts paused
        assert timer["paused_at"] is not None

        resp = await client.post(f"/api/timers/{timer['id']}/resume")
        assert resp.status_code == 200
        resumed = resp.json()
        assert resumed["paused_at"] is None

    async def test_resume_not_paused(self, client, ship):
        """Resuming a running timer should fail."""
        timer = await create_timer(client, ship["id"])
        # Timer starts paused, resume it first
        await client.post(f"/api/timers/{timer['id']}/resume")

        # Try to resume again
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


class TestCountupTimers:
    """Tests for countup (elapsed time) timers."""

    async def test_create_countup_timer(self, client, ship):
        timer = await create_countup_timer(client, ship["id"], "Time in Hyperspace")
        assert timer["label"] == "Time in Hyperspace"
        assert timer["direction"] == "countup"
        assert timer["start_time"] is not None
        assert timer["end_time"] is None

    async def test_countup_rejects_end_time(self, client, ship):
        """Countup timers cannot have end_time."""
        end_time = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
        resp = await client.post("/api/timers", json={
            "ship_id": ship["id"],
            "label": "Invalid Countup",
            "direction": "countup",
            "end_time": end_time,
        })
        assert resp.status_code == 422  # Validation error

    async def test_countup_rejects_duration(self, client, ship):
        """Countup timers cannot have duration_seconds."""
        resp = await client.post("/api/timers", json={
            "ship_id": ship["id"],
            "label": "Invalid Countup",
            "direction": "countup",
            "duration_seconds": 60,
        })
        assert resp.status_code == 422

    async def test_countup_rejects_scenario(self, client, ship):
        """Countup timers cannot have scenario_id (no auto-trigger)."""
        resp = await client.post("/api/timers", json={
            "ship_id": ship["id"],
            "label": "Invalid Countup",
            "direction": "countup",
            "scenario_id": "some-scenario",
        })
        assert resp.status_code == 422

    async def test_countup_pause_resume(self, client, ship):
        """Test pause/resume adjusts start_time for countup."""
        timer = await create_countup_timer(client, ship["id"])
        # Timer starts paused
        assert timer["paused_at"] is not None

        # Resume first to start the timer
        resp = await client.post(f"/api/timers/{timer['id']}/resume")
        assert resp.status_code == 200
        started = resp.json()
        original_start = started["start_time"]

        # Pause
        resp = await client.post(f"/api/timers/{timer['id']}/pause")
        assert resp.status_code == 200
        paused = resp.json()
        assert paused["paused_at"] is not None

        # Resume again - start_time should be adjusted forward
        resp = await client.post(f"/api/timers/{timer['id']}/resume")
        assert resp.status_code == 200
        resumed = resp.json()
        assert resumed["paused_at"] is None
        # Start time should be later (adjusted forward by pause duration)
        assert resumed["start_time"] >= original_start


class TestTimerGmOnly:
    """Tests for gm_only filter."""

    async def test_create_gm_only_timer(self, client, ship):
        timer = await create_timer(client, ship["id"], "GM Delay", gm_only=True)
        assert timer["gm_only"] is True

    async def test_filter_gm_only_true(self, client, ship):
        """gm_only=true returns only GM-only timers."""
        await create_timer(client, ship["id"], "Player Timer", gm_only=False)
        await create_timer(client, ship["id"], "GM Timer", gm_only=True)

        resp = await client.get(f"/api/timers?ship_id={ship['id']}&gm_only=true")
        assert resp.status_code == 200
        timers = resp.json()
        assert all(t["gm_only"] for t in timers)
        assert any(t["label"] == "GM Timer" for t in timers)

    async def test_filter_gm_only_false(self, client, ship):
        """gm_only=false returns only player-visible timers."""
        await create_timer(client, ship["id"], "Player Timer", gm_only=False)
        await create_timer(client, ship["id"], "GM Timer", gm_only=True)

        resp = await client.get(f"/api/timers?ship_id={ship['id']}&gm_only=false")
        assert resp.status_code == 200
        timers = resp.json()
        assert all(not t["gm_only"] for t in timers)
        assert any(t["label"] == "Player Timer" for t in timers)

    async def test_filter_gm_only_omitted(self, client, ship):
        """Omitting gm_only returns all timers."""
        await create_timer(client, ship["id"], "Player Timer", gm_only=False)
        await create_timer(client, ship["id"], "GM Timer", gm_only=True)

        resp = await client.get(f"/api/timers?ship_id={ship['id']}")
        assert resp.status_code == 200
        timers = resp.json()
        labels = [t["label"] for t in timers]
        assert "Player Timer" in labels
        assert "GM Timer" in labels


class TestTimerDisplayPreset:
    """Tests for display_preset field."""

    async def test_default_display_preset(self, client, ship):
        timer = await create_timer(client, ship["id"])
        assert timer["display_preset"] == "full"

    async def test_create_with_display_preset(self, client, ship):
        timer = await create_timer(client, ship["id"], "Suspense", display_preset="time_only")
        assert timer["display_preset"] == "time_only"

    async def test_update_display_preset(self, client, ship):
        timer = await create_timer(client, ship["id"])
        resp = await client.patch(f"/api/timers/{timer['id']}", json={
            "display_preset": "title_only",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["display_preset"] == "title_only"


class TestTimerReset:
    """Tests for reset endpoint."""

    async def test_reset_countdown_timer(self, client, ship):
        """Resetting a countdown timer restarts from original duration, stays paused."""
        timer = await create_timer(client, ship["id"], duration_seconds=60)
        original_end = timer["end_time"]

        # Reset it
        resp = await client.post(f"/api/timers/{timer['id']}/reset")
        assert resp.status_code == 200
        reset_timer = resp.json()

        # End time should be later than original (reset extends from now)
        assert reset_timer["end_time"] >= original_end
        # Timer stays paused after reset - user must explicitly start it
        assert reset_timer["paused_at"] is not None

    async def test_reset_paused_countdown(self, client, ship):
        """Resetting a paused countdown keeps it paused."""
        timer = await create_timer(client, ship["id"], duration_seconds=60)
        # Timer starts paused already

        # Reset it
        resp = await client.post(f"/api/timers/{timer['id']}/reset")
        assert resp.status_code == 200
        reset_timer = resp.json()
        # Still paused after reset
        assert reset_timer["paused_at"] is not None

    async def test_reset_countup_timer(self, client, ship):
        """Resetting a countup timer sets start_time to now, stays paused."""
        timer = await create_countup_timer(client, ship["id"])
        original_start = timer["start_time"]

        resp = await client.post(f"/api/timers/{timer['id']}/reset")
        assert resp.status_code == 200
        reset_timer = resp.json()

        # Start time should be later (reset to now)
        assert reset_timer["start_time"] >= original_start
        # Timer stays paused after reset
        assert reset_timer["paused_at"] is not None

    async def test_reset_not_found(self, client):
        """Reset on nonexistent timer returns 404."""
        resp = await client.post("/api/timers/nonexistent/reset")
        assert resp.status_code == 404
