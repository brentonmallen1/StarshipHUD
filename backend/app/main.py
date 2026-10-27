"""
Starship HUD Backend - FastAPI Application
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import and include routers
from app.api import (
    assets,
    auth,
    cargo,
    cargo_bays,
    cargo_categories,
    cargo_placements,
    contacts,
    crew,
    events,
    holomap,
    incidents,
    panels,
    scenarios,
    sector_map,
    sensor_contacts,
    ship_access,
    ship_transfer,
    ships,
    system_categories,
    system_states,
    tasks,
    theme,
    timers,
    uploads,
    users,
)  # noqa: E402
from app.config import settings
from app.database import init_db
from app.services.auth import get_current_user
from app.services.authz import authorize_request
from app.services.uploads import UploadsStaticFiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")


async def bootstrap_admin():
    """Create initial admin user if none exists."""
    import aiosqlite

    from app.database import DB_PATH
    from app.services.auth import generate_random_password, hash_password

    async with aiosqlite.connect(DB_PATH) as db:
        # Check if any users exist
        cursor = await db.execute("SELECT COUNT(*) FROM users")
        count = (await cursor.fetchone())[0]

        if count == 0 and settings.auth_enabled:
            from nanoid import generate as nanoid

            user_id = nanoid(size=21)
            username = settings.admin_username

            # Use configured password or generate random
            if settings.admin_password:
                password = settings.admin_password
                print(f"[bootstrap] Created admin user '{username}' with configured password")
            else:
                password = generate_random_password(16)
                print(f"[bootstrap] Created admin user '{username}' with temporary password: {password}")
                print("[bootstrap] Save this password - it won't be shown again!")

            password_hash = hash_password(password)

            # Bootstrapped admin doesn't require password change (they saw it in logs)
            await db.execute(
                """
                INSERT INTO users (id, username, display_name, password_hash, role,
                                  is_active, must_change_password)
                VALUES (?, ?, ?, ?, 'admin', 1, 0)
                """,
                (user_id, username, "Administrator", password_hash),
            )
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await init_db()
    await bootstrap_admin()

    # Ensure uploads directory exists
    uploads_path = Path(settings.uploads_dir)
    uploads_path.mkdir(parents=True, exist_ok=True)

    yield
    # Shutdown
    pass


app = FastAPI(
    title="Starship HUD API",
    description="Backend API for the Starship HUD tabletop campaign tool",
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "operational", "service": "starship-hud"}


@app.get("/api/health")
async def health():
    """Detailed health check."""
    return {
        "status": "operational",
        "version": settings.app_version,
        "database": "connected",
    }


# Auth endpoints, /, /api/health and theme (cookie-only, read by the login page)
# are public. users/ship_access do their own role checks; every domain router
# goes through authorize_request (401 for anonymous, per-ship role + player
# allowlist + visibility). With AUTH_ENABLED=false the caller is a mock admin.
_require_login = [Depends(get_current_user)]
_domain_auth = [Depends(authorize_request)]

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(users.router, prefix="/api", tags=["users"], dependencies=_require_login)
app.include_router(theme.router, prefix="/api/theme", tags=["theme"])
app.include_router(ship_access.router, prefix="/api", tags=["ship_access"], dependencies=_require_login)

_DOMAIN_ROUTERS = [
    (ships.router, "/api/ships", "ships"),
    (ship_transfer.router, "/api/ships", "ship-transfer"),
    (panels.ships_router, "/api/ships", "panels"),
    (panels.router, "/api/panels", "panels"),
    (system_states.router, "/api/system-states", "system-states"),
    (system_categories.router, "/api/system-categories", "system-categories"),
    (events.router, "/api/events", "events"),
    (scenarios.router, "/api/scenarios", "scenarios"),
    (contacts.router, "/api/contacts", "contacts"),
    (crew.router, "/api/crew", "crew"),
    (sensor_contacts.router, "/api/sensor-contacts", "sensor-contacts"),
    (tasks.router, "/api/tasks", "tasks"),
    (incidents.router, "/api/incidents", "incidents"),
    (assets.router, "/api/assets", "assets"),
    (cargo.router, "/api/cargo", "cargo"),
    (cargo_bays.router, "/api/cargo-bays", "cargo-bays"),
    (cargo_categories.router, "/api/cargo-categories", "cargo-categories"),
    (cargo_placements.router, "/api/cargo-placements", "cargo-placements"),
    (holomap.router, "/api/holomap", "holomap"),
    (sector_map.router, "/api/sector-maps", "sector-maps"),
    (timers.router, "/api/timers", "timers"),
    (uploads.router, "/api/uploads/widget-assets", "uploads"),
]
for _router, _prefix, _tag in _DOMAIN_ROUTERS:
    app.include_router(_router, prefix=_prefix, tags=[_tag], dependencies=_domain_auth)

# Static file serving for uploads (ensure directory exists first)
_uploads_path = Path(settings.uploads_dir)
_uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", UploadsStaticFiles(directory=str(_uploads_path)), name="uploads")
