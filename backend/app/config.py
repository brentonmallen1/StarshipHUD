"""
Application configuration using pydantic-settings.
"""

import secrets

from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Version
    app_version: str = "dev"

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/starship.db"

    # Uploads
    uploads_dir: str = "./data/uploads"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True

    # Seeding
    seed_demo_ship: bool = True

    # Authentication
    auth_enabled: bool = False  # Set to True to require authentication
    secret_key: str = secrets.token_urlsafe(32)  # Override in production!
    session_lifetime_days: int = 30
    admin_username: str = "admin"
    admin_password: str | None = None  # If None, generate random on first run

    model_config = ConfigDict(
        # Look for .env in both current dir (backend/) and parent dir (project root)
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore env vars not defined in this class
    )


settings = Settings()
