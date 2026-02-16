"""
Panel API endpoints.
"""

import json
import uuid
from datetime import datetime

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.panel import (
    Panel,
    PanelCreate,
    PanelUpdate,
    PanelWithWidgets,
    WidgetInstance,
    WidgetInstanceCreate,
    WidgetInstanceUpdate,
)
from app.utils import safe_json_loads

router = APIRouter()


def parse_panel(row: aiosqlite.Row) -> dict:
    """Parse panel row, converting JSON fields."""
    result = dict(row)
    result["role_visibility"] = safe_json_loads(
        result["role_visibility"], default=["player", "gm"], field_name="role_visibility"
    )
    return result


def parse_widget(row: aiosqlite.Row) -> dict:
    """Parse widget row, converting JSON fields."""
    result = dict(row)
    result["config"] = safe_json_loads(result["config"], default={}, field_name="config")
    result["bindings"] = safe_json_loads(result["bindings"], default={}, field_name="bindings")
    return result


def rectangles_overlap(a: dict, b: dict) -> bool:
    """Check if two widget rectangles overlap."""
    # No horizontal overlap if a is entirely left or right of b
    if a["x"] + a["width"] <= b["x"] or b["x"] + b["width"] <= a["x"]:
        return False
    # No vertical overlap if a is entirely above or below b
    if a["y"] + a["height"] <= b["y"] or b["y"] + b["height"] <= a["y"]:
        return False
    return True


def detect_overlaps(widgets: list[dict]) -> list[tuple[dict, dict]]:
    """Return list of overlapping widget pairs."""
    overlaps = []
    for i, a in enumerate(widgets):
        for j, b in enumerate(widgets):
            if i < j and rectangles_overlap(a, b):
                overlaps.append((a, b))
    return overlaps


