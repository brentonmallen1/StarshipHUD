"""
Live update stream (server-sent events).
"""

import asyncio
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.services.authz import AuthzDep
from app.services.live import broker

router = APIRouter()

KEEPALIVE_SECONDS = 15.0
# Batch bursts (e.g. a GM dragging a slider) into a single refetch
COALESCE_SECONDS = 0.25


async def change_events(request: Request) -> AsyncIterator[str]:
    yield "retry: 3000\n\n"
    seen = broker.version
    while not await request.is_disconnected():
        if await broker.wait_for_change(seen, KEEPALIVE_SECONDS):
            await asyncio.sleep(COALESCE_SECONDS)
            seen = broker.version
            yield f"event: change\ndata: {seen}\n\n"
        else:
            yield ": keepalive\n\n"


@router.get("/{ship_id}")
async def stream_ship_changes(ship_id: str, request: Request, authz: AuthzDep):
    """Notify the client whenever data changes so it can refetch.

    Authorization (ship access) is enforced by the router dependency; the
    stream itself carries no data, only a change counter.
    """
    return StreamingResponse(
        change_events(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
