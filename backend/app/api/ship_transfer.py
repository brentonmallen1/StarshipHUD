"""
Ship export/import API endpoints.

Allows exporting a ship's complete data (database + assets) to a ZIP file,
and importing from that ZIP to create a new ship.
"""

import io
import json
import logging
import os
import re
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import aiosqlite
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from nanoid import generate

from app.config import settings
from app.database import get_db
from app.utils import safe_json_loads

logger = logging.getLogger(__name__)

router = APIRouter()

# Same nanoid alphabet as ships.py
NANOID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"

# Export version for compatibility checking
EXPORT_VERSION = "1.0"

# Tables to export in dependency order (children after parents)
EXPORT_TABLES = [
    # Core
    "ships",
    # UI (panels must come before widget_instances)
    "panels",
    "widget_instances",
    # Systems
    "system_states",
    "assets",
    "glitch_state",
    "posture_state",
    # Events
    "events",
    "timeline_bookmarks",
    # Incidents (must come before tasks and holomap_markers)
    "incidents",
    "tasks",
    "task_spawn_rules",
    # Scenarios (must come before timers)
    "scenarios",
    "timers",
    # NPCs (contacts must come before sensor_contacts)
    "contacts",
    "crew",
    "sensor_contacts",
    # Holomap (layers must come before markers)
    "holomap_layers",
    "holomap_markers",
    # Cargo (categories must come before cargo, bays before placements)
    "cargo_categories",
    "cargo_bays",
    "cargo",
    "cargo_placements",
    # Sector maps
    "sector_maps",
    "sector_sprites",
    "sector_map_objects",
    "sector_map_waypoints",
    "gm_waypoint_presets",
    # Data
    "datasets",
]

# Tables with ship_id as primary key (1:1 relationship)
SINGLETON_TABLES = {"glitch_state", "posture_state"}

# Foreign key mappings: table -> [(column, referenced_table)]
FK_MAPPINGS = {
    "panels": [("ship_id", "ships")],
    "widget_instances": [("panel_id", "panels")],
    "system_states": [("ship_id", "ships")],
    "assets": [("ship_id", "ships")],
    "glitch_state": [("ship_id", "ships")],
    "posture_state": [("ship_id", "ships")],
    "events": [("ship_id", "ships")],
    "timeline_bookmarks": [("ship_id", "ships"), ("event_id", "events")],
    "incidents": [("ship_id", "ships")],
    "tasks": [("ship_id", "ships"), ("incident_id", "incidents")],
    "task_spawn_rules": [("ship_id", "ships")],
    "scenarios": [("ship_id", "ships")],
    "timers": [("ship_id", "ships"), ("scenario_id", "scenarios")],
    "contacts": [("ship_id", "ships")],
    "crew": [("ship_id", "ships")],
    "sensor_contacts": [("ship_id", "ships"), ("contact_id", "contacts")],
    "holomap_layers": [("ship_id", "ships")],
    "holomap_markers": [
        ("layer_id", "holomap_layers"),
        ("linked_incident_id", "incidents"),
        ("linked_task_id", "tasks"),
    ],
    "cargo_categories": [("ship_id", "ships")],
    "cargo_bays": [("ship_id", "ships")],
    "cargo": [("ship_id", "ships"), ("category_id", "cargo_categories")],
    "cargo_placements": [("cargo_id", "cargo"), ("bay_id", "cargo_bays")],
    "sector_maps": [("ship_id", "ships")],
    "sector_sprites": [("ship_id", "ships")],
    "sector_map_objects": [("map_id", "sector_maps"), ("sprite_id", "sector_sprites")],
    "sector_map_waypoints": [("map_id", "sector_maps")],
    "gm_waypoint_presets": [("ship_id", "ships")],
    "datasets": [("ship_id", "ships")],
}

# JSON columns that may contain ID references
JSON_ID_COLUMNS = {
    "system_states": {"depends_on": "system_states"},
    "assets": {"depends_on": "system_states"},
    "incidents": {"linked_system_ids": "system_states"},
}

# Columns containing asset URLs
ASSET_URL_COLUMNS = {
    "holomap_layers": ["image_url"],
    "sector_maps": ["background_image_url"],
    "sector_sprites": ["image_url"],
    "contacts": ["image_url"],
}


def generate_id(size: int = 12) -> str:
    """Generate a nanoid for record IDs."""
    return generate(NANOID_ALPHABET, size)


