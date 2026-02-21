"""
Generic file upload endpoint for widget assets (images, GIFs, etc.)
"""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.config import settings

router = APIRouter()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("")
async def upload_widget_asset(
    file: UploadFile = File(...),
):
    """
    Upload an image/GIF for use in widgets.
    Returns the public URL of the uploaded file.
    The URL is stored in the widget's config JSON — no separate DB table needed.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    upload_dir = Path(settings.uploads_dir) / "widget-assets"
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "image_url": f"/uploads/widget-assets/{filename}",
        "filename": filename,
    }


@router.get("")
async def list_widget_assets():
    """List all uploaded widget assets, sorted by filename."""
    upload_dir = Path(settings.uploads_dir) / "widget-assets"
    if not upload_dir.exists():
        return []
    assets = []
    for file_path in sorted(upload_dir.iterdir()):
        if file_path.is_file() and file_path.suffix.lower() in ALLOWED_EXTENSIONS:
            assets.append({
                "image_url": f"/uploads/widget-assets/{file_path.name}",
                "filename": file_path.name,
            })
    return assets


@router.delete("")
async def delete_widget_asset(
    image_url: str = Query(..., description="The URL of the asset to delete"),
):
    """Delete an uploaded widget asset by its URL."""
    if not image_url.startswith("/uploads/widget-assets/"):
        raise HTTPException(status_code=400, detail="Invalid asset URL")

    filename = Path(image_url).name
    file_path = Path(settings.uploads_dir) / "widget-assets" / filename

    if file_path.exists():
        os.remove(file_path)
        return {"deleted": True}

    raise HTTPException(status_code=404, detail="Asset not found")
