"""
Starship HUD Backend - FastAPI Application
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
    session,
    ship_access,
    ship_transfer,
    ships,
    system_states,
    tasks,
    theme,
    timers,
    uploads,
    users,
)  # noqa: E402
from app.config import settings
from app.database import init_db

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
                print("[bootstrap] Please change this password after first login!")

            password_hash = hash_password(password)

            await db.execute(
                """
                INSERT INTO users (id, username, display_name, password_hash, role,
                                  is_active, must_change_password)
                VALUES (?, ?, ?, ?, 'admin', 1, ?)
                """,
                (user_id, username, "Administrator", password_hash, 0 if settings.admin_password else 1),
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


app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(session.router, prefix="/api/session", tags=["session"])
app.include_router(theme.router, prefix="/api/theme", tags=["theme"])
app.include_router(ships.router, prefix="/api/ships", tags=["ships"])
app.include_router(ship_access.router, prefix="/api", tags=["ship_access"])
app.include_router(ship_transfer.router, prefix="/api/ships", tags=["ship-transfer"])
app.include_router(panels.ships_router, prefix="/api/ships", tags=["panels"])
app.include_router(panels.router, prefix="/api/panels", tags=["panels"])
app.include_router(system_states.router, prefix="/api/system-states", tags=["system-states"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(scenarios.router, prefix="/api/scenarios", tags=["scenarios"])
app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
app.include_router(crew.router, prefix="/api/crew", tags=["crew"])
app.include_router(sensor_contacts.router, prefix="/api/sensor-contacts", tags=["sensor-contacts"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["incidents"])
app.include_router(assets.router, prefix="/api/assets", tags=["assets"])
app.include_router(cargo.router, prefix="/api/cargo", tags=["cargo"])
app.include_router(cargo_bays.router, prefix="/api/cargo-bays", tags=["cargo-bays"])
app.include_router(cargo_categories.router, prefix="/api/cargo-categories", tags=["cargo-categories"])
app.include_router(cargo_placements.router, prefix="/api/cargo-placements", tags=["cargo-placements"])
app.include_router(holomap.router, prefix="/api/holomap", tags=["holomap"])
app.include_router(sector_map.router, prefix="/api/sector-maps", tags=["sector-maps"])
app.include_router(timers.router, prefix="/api/timers", tags=["timers"])
app.include_router(uploads.router, prefix="/api/uploads/widget-assets", tags=["uploads"])

# Static file serving for uploads (ensure directory exists first)
_uploads_path = Path(settings.uploads_dir)
_uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_path)), name="uploads")