@router.get("", response_model=list[Panel])
async def list_panels(
    ship_id: str | None = Query(None),
    station_group: str | None = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List panels, optionally filtered by ship or station group."""
    query = "SELECT * FROM panels WHERE 1=1"
    params = []

    if ship_id:
        query += " AND ship_id = ?"
        params.append(ship_id)
    if station_group:
        query += " AND station_group = ?"
        params.append(station_group)

    query += " ORDER BY station_group, sort_order, name"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_panel(row) for row in rows]


@router.get("/by-station")
async def list_panels_by_station(ship_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """List panels grouped by station group."""
    cursor = await db.execute(
        "SELECT * FROM panels WHERE ship_id = ? ORDER BY station_group, sort_order",
        (ship_id,),
    )
    rows = await cursor.fetchall()

    grouped = {}
    for row in rows:
        panel = parse_panel(row)
        station = panel["station_group"]
        if station not in grouped:
            grouped[station] = []
        grouped[station].append(panel)

    return grouped


@router.get("/{panel_id}", response_model=PanelWithWidgets)
async def get_panel(panel_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get a panel with its widgets."""
    cursor = await db.execute("SELECT * FROM panels WHERE id = ?", (panel_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Panel not found")

    panel = parse_panel(row)

    # Get widgets
    cursor = await db.execute(
        "SELECT * FROM widget_instances WHERE panel_id = ? ORDER BY y, x",
        (panel_id,),
    )
    widget_rows = await cursor.fetchall()
    panel["widgets"] = [parse_widget(w) for w in widget_rows]

    return panel


@router.post("", response_model=Panel)
async def create_panel(panel: PanelCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new panel."""
    panel_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO panels (id, ship_id, name, station_group, role_visibility,
            sort_order, icon_id, description, grid_columns, grid_rows, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            panel_id,
            panel.ship_id,
            panel.name,
            panel.station_group.value,
            json.dumps([r.value for r in panel.role_visibility]),
            panel.sort_order,
            panel.icon_id,
            panel.description,
            panel.grid_columns,
            panel.grid_rows,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM panels WHERE id = ?", (panel_id,))
    return parse_panel(await cursor.fetchone())


@router.patch("/{panel_id}", response_model=Panel)
async def update_panel(panel_id: str, panel: PanelUpdate, db: aiosqlite.Connection = Depends(get_db)):
    """Update a panel."""
    cursor = await db.execute("SELECT * FROM panels WHERE id = ?", (panel_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Panel not found")

    updates = []
    values = []
    for field, value in panel.model_dump(exclude_unset=True).items():
        if field == "role_visibility" and value:
            value = json.dumps([r.value for r in value])
        elif field == "station_group" and value:
            value = value.value
        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(panel_id)
        await db.execute(
            f"UPDATE panels SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM panels WHERE id = ?", (panel_id,))
    return parse_panel(await cursor.fetchone())


@router.delete("/{panel_id}")
async def delete_panel(panel_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a panel."""
    cursor = await db.execute("SELECT * FROM panels WHERE id = ?", (panel_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Panel not found")

    await db.execute("DELETE FROM panels WHERE id = ?", (panel_id,))
    await db.commit()
    return {"deleted": True}


# Widget endpoints


@router.get("/{panel_id}/widgets", response_model=list[WidgetInstance])
async def list_widgets(panel_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """List widgets in a panel."""
    cursor = await db.execute(
        "SELECT * FROM widget_instances WHERE panel_id = ? ORDER BY y, x",
        (panel_id,),
    )
    rows = await cursor.fetchall()
    return [parse_widget(row) for row in rows]


@router.post("/{panel_id}/widgets", response_model=WidgetInstance)
async def create_widget(
    panel_id: str,
    widget: WidgetInstanceCreate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Create a widget in a panel."""
    # Verify panel exists
    cursor = await db.execute("SELECT * FROM panels WHERE id = ?", (panel_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Panel not found")

    widget_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    await db.execute(
        """
        INSERT INTO widget_instances (id, panel_id, widget_type, x, y, width, height,
            config, bindings, label, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            widget_id,
            panel_id,
            widget.widget_type,
            widget.x,
            widget.y,
            widget.width,
            widget.height,
            json.dumps(widget.config),
            json.dumps(widget.bindings),
            widget.label,
            now,
            now,
        ),
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM widget_instances WHERE id = ?", (widget_id,))
    return parse_widget(await cursor.fetchone())


@router.patch("/widgets/{widget_id}", response_model=WidgetInstance)
async def update_widget(
    widget_id: str,
    widget: WidgetInstanceUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update a widget."""
    cursor = await db.execute("SELECT * FROM widget_instances WHERE id = ?", (widget_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Widget not found")

    updates = []
    values = []
    for field, value in widget.model_dump(exclude_unset=True).items():
        if field in ["config", "bindings"] and value is not None:
            value = json.dumps(value)
        updates.append(f"{field} = ?")
        values.append(value)

    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(widget_id)
        await db.execute(
            f"UPDATE widget_instances SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
            values,
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM widget_instances WHERE id = ?", (widget_id,))
    return parse_widget(await cursor.fetchone())


@router.delete("/widgets/{widget_id}")
async def delete_widget(widget_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Delete a widget."""
    cursor = await db.execute("SELECT * FROM widget_instances WHERE id = ?", (widget_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Widget not found")

    await db.execute("DELETE FROM widget_instances WHERE id = ?", (widget_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/{panel_id}/layout")
async def batch_update_layout(
    panel_id: str,
    widgets: list[dict],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Batch update widget positions."""
    cursor = await db.execute("SELECT * FROM panels WHERE id = ?", (panel_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Panel not found")

    # Validate no overlapping widgets
    overlaps = detect_overlaps(widgets)
    if overlaps:
        details = [f"Widget {a['id'][:8]}... overlaps with {b['id'][:8]}..." for a, b in overlaps]
        raise HTTPException(
            status_code=400,
            detail=f"Layout contains overlapping widgets: {'; '.join(details)}",
        )

    now = datetime.utcnow().isoformat()
    for w in widgets:
        await db.execute(
            """
            UPDATE widget_instances
            SET x = ?, y = ?, width = ?, height = ?, updated_at = ?
            WHERE id = ? AND panel_id = ?
            """,
            (w["x"], w["y"], w["width"], w["height"], now, w["id"], panel_id),
        )
    await db.commit()

    return {"updated": len(widgets)}
