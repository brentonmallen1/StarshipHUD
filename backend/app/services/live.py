"""
In-process change notifications for live UI updates.

Every successful mutating API request bumps a version counter (see the
middleware in main.py). Clients hold a server-sent events stream open and
refetch their data when the version changes, so GM actions reach player
screens immediately instead of on the next poll.

This assumes a single application process, which is how the app is deployed
(one uvicorn worker in the unified container).
"""

import asyncio


class ChangeBroker:
    def __init__(self) -> None:
        self.version = 0
        self._changed = asyncio.Event()

    def notify(self) -> None:
        self.version += 1
        # Wake every waiter, then re-arm for the next change
        self._changed.set()
        self._changed = asyncio.Event()

    async def wait_for_change(self, since: int, timeout: float) -> bool:
        """Return True once version moves past `since`, False on timeout."""
        if self.version != since:
            return True
        try:
            await asyncio.wait_for(self._changed.wait(), timeout)
        except TimeoutError:
            return False
        return True


broker = ChangeBroker()
