"""
Holomap API endpoints for deck plans and markers.
"""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse
from PIL import Image

import aiosqlite

from app.config import settings
from app.database import get_db
from app.models.holomap import (
    HolomapLayer,
    HolomapLayerCreate,
    HolomapLayerUpdate,
    HolomapLayerWithMarkers,
    HolomapMarker,
    HolomapMarkerCreate,
    HolomapMarkerUpdate,
)

router = APIRouter()

# Allowed image extensions and max file size
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def parse_layer(row: aiosqlite.Row) -> dict:
    """Parse layer row, converting boolean fields."""
    result = dict(row)
    result["visible"] = bool(result["visible"])
    return result


def parse_marker(row: aiosqlite.Row) -> dict:
    """Parse marker row."""
    return dict(row)


# =============================================================================
# Layer Endpoints
# =============================================================================


@router.get("/layers", response_model=list[HolomapLayer])
async def list_layers(
    ship_id: Optional[str] = Query(None),
    visible: Optional[bool] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List holomap layers, optionally filtered by ship and visibility."""
    query = "SELECT * FROM holomap_layers WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if visible is not None:
        query += " AND visible = ?"
        params.append(1 if visible else 0)

    query += " ORDER BY sort_order, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_layer(row) for row in rows]


@router.get("/layers/{layer_id}", response_model=HolomapLayerWithMarkers)
async def get_layer(layer_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a layer by ID with all its markers."""
    cursor = await db.execute(
        "SELECT * FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Layer not found")

    layer = parse_layer(row)

    # Fetch markers for this layer
    cursor = await db.execute(
        "SELECT * FROM holomap_markers WHERE layer_id = ? ORDER BY created_at",
        (layer_id,),
    )
    marker_rows = await cursor.fetchall()
    layer["markers"] = [parse_marker(r) for r in marker_rows]

    return layer


@router.post("/layers", response_model=HolomapLayer)
async def create_layer(
    layer: HolomapLayerCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new holomap layer."""
    layer_id = layer.id if layer.id else str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO holomap_layers (id, ship_id, name, image_url, deck_level, sort_order, visible, image_scale, image_offset_x, image_offset_y, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            layer_id,
            layer.ship_id,
            layer.name,
            layer.image_url,
            layer.deck_level,
            layer.sort_order,
            1 if layer.visible else 0,
            layer.image_scale,
            layer.image_offset_x,
            layer.image_offset_y,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    return parse_layer(await cursor.fetchone())


@router.patch("/layers/{layer_id}", response_model=HolomapLayer)
async def update_layer(
    layer_id: str,
    layer: HolomapLayerUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a holomap layer."""
    cursor = await db.execute(
        "SELECT * FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Layer not found")

    update_data = layer.model_dump(exclude_unset=True)

    updates = []
    values = []

    for field, value in update_data.items():
        if field == "visible":
            value = 1 if value else 0
        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(layer_id)
        await db.execute(
            f"UPDATE holomap_layers SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute(
        "SELECT * FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    return parse_layer(await cursor.fetchone())


@router.delete("/layers/{layer_id}")
async def delete_layer(layer_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a holomap layer (cascades to markers via foreign key)."""
    cursor = await db.execute(
        "SELECT * FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Layer not found")

    # Delete associated image file if it exists
    layer = dict(existing)
    if layer["image_url"] and layer["image_url"] != "placeholder":
        image_path = Path(settings.uploads_dir) / "holomap" / Path(layer["image_url"]).name
        if image_path.exists():
            os.remove(image_path)

    await db.execute("DELETE FROM holomap_layers WHERE id = ?", (layer_id,))
    await db.commit()
    return {"deleted": True}


# =============================================================================
# Image Upload Endpoints
# =============================================================================


@router.post("/layers/{layer_id}/upload")
async def upload_layer_image(
    layer_id: str,
    file: UploadFile = File(...),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Upload an image for a holomap layer. Returns image info including dimensions."""
    # Verify layer exists
    cursor = await db.execute(
        "SELECT * FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Layer not found")

    layer = dict(existing)

    # Validate file extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    # Create uploads directory
    upload_dir = Path(settings.uploads_dir) / "holomap"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Delete old image if it exists
    if layer["image_url"] and layer["image_url"] != "placeholder":
        old_path = upload_dir / Path(layer["image_url"]).name
        if old_path.exists():
            os.remove(old_path)

    # Generate unique filename
    filename = f"{layer_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = upload_dir / filename

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Get image dimensions (if not SVG)
    width, height = 0, 0
    if ext != ".svg":
        try:
            with Image.open(file_path) as img:
                width, height = img.size
        except Exception:
            pass

    # Update layer with new image URL
    image_url = f"/uploads/holomap/{filename}"
    now = datetime.utcnow().isoformat()

    await db.execute(
        "UPDATE holomap_layers SET image_url = ?, updated_at = ? WHERE id = ?",
        (image_url, now, layer_id),
    )
    await db.commit()

    return {
        "image_url": image_url,
        "filename": filename,
        "width": width,
        "height": height,
        "aspect_ratio": round(width / height, 3) if height > 0 else 0,
    }


@router.delete("/layers/{layer_id}/image")
async def delete_layer_image(
    layer_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Delete the image for a holomap layer, reverting to placeholder."""
    cursor = await db.execute(
        "SELECT * FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Layer not found")

    layer = dict(existing)

    # Delete image file if it exists
    if layer["image_url"] and layer["image_url"] != "placeholder":
        image_path = Path(settings.uploads_dir) / "holomap" / Path(layer["image_url"]).name
        if image_path.exists():
            os.remove(image_path)

    # Update layer to use placeholder
    now = datetime.utcnow().isoformat()
    await db.execute(
        "UPDATE holomap_layers SET image_url = 'placeholder', updated_at = ? WHERE id = ?",
        (now, layer_id),
    )
    await db.commit()

    return {"deleted": True, "image_url": "placeholder"}


# =============================================================================
# Marker Endpoints
# =============================================================================


@router.get("/layers/{layer_id}/markers", response_model=list[HolomapMarker])
async def list_markers(
    layer_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all markers for a layer."""
    # Verify layer exists
    cursor = await db.execute(
        "SELECT id FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Layer not found")

    cursor = await db.execute(
        "SELECT * FROM holomap_markers WHERE layer_id = ? ORDER BY created_at",
        (layer_id,),
    )
    rows = await cursor.fetchall()
    return [parse_marker(row) for row in rows]


@router.post("/layers/{layer_id}/markers", response_model=HolomapMarker)
async def create_marker(
    layer_id: str,
    marker: HolomapMarkerCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a new marker on a layer."""
    # Verify layer exists
    cursor = await db.execute(
        "SELECT id FROM holomap_layers WHERE id = ?", (layer_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Layer not found")

    marker_id = marker.id if marker.id else str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Validate linked IDs if provided
    if marker.linked_incident_id:
        cursor = await db.execute(
            "SELECT id FROM incidents WHERE id = ?", (marker.linked_incident_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Linked incident not found")

    if marker.linked_task_id:
        cursor = await db.execute(
            "SELECT id FROM tasks WHERE id = ?", (marker.linked_task_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Linked task not found")

    await db.execute(
        """
        INSERT INTO holomap_markers (id, layer_id, type, x, y, severity, label, description, linked_incident_id, linked_task_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            marker_id,
            layer_id,
            marker.type.value,
            marker.x,
            marker.y,
            marker.severity.value if marker.severity else None,
            marker.label,
            marker.description,
            marker.linked_incident_id,
            marker.linked_task_id,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT * FROM holomap_markers WHERE id = ?", (marker_id,)
    )
    return parse_marker(await cursor.fetchone())


@router.get("/markers/{marker_id}", response_model=HolomapMarker)
async def get_marker(marker_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a marker by ID."""
    cursor = await db.execute(
        "SELECT * FROM holomap_markers WHERE id = ?", (marker_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Marker not found")
    return parse_marker(row)


@router.patch("/markers/{marker_id}", response_model=HolomapMarker)
async def update_marker(
    marker_id: str,
    marker: HolomapMarkerUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a marker."""
    cursor = await db.execute(
        "SELECT * FROM holomap_markers WHERE id = ?", (marker_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Marker not found")

    update_data = marker.model_dump(exclude_unset=True)

    # Validate linked IDs if being updated
    if "linked_incident_id" in update_data and update_data["linked_incident_id"]:
        cursor = await db.execute(
            "SELECT id FROM incidents WHERE id = ?",
            (update_data["linked_incident_id"],),
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Linked incident not found")

    if "linked_task_id" in update_data and update_data["linked_task_id"]:
        cursor = await db.execute(
            "SELECT id FROM tasks WHERE id = ?", (update_data["linked_task_id"],)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Linked task not found")

    updates = []
    values = []

    for field, value in update_data.items():
        if field == "type" and value:
            value = value.value
        elif field == "severity" and value:
            value = value.value
        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(marker_id)
        await db.execute(
            f"UPDATE holomap_markers SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute(
        "SELECT * FROM holomap_markers WHERE id = ?", (marker_id,)
    )
    return parse_marker(await cursor.fetchone())


@router.delete("/markers/{marker_id}")
async def delete_marker(marker_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a marker."""
    cursor = await db.execute(
        "SELECT * FROM holomap_markers WHERE id = ?", (marker_id,)
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Marker not found")

    await db.execute("DELETE FROM holomap_markers WHERE id = ?", (marker_id,))
    await db.commit()
    return {"deleted": True}
