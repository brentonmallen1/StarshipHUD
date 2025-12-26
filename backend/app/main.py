"""
Starship HUD Backend - FastAPI Application
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await init_db()
    yield
    # Shutdown
    pass


app = FastAPI(
    title="Starship HUD API",
    description="Backend API for the Starship HUD tabletop campaign tool",
    version="0.1.0",
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
        "version": "0.1.0",
        "database": "connected",
    }


# Import and include routers
from app.api import ships, panels, system_states, events, scenarios, contacts, tasks, incidents, assets, cargo  # noqa: E402

app.include_router(ships.router, prefix="/api/ships", tags=["ships"])
app.include_router(panels.router, prefix="/api/panels", tags=["panels"])
app.include_router(system_states.router, prefix="/api/system-states", tags=["system-states"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(scenarios.router, prefix="/api/scenarios", tags=["scenarios"])
app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["incidents"])
app.include_router(assets.router, prefix="/api/assets", tags=["assets"])
app.include_router(cargo.router, prefix="/api/cargo", tags=["cargo"])
