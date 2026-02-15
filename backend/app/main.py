"""
Starship HUD Backend - FastAPI Application
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import AuthMiddleware
from app.config import settings
from app.database import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await init_db()

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

# Auth middleware (checks bearer token on write operations)
app.add_middleware(AuthMiddleware)


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


# Import and include routers
from app.api import ships, panels, system_states, events, scenarios, contacts, crew, tasks, incidents, assets, cargo, cargo_bays, cargo_categories, cargo_placements, holomap, sensor_contacts, session, uploads  # noqa: E402

app.include_router(session.router, prefix="/api/session", tags=["session"])
app.include_router(ships.router, prefix="/api/ships", tags=["ships"])
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
app.include_router(uploads.router, prefix="/api/uploads/widget-assets", tags=["uploads"])

# Static file serving for uploads (ensure directory exists first)
_uploads_path = Path(settings.uploads_dir)
_uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_path)), name="uploads")