def sanitize_filename(name: str) -> str:
    """Sanitize a string for use in filenames."""
    return re.sub(r"[^\w\-]", "_", name.lower())[:50]


async def get_table_rows(db: aiosqlite.Connection, table: str, ship_id: str) -> list[dict]:
    """Get all rows from a table for a specific ship."""
    if table == "ships":
        cursor = await db.execute("SELECT * FROM ships WHERE id = ?", (ship_id,))
    elif table in SINGLETON_TABLES:
        cursor = await db.execute(f"SELECT * FROM {table} WHERE ship_id = ?", (ship_id,))
    elif table == "widget_instances":
        cursor = await db.execute(
            """
            SELECT wi.* FROM widget_instances wi
            JOIN panels p ON wi.panel_id = p.id
            WHERE p.ship_id = ?
            """,
            (ship_id,),
        )
    elif table == "holomap_markers":
        cursor = await db.execute(
            """
            SELECT hm.* FROM holomap_markers hm
            JOIN holomap_layers hl ON hm.layer_id = hl.id
            WHERE hl.ship_id = ?
            """,
            (ship_id,),
        )
    elif table == "cargo_placements":
        cursor = await db.execute(
            """
            SELECT cp.* FROM cargo_placements cp
            JOIN cargo c ON cp.cargo_id = c.id
            WHERE c.ship_id = ?
            """,
            (ship_id,),
        )
    elif table == "sector_map_objects":
        cursor = await db.execute(
            """
            SELECT smo.* FROM sector_map_objects smo
            JOIN sector_maps sm ON smo.map_id = sm.id
            WHERE sm.ship_id = ?
            """,
            (ship_id,),
        )
    elif table == "sector_map_waypoints":
        cursor = await db.execute(
            """
            SELECT smw.* FROM sector_map_waypoints smw
            JOIN sector_maps sm ON smw.map_id = sm.id
            WHERE sm.ship_id = ?
            """,
            (ship_id,),
        )
    else:
        cursor = await db.execute(f"SELECT * FROM {table} WHERE ship_id = ?", (ship_id,))

    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


def collect_asset_urls(data: dict[str, list[dict]]) -> set[str]:
    """Collect all asset URLs from the export data."""
    urls = set()

    for table, columns in ASSET_URL_COLUMNS.items():
        for row in data.get(table, []):
            for col in columns:
                url = row.get(col)
                if url and url.startswith("/uploads/"):
                    urls.add(url)

    # Also check widget_instances config for image_url
    for widget in data.get("widget_instances", []):
        config = widget.get("config")
        if isinstance(config, str):
            config = safe_json_loads(config, default={})
        if isinstance(config, dict):
            # Check common image URL fields in widget config
            for key in ["image_url", "imageUrl", "background_image", "backgroundImage"]:
                url = config.get(key)
                if url and isinstance(url, str) and url.startswith("/uploads/"):
                    urls.add(url)

    return urls


