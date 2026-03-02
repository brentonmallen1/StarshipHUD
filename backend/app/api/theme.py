"""
Theme settings API for UI customization.

Manages theme preferences (fonts, colors) via cookies.
"""

import json
from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

router = APIRouter()

# Cookie configuration
COOKIE_NAME = "starship_hud_theme"
COOKIE_MAX_AGE = 365 * 24 * 60 * 60  # 1 year in seconds


class ThemeSettings(BaseModel):
    """Theme settings model."""

    font_display: str = "Science Gothic"
    font_mono: str = "JetBrains Mono"
    accent_primary: str = "#58a6ff"
    accent_secondary: str = "#C48F4A"


# Default theme settings
DEFAULT_THEME = ThemeSettings()


@router.get("/", response_model=ThemeSettings)
async def get_theme(
    starship_hud_theme: str | None = Cookie(None),
) -> ThemeSettings:
    """Get the current theme settings from cookie."""
    if starship_hud_theme:
        try:
            data = json.loads(starship_hud_theme)
            return ThemeSettings(**data)
        except (json.JSONDecodeError, ValueError):
            # Invalid cookie data, return defaults
            pass
    return DEFAULT_THEME


@router.post("/", response_model=ThemeSettings)
async def set_theme(
    settings: ThemeSettings,
    response: Response,
) -> ThemeSettings:
    """Save theme settings to cookie."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=settings.model_dump_json(),
        max_age=COOKIE_MAX_AGE,
        httponly=False,  # Frontend needs to read it
        samesite="lax",
        path="/",
    )
    return settings


@router.delete("/", response_model=ThemeSettings)
async def reset_theme(
    response: Response,
) -> ThemeSettings:
    """Reset theme settings to defaults by clearing the cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
    )
    return DEFAULT_THEME
