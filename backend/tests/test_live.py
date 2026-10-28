"""
Tests for live update notifications (change broker, middleware, SSE stream).
"""

import asyncio

from app.api import live
from app.services.live import ChangeBroker, broker


async def test_broker_wakes_waiters_on_change():
    b = ChangeBroker()
    waiter = asyncio.create_task(b.wait_for_change(b.version, timeout=1))
    await asyncio.sleep(0)
    b.notify()
    assert await waiter is True
    assert b.version == 1


async def test_broker_times_out_without_change():
    b = ChangeBroker()
    assert await b.wait_for_change(b.version, timeout=0.01) is False


async def test_broker_returns_immediately_if_already_changed():
    b = ChangeBroker()
    b.notify()
    assert await b.wait_for_change(0, timeout=0.01) is True


async def test_successful_mutation_notifies(client, ship):
    before = broker.version
    resp = await client.patch(f"/api/ships/{ship['id']}", json={"name": "Renamed"})
    assert resp.status_code == 200
    assert broker.version > before


async def test_reads_and_failed_mutations_do_not_notify(client, ship):
    before = broker.version
    await client.get(f"/api/ships/{ship['id']}")
    resp = await client.patch("/api/ships/does-not-exist", json={"name": "x"})
    assert resp.status_code == 404
    assert broker.version == before


class _FakeRequest:
    def __init__(self, disconnect_after: int):
        self.checks = 0
        self.disconnect_after = disconnect_after

    async def is_disconnected(self) -> bool:
        self.checks += 1
        return self.checks > self.disconnect_after


async def test_stream_emits_change_event(monkeypatch):
    monkeypatch.setattr(live, "COALESCE_SECONDS", 0)
    gen = live.change_events(_FakeRequest(disconnect_after=1))
    assert await gen.__anext__() == "retry: 3000\n\n"
    pending = asyncio.create_task(gen.__anext__())
    await asyncio.sleep(0)
    broker.notify()
    message = await asyncio.wait_for(pending, timeout=1)
    assert message == f"event: change\ndata: {broker.version}\n\n"
    await gen.aclose()


async def test_stream_sends_keepalive(monkeypatch):
    monkeypatch.setattr(live, "KEEPALIVE_SECONDS", 0.01)
    gen = live.change_events(_FakeRequest(disconnect_after=1))
    await gen.__anext__()
    assert await gen.__anext__() == ": keepalive\n\n"
    await gen.aclose()