async def export_ship_to_zip(db: aiosqlite.Connection, ship_id: str) -> bytes:
    """Export a ship's data and assets to a ZIP file."""
    # Verify ship exists
    cursor = await db.execute("SELECT name FROM ships WHERE id = ?", (ship_id,))
    ship_row = await cursor.fetchone()
    if not ship_row:
        raise HTTPException(status_code=404, detail="Ship not found")

    ship_name = ship_row["name"]

    # Collect all data
    data = {}
    for table in EXPORT_TABLES:
        rows = await get_table_rows(db, table, ship_id)
        if rows:
            data[table] = rows

    # Collect asset URLs
    asset_urls = collect_asset_urls(data)

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Write manifest
        manifest = {
            "version": EXPORT_VERSION,
            "export_date": datetime.now(UTC).isoformat(),
            "ship_name": ship_name,
            "ship_id": ship_id,
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

        # Write data
        zf.writestr("ship.json", json.dumps(data, indent=2, default=str))

        # Copy asset files
        uploads_dir = Path(settings.uploads_dir)
        for url in asset_urls:
            # URL format: /uploads/subdir/filename
            relative_path = url.removeprefix("/uploads/")
            file_path = uploads_dir / relative_path
            if file_path.exists():
                zf.write(file_path, f"assets/{relative_path}")
            else:
                logger.warning(f"Asset file not found: {file_path}")

    zip_buffer.seek(0)
    return zip_buffer.getvalue()


def remap_ids(data: dict[str, list[dict]], new_ship_id: str) -> tuple[dict[str, list[dict]], dict[str, dict[str, str]]]:
    """
    Remap all IDs in the export data to new values.
    Returns (remapped_data, id_mappings).
    """
    # Build ID mappings for each table
    id_mappings: dict[str, dict[str, str]] = {}

    for table in EXPORT_TABLES:
        if table not in data:
            continue

        id_mappings[table] = {}
        for row in data[table]:
            if table == "ships":
                # Ship gets the pre-determined new ID
                old_id = row.get("id")
                if old_id:
                    id_mappings[table][old_id] = new_ship_id
            elif table in SINGLETON_TABLES:
                # Singleton tables use ship_id as primary key
                old_ship_id = row.get("ship_id")
                if old_ship_id:
                    id_mappings[table][old_ship_id] = new_ship_id
            else:
                old_id = row.get("id")
                if old_id:
                    id_mappings[table][old_id] = generate_id()

    # Apply ID remapping to all records
    remapped_data: dict[str, list[dict]] = {}

    for table in EXPORT_TABLES:
        if table not in data:
            continue

        remapped_data[table] = []
        for row in data[table]:
            new_row = row.copy()

            # Remap primary key
            if table == "ships":
                if "id" in new_row:
                    new_row["id"] = id_mappings[table].get(new_row["id"], new_row["id"])
            elif table in SINGLETON_TABLES:
                if "ship_id" in new_row:
                    new_row["ship_id"] = id_mappings["ships"].get(new_row["ship_id"], new_row["ship_id"])
            else:
                if "id" in new_row:
                    new_row["id"] = id_mappings[table].get(new_row["id"], new_row["id"])

            # Remap foreign keys
            if table in FK_MAPPINGS:
                for col, ref_table in FK_MAPPINGS[table]:
                    if col in new_row and new_row[col] is not None:
                        old_ref = new_row[col]
                        if ref_table in id_mappings and old_ref in id_mappings[ref_table]:
                            new_row[col] = id_mappings[ref_table][old_ref]

            # Remap JSON ID columns
            if table in JSON_ID_COLUMNS:
                for col, ref_table in JSON_ID_COLUMNS[table].items():
                    if col in new_row and new_row[col]:
                        json_val = new_row[col]
                        if isinstance(json_val, str):
                            json_val = safe_json_loads(json_val, default=[])
                        if isinstance(json_val, list) and ref_table in id_mappings:
                            new_ids = [
                                id_mappings[ref_table].get(old_id, old_id) for old_id in json_val
                            ]
                            new_row[col] = json.dumps(new_ids)

            remapped_data[table].append(new_row)

    return remapped_data, id_mappings


def remap_widget_ids(
    data: dict[str, list[dict]], id_mappings: dict[str, dict[str, str]]
) -> dict[str, list[dict]]:
    """
    Remap ID references in widget_instances bindings and config.

    Bindings can contain:
      - system_state_id (string) -> system_states
      - system_state_ids (array) -> system_states
      - asset_id (string) -> assets
      - dataset_id (string) -> datasets

    Config can contain:
      - segments[].primary_id -> system_states (ShieldDisplayWidget)
      - segments[].secondary_id -> system_states (ShieldDisplayWidget)
      - layer_id (string) -> holomap_layers (HolomapWidget)
      - layer_ids (array) -> holomap_layers (HolomapWidget)
    """
    if "widget_instances" not in data:
        return data

    # Mapping of binding keys to their reference tables
    binding_mappings = {
        "system_state_id": "system_states",
        "asset_id": "assets",
        "dataset_id": "datasets",
    }
    binding_array_mappings = {
        "system_state_ids": "system_states",
    }

    for widget in data["widget_instances"]:
        # Remap bindings
        bindings = widget.get("bindings")
        if isinstance(bindings, str):
            bindings = safe_json_loads(bindings, default={})
        if isinstance(bindings, dict):
            modified = False
            # Single ID bindings
            for key, ref_table in binding_mappings.items():
                if key in bindings and bindings[key] and ref_table in id_mappings:
                    old_id = bindings[key]
                    if old_id in id_mappings[ref_table]:
                        bindings[key] = id_mappings[ref_table][old_id]
                        modified = True
            # Array ID bindings
            for key, ref_table in binding_array_mappings.items():
                if key in bindings and bindings[key] and ref_table in id_mappings:
                    old_ids = bindings[key]
                    if isinstance(old_ids, list):
                        new_ids = [
                            id_mappings[ref_table].get(old_id, old_id)
                            for old_id in old_ids
                        ]
                        bindings[key] = new_ids
                        modified = True
            if modified:
                widget["bindings"] = json.dumps(bindings)

        # Remap config IDs
        config = widget.get("config")
        if isinstance(config, str):
            config = safe_json_loads(config, default={})
        if isinstance(config, dict):
            modified = False

            # ShieldDisplayWidget: segments[].primary_id / secondary_id
            if "segments" in config and isinstance(config["segments"], list):
                if "system_states" in id_mappings:
                    for seg in config["segments"]:
                        if isinstance(seg, dict):
                            if "primary_id" in seg and seg["primary_id"]:
                                old_id = seg["primary_id"]
                                if old_id in id_mappings["system_states"]:
                                    seg["primary_id"] = id_mappings["system_states"][old_id]
                                    modified = True
                            if "secondary_id" in seg and seg["secondary_id"]:
                                old_id = seg["secondary_id"]
                                if old_id in id_mappings["system_states"]:
                                    seg["secondary_id"] = id_mappings["system_states"][old_id]
                                    modified = True

            # HolomapWidget: layer_id (single)
            if "layer_id" in config and config["layer_id"]:
                if "holomap_layers" in id_mappings:
                    old_id = config["layer_id"]
                    if old_id in id_mappings["holomap_layers"]:
                        config["layer_id"] = id_mappings["holomap_layers"][old_id]
                        modified = True

            # HolomapWidget: layer_ids (array)
            if "layer_ids" in config and config["layer_ids"]:
                if "holomap_layers" in id_mappings:
                    old_ids = config["layer_ids"]
                    if isinstance(old_ids, list):
                        new_ids = [
                            id_mappings["holomap_layers"].get(old_id, old_id)
                            for old_id in old_ids
                        ]
                        config["layer_ids"] = new_ids
                        modified = True

            if modified:
                widget["config"] = json.dumps(config)

    return data


def remap_asset_urls(
    data: dict[str, list[dict]], url_mapping: dict[str, str]
) -> dict[str, list[dict]]:
    """Remap asset URLs in the data according to the mapping."""
    for table, columns in ASSET_URL_COLUMNS.items():
        if table not in data:
            continue
        for row in data[table]:
            for col in columns:
                if col in row and row[col] in url_mapping:
                    row[col] = url_mapping[row[col]]

    # Also remap widget_instances config
    if "widget_instances" in data:
        for widget in data["widget_instances"]:
            config = widget.get("config")
            if isinstance(config, str):
                config = safe_json_loads(config, default={})
            if isinstance(config, dict):
                modified = False
                for key in ["image_url", "imageUrl", "background_image", "backgroundImage"]:
                    if key in config and config[key] in url_mapping:
                        config[key] = url_mapping[config[key]]
                        modified = True
                if modified:
                    widget["config"] = json.dumps(config)

    return data


async def insert_records(db: aiosqlite.Connection, data: dict[str, list[dict]]) -> dict[str, int]:
    """Insert all records into the database. Returns counts per table."""
    counts = {}

    for table in EXPORT_TABLES:
        if table not in data or not data[table]:
            continue

        rows = data[table]
        counts[table] = len(rows)

        for row in rows:
            # Ensure JSON columns are strings
            for col in ["config", "bindings", "attributes", "roe", "panel_overrides",
                        "depends_on", "status_thresholds", "linked_system_ids", "effects",
                        "on_success", "on_failure", "on_expire", "actions", "tags",
                        "condition_tags", "task_template", "schema", "data"]:
                if col in row and not isinstance(row[col], str):
                    row[col] = json.dumps(row[col])

            columns = list(row.keys())
            placeholders = ", ".join("?" * len(columns))
            col_names = ", ".join(columns)
            values = [row[c] for c in columns]

            await db.execute(
                f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})",
                values,
            )

    await db.commit()
    return counts


