"""
Application configuration using pydantic-settings.
"""

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

    # Security (MVP: simple role header)
    admin_token: str = "dev-admin-token"

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
