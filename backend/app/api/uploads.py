"""
Generic file upload endpoint for widget assets (images, GIFs, audio, etc.)
"""

import json
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.config import settings

router = APIRouter()

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".webm"}
ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_AUDIO_EXTENSIONS
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
METADATA_FILE = "asset_metadata.json"


def get_asset_type(filename: str) -> str:
    """Determine asset type from file extension."""
    ext = Path(filename).suffix.lower()
    if ext in ALLOWED_AUDIO_EXTENSIONS:
        return "audio"
    return "image"


def get_metadata_path() -> Path:
    """Get the path to the metadata JSON file."""
    return Path(settings.uploads_dir) / "widget-assets" / METADATA_FILE


def load_metadata() -> dict:
    """Load asset metadata from JSON file."""
    metadata_path = get_metadata_path()
    if metadata_path.exists():
        try:
            with open(metadata_path) as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_metadata(metadata: dict):
    """Save asset metadata to JSON file."""
    metadata_path = get_metadata_path()
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)


class RenameRequest(BaseModel):
    """Request body for renaming an asset."""
    display_name: str


async def process_upload(file: UploadFile) -> dict:
    """Process a single file upload and return asset info."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.filename}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {file.filename}. Max size: {MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    upload_dir = Path(settings.uploads_dir) / "widget-assets"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Store with UUID filename but preserve original name in metadata
    original_filename = file.filename or "unknown"
    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        f.write(content)

    # Save original filename to metadata
    metadata = load_metadata()
    metadata[filename] = {
        "original_filename": original_filename,
        "display_name": Path(original_filename).stem,  # Filename without extension
    }
    save_metadata(metadata)

    asset_type = get_asset_type(filename)
    return {
        "url": f"/uploads/widget-assets/{filename}",
        "image_url": f"/uploads/widget-assets/{filename}",  # backwards compat
        "filename": filename,
        "original_filename": original_filename,
        "display_name": Path(original_filename).stem,
        "type": asset_type,
    }


@router.post("")
async def upload_widget_asset(
    file: UploadFile = File(...),
):
    """
    Upload a single image/audio file for use in widgets.
    Returns the public URL of the uploaded file.
    """
    return await process_upload(file)


@router.post("/batch")
async def upload_widget_assets_batch(
    files: list[UploadFile] = File(...),
):
    """
    Upload multiple images/audio files at once.
    Returns a list of uploaded asset info.
    """
    results = []
    for file in files:
        try:
            result = await process_upload(file)
            results.append(result)
        except HTTPException as e:
            # Include error info for this file
            results.append({
                "error": e.detail,
                "filename": file.filename,
            })
    return results


@router.get("")
async def list_widget_assets():
    """List all uploaded widget assets, sorted by filename."""
    upload_dir = Path(settings.uploads_dir) / "widget-assets"
    if not upload_dir.exists():
        return []

    metadata = load_metadata()
    assets = []
    for file_path in sorted(upload_dir.iterdir()):
        if file_path.is_file() and file_path.suffix.lower() in ALLOWED_EXTENSIONS:
            asset_type = get_asset_type(file_path.name)
            asset_meta = metadata.get(file_path.name, {})
            assets.append({
                "url": f"/uploads/widget-assets/{file_path.name}",
                "image_url": f"/uploads/widget-assets/{file_path.name}",  # backwards compat
                "filename": file_path.name,
                "original_filename": asset_meta.get("original_filename"),
                "display_name": asset_meta.get("display_name", file_path.stem),
                "type": asset_type,
            })
    return assets


@router.patch("/{filename}")
async def rename_widget_asset(
    filename: str,
    request: RenameRequest,
):
    """Rename an uploaded widget asset's display name."""
    file_path = Path(settings.uploads_dir) / "widget-assets" / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Asset not found")

    metadata = load_metadata()
    if filename not in metadata:
        metadata[filename] = {}
    metadata[filename]["display_name"] = request.display_name
    save_metadata(metadata)

    asset_meta = metadata[filename]
    asset_type = get_asset_type(filename)

    return {
        "url": f"/uploads/widget-assets/{filename}",
        "image_url": f"/uploads/widget-assets/{filename}",
        "filename": filename,
        "original_filename": asset_meta.get("original_filename"),
        "display_name": asset_meta.get("display_name", Path(filename).stem),
        "type": asset_type,
    }


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

        # Clean up metadata
        metadata = load_metadata()
        if filename in metadata:
            del metadata[filename]
            save_metadata(metadata)

        return {"deleted": True}

    raise HTTPException(status_code=404, detail="Asset not found")