async def import_ship_from_zip(
    db: aiosqlite.Connection,
    zip_bytes: bytes,
    new_name: str | None = None,
    replace_existing: bool = False,
) -> dict:
    """
    Import a ship from a ZIP file.

    Returns:
        - On success: {"ship": {...}, "imported_records": {...}, "imported_assets": int}
        - On conflict: {"conflict": "ship_name_exists", "existing_ship": {...}, "suggested_name": str}
    """
    # Parse ZIP
    try:
        zip_buffer = io.BytesIO(zip_bytes)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            # Read manifest
            try:
                manifest_str = zf.read("manifest.json").decode("utf-8")
                manifest = json.loads(manifest_str)
            except (KeyError, json.JSONDecodeError) as e:
                raise HTTPException(status_code=400, detail=f"Invalid manifest: {e}")

            # Version check
            version = manifest.get("version", "0")
            if version != EXPORT_VERSION:
                logger.warning(f"Export version mismatch: {version} vs {EXPORT_VERSION}")

            # Read data
            try:
                data_str = zf.read("ship.json").decode("utf-8")
                data = json.loads(data_str)
            except (KeyError, json.JSONDecodeError) as e:
                raise HTTPException(status_code=400, detail=f"Invalid ship data: {e}")

            # Get ship name
            ship_name = new_name or manifest.get("ship_name", "Imported Ship")

            # Check for name conflict
            cursor = await db.execute(
                "SELECT id, name FROM ships WHERE name = ?", (ship_name,)
            )
            existing = await cursor.fetchone()

            if existing and not replace_existing:
                # Generate suggested name
                base_name = ship_name
                counter = 2
                while True:
                    suggested = f"{base_name} ({counter})"
                    cursor = await db.execute(
                        "SELECT id FROM ships WHERE name = ?", (suggested,)
                    )
                    if not await cursor.fetchone():
                        break
                    counter += 1

                return {
                    "conflict": "ship_name_exists",
                    "existing_ship": {"id": existing["id"], "name": existing["name"]},
                    "suggested_name": suggested,
                }

            if existing and replace_existing:
                # Delete existing ship (cascades to all related data)
                await db.execute("DELETE FROM ships WHERE id = ?", (existing["id"],))
                await db.commit()

            # Generate new ship ID
            new_ship_id = generate_id(5)

            # Remap all IDs
            remapped_data, id_mappings = remap_ids(data, new_ship_id)

            # Remap widget bindings and config IDs
            remapped_data = remap_widget_ids(remapped_data, id_mappings)

            # Update ship name if provided
            if "ships" in remapped_data and remapped_data["ships"]:
                remapped_data["ships"][0]["name"] = ship_name
                # Update timestamps
                now = datetime.now(UTC).isoformat()
                remapped_data["ships"][0]["created_at"] = now
                remapped_data["ships"][0]["updated_at"] = now

            # Copy asset files and build URL mapping
            url_mapping: dict[str, str] = {}
            asset_count = 0
            uploads_dir = Path(settings.uploads_dir)

            for name in zf.namelist():
                if name.startswith("assets/") and not name.endswith("/"):
                    # Extract relative path from ZIP
                    relative_path = name.removeprefix("assets/")
                    old_url = f"/uploads/{relative_path}"

                    # Generate new filename
                    path_parts = relative_path.rsplit("/", 1)
                    if len(path_parts) == 2:
                        subdir, filename = path_parts
                    else:
                        subdir = ""
                        filename = path_parts[0]

                    # Extract extension
                    ext = ""
                    if "." in filename:
                        ext = "." + filename.rsplit(".", 1)[1]

                    new_filename = generate_id(12) + ext
                    if subdir:
                        new_relative_path = f"{subdir}/{new_filename}"
                    else:
                        new_relative_path = new_filename

                    new_url = f"/uploads/{new_relative_path}"
                    url_mapping[old_url] = new_url

                    # Ensure directory exists
                    dest_path = uploads_dir / new_relative_path
                    dest_path.parent.mkdir(parents=True, exist_ok=True)

                    # Extract file
                    with zf.open(name) as src:
                        dest_path.write_bytes(src.read())

                    asset_count += 1

            # Remap asset URLs in data
            remapped_data = remap_asset_urls(remapped_data, url_mapping)

            # Insert all records
            record_counts = await insert_records(db, remapped_data)

            # Get the created ship
            cursor = await db.execute(
                "SELECT * FROM ships WHERE id = ?", (new_ship_id,)
            )
            ship_row = await cursor.fetchone()
            ship = dict(ship_row) if ship_row else None
            if ship and "attributes" in ship:
                ship["attributes"] = safe_json_loads(ship["attributes"], default={})

            return {
                "ship": ship,
                "imported_records": record_counts,
                "imported_assets": asset_count,
            }

    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")


# --- API Endpoints ---


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
    - With replace_existing=true: deletes existing ship and imports
    - With new_name: uses the provided name instead
    """
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="File must be a ZIP archive")

    zip_bytes = await file.read()
    return await import_ship_from_zip(db, zip_bytes, new_name, replace_existing)
