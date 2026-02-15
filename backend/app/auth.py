"""
Authentication middleware for admin/GM write operations.

When ADMIN_TOKEN is configured (non-empty and not the default), all write
operations (POST, PATCH, PUT, DELETE) to /api/ routes require a matching
Bearer token. Read operations (GET) remain open so players can fetch data.

Exempt paths:
  - /api/session (ship selection, needed by all roles)
  - /api/health (monitoring)
  - / (root health check)
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)

# Paths that never require auth (even for write methods)
EXEMPT_PREFIXES = ("/api/session", "/api/health")
READ_METHODS = {"GET", "HEAD", "OPTIONS"}


def _auth_enabled() -> bool:
    """Check if authentication is active."""
    token = settings.admin_token
    return bool(token) and token != ""


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware that protects write endpoints with a bearer token."""

    async def dispatch(self, request: Request, call_next):
        # Skip auth if not enabled
        if not _auth_enabled():
            return await call_next(request)

        # Allow read methods
        if request.method in READ_METHODS:
            return await call_next(request)

        # Allow non-API routes (static files, uploads, root)
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)

        # Allow exempt paths
        for prefix in EXEMPT_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # Check bearer token
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=403,
                content={"detail": "Authentication required for write operations"},
            )

        token = auth_header[7:]  # Strip "Bearer "
        if token != settings.admin_token:
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid authentication token"},
            )

        return await call_next(request)
