"""
Ship export/import API endpoints.

The export/import logic lives in app/services/ship_transfer.py.
"""

import io
from datetime import UTC, datetime

import aiosqlite
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.database import get_db
from app.services.ship_transfer import (
    MAX_IMPORT_ZIP_BYTES,
    export_ship_to_zip,
    import_ship_from_zip,
    sanitize_filename,
)
from app.services.uploads import read_upload_limited

router = APIRouter()

@router.get("/{ship_id}/export")
async def export_ship(ship_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Export a ship's data and assets to a ZIP file."""
    zip_bytes = await export_ship_to_zip(db, ship_id)

    # Get ship name for filename
    cursor = await db.execute("SELECT name FROM ships WHERE id = ?", (ship_id,))
    ship_row = await cursor.fetchone()
    ship_name = sanitize_filename(ship_row["name"]) if ship_row else "ship"

    date_str = datetime.now(UTC).strftime("%Y%m%d")
    filename = f"ship-export-{ship_name}-{date_str}.zip"

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_ship(
    file: UploadFile = File(...),
    new_name: str | None = Form(None),
    replace_existing: bool = Form(False),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Import a ship from a ZIP file.

    If a ship with the same name exists:
    - Without replace_existing: returns conflict info with suggested name
    - With replace_existing=true: replaces the existing ship (atomically)
    - With new_name: uses the provided name instead
    """
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="File must be a ZIP archive")

    zip_bytes = await read_upload_limited(file, MAX_IMPORT_ZIP_BYTES)
    return await import_ship_from_zip(db, zip_bytes, new_name, replace_existing)
