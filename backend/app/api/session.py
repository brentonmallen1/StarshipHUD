"""
Session management API for ship selection.

Manages the current ship selection via cookies.
"""

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

router = APIRouter()

# Cookie configuration
COOKIE_NAME = "starship_hud_ship_id"
COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days in seconds


class SetShipRequest(BaseModel):
    ship_id: str


class ShipSessionResponse(BaseModel):
    ship_id: str | None = None


@router.post("/ship", response_model=ShipSessionResponse)
async def set_current_ship(
    request: SetShipRequest,
    response: Response,
):
    """Set the current ship selection via cookie."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=request.ship_id,
        max_age=COOKIE_MAX_AGE,
        httponly=False,  # Frontend needs to read it
        samesite="lax",
        path="/",
    )
    return ShipSessionResponse(ship_id=request.ship_id)


@router.get("/ship", response_model=ShipSessionResponse)
async def get_current_ship(
    starship_hud_ship_id: str | None = Cookie(None),
):
    """Get the current ship selection from cookie."""
    return ShipSessionResponse(ship_id=starship_hud_ship_id)


@router.delete("/ship", response_model=ShipSessionResponse)
async def clear_current_ship(
    response: Response,
):
    """Clear the current ship selection cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
    )
    return ShipSessionResponse(ship_id=None)
