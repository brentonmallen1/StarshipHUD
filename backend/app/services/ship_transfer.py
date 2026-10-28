"""
Ship export/import.

Exports a ship's complete data (database rows + uploaded assets) to a ZIP file,
and imports such a ZIP as a new ship (remapping every id and asset URL).
"""

import io
import json
import logging
import re
import sqlite3
import zipfile
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath

import aiosqlite
from nanoid import generate

from app.services.errors import NotFoundError, ServiceError
from app.services.events import emit_event
from app.services.uploads import (
    ALLOWED_UPLOAD_EXTENSIONS,
    confine_to_uploads,
    resolve_upload_url,
    uploads_root,
)
from app.utils import safe_json_loads

logger = logging.getLogger(__name__)

# Same nanoid alphabet as ships.py
NANOID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"

# Export version for compatibility checking
EXPORT_VERSION = "1.0"

# Import limits: the archive comes from the client, so bound what we read
MAX_IMPORT_ZIP_BYTES = 200 * 1024 * 1024
MAX_IMPORT_UNCOMPRESSED_BYTES = 500 * 1024 * 1024
MAX_IMPORT_ENTRIES = 5000

# Asset subdirectories inside an export archive (e.g. "widget-assets", "holomap")
ASSET_SUBDIR_RE = re.compile(r"[A-Za-z0-9_-]+")

# Tables to export in dependency order (children after parents)
EXPORT_TABLES = [
    # Core
    "ships",
    # UI (panels must come before widget_instances)
    "panels",
    "widget_instances",
    # Systems (categories must come before system_states)
    "system_categories",
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
    "system_categories": [("ship_id", "ships")],
    "system_states": [("ship_id", "ships"), ("category_id", "system_categories")],
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
    "crew": [("ship_id", "ships"), ("default_panel_id", "panels")],
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

# Columns referencing data that is not part of an export (e.g. user accounts on
# the source server). They are cleared on import.
CLEARED_ON_IMPORT = {
    "crew": ["user_id"],
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
        raise NotFoundError("Ship not found")

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

        # Copy asset files. URLs come from free-form columns, so only files
        # that resolve inside the uploads directory are included.
        root = uploads_root()
        for url in sorted(asset_urls):
            file_path = resolve_upload_url(url)
            if file_path is None:
                logger.warning("Skipping asset outside uploads directory: %r", url)
                continue
            if file_path.is_file():
                zf.write(file_path, f"assets/{file_path.relative_to(root).as_posix()}")
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
        # An export describes exactly one ship
        rows = data[table][:1] if table in ("ships", *SINGLETON_TABLES) else data[table]
        for row in rows:
            new_row = row.copy()

            # Remap primary key
            if table == "ships":
                new_row["id"] = new_ship_id
            elif table in SINGLETON_TABLES:
                new_row["ship_id"] = new_ship_id
            else:
                old_id = new_row.get("id")
                new_row["id"] = id_mappings[table].get(old_id) if old_id else generate_id()

            # Remap foreign keys. Every reference must point inside the imported
            # data: ship_id always becomes the new ship, and a reference to a
            # record that isn't in the export is cleared rather than left
            # pointing at some other ship's record on this server.
            if table in FK_MAPPINGS:
                for col, ref_table in FK_MAPPINGS[table]:
                    if ref_table == "ships":
                        new_row[col] = new_ship_id
                    elif col in new_row and new_row[col] is not None:
                        new_row[col] = id_mappings.get(ref_table, {}).get(new_row[col])

            for col in CLEARED_ON_IMPORT.get(table, []):
                if col in new_row:
                    new_row[col] = None

            # Remap JSON ID columns
            if table in JSON_ID_COLUMNS:
                for col, ref_table in JSON_ID_COLUMNS[table].items():
                    if col in new_row and new_row[col]:
                        json_val = new_row[col]
                        if isinstance(json_val, str):
                            json_val = safe_json_loads(json_val, default=[])
                        if isinstance(json_val, list) and ref_table in id_mappings:
                            mapping = id_mappings[ref_table]
                            new_ids = [
                                mapping[old_id]
                                for old_id in json_val
                                if isinstance(old_id, str) and old_id in mapping
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


async def get_table_columns(db: aiosqlite.Connection, table: str) -> set[str]:
    """Column names of a table, from the live schema."""
    cursor = await db.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in await cursor.fetchall()}


async def insert_records(db: aiosqlite.Connection, data: dict[str, list[dict]]) -> dict[str, int]:
    """
    Insert all records into the database. Returns counts per table.

    Does not commit: the caller owns the transaction so that a failed import
    can be rolled back as a whole.
    """
    counts = {}

    for table in EXPORT_TABLES:
        if table not in data or not data[table]:
            continue

        # Only columns that exist in this table may be named in the INSERT;
        # keys in the uploaded JSON would otherwise be spliced into the SQL.
        valid_columns = await get_table_columns(db, table)
        inserted = 0

        for row in data[table]:
            # JSON columns are stored as text
            for col, value in row.items():
                if isinstance(value, dict | list):
                    row[col] = json.dumps(value)

            columns = [c for c in row if c in valid_columns]
            if not columns:
                continue
            placeholders = ", ".join("?" * len(columns))
            col_names = ", ".join(columns)
            values = [row[c] for c in columns]

            await db.execute(
                f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})",
                values,
            )
            inserted += 1

        counts[table] = inserted

    return counts


def _bad_import(detail: str) -> ServiceError:
    return ServiceError(detail)


_TOO_LARGE = f"Import archive too large (max {MAX_IMPORT_UNCOMPRESSED_BYTES // 1024 // 1024}MB uncompressed)"


class _ReadBudget:
    """Tracks how many uncompressed bytes may still be read from an archive."""

    def __init__(self, limit: int):
        self.remaining = limit

    def read(self, zf: zipfile.ZipFile, info: zipfile.ZipInfo) -> bytes:
        with zf.open(info) as src:
            content = src.read(self.remaining + 1)
        if len(content) > self.remaining:
            raise _bad_import(_TOO_LARGE)
        self.remaining -= len(content)
        return content


def _read_json_member(zf: zipfile.ZipFile, name: str, budget: _ReadBudget, label: str):
    try:
        info = zf.getinfo(name)
    except KeyError:
        raise _bad_import(f"Invalid {label}: {name} missing from archive")
    try:
        return json.loads(budget.read(zf, info).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise _bad_import(f"Invalid {label}: {e}")


def _validate_export_data(data) -> None:
    """Reject ship.json payloads that don't have the shape an export produces."""
    if not isinstance(data, dict):
        raise _bad_import("Invalid ship data: expected an object of tables")
    for table in EXPORT_TABLES:
        rows = data.get(table)
        if rows is None:
            continue
        if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
            raise _bad_import(f"Invalid ship data: '{table}' must be a list of records")
        for row in rows:
            for key in ("id", "ship_id"):
                if key in row and row[key] is not None and not isinstance(row[key], str):
                    raise _bad_import(f"Invalid ship data: '{table}.{key}' must be a string")


def _plan_asset(name: str) -> tuple[str, Path]:
    """
    Validate an ``assets/...`` archive entry and choose where it will be written.

    Returns (old_url, destination). Entry names come from the uploaded archive,
    so only ``assets/<file>`` or ``assets/<subdir>/<file>`` with a plain
    subdirectory name and an allowed media extension are accepted, and the
    destination must resolve inside the uploads directory.
    """
    relative_path = name.removeprefix("assets/")
    parts = relative_path.split("/")
    if "\\" in relative_path or len(parts) > 2 or not all(parts):
        raise _bad_import(f"Invalid asset path in archive: {name}")

    *subdirs, filename = parts
    if subdirs and not ASSET_SUBDIR_RE.fullmatch(subdirs[0]):
        raise _bad_import(f"Invalid asset path in archive: {name}")

    ext = PurePosixPath(filename).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise _bad_import(f"Unsupported asset type in archive: {name}")

    new_relative_path = "/".join([*subdirs, generate_id(12) + ext])
    dest = confine_to_uploads(uploads_root() / new_relative_path)
    if dest is None:
        raise _bad_import(f"Invalid asset path in archive: {name}")
    return f"/uploads/{relative_path}", dest


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
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes), "r")
    except zipfile.BadZipFile:
        raise _bad_import("Invalid ZIP file")

    with zf:
        infos = zf.infolist()
        if len(infos) > MAX_IMPORT_ENTRIES:
            raise _bad_import(f"Import archive has too many entries (max {MAX_IMPORT_ENTRIES})")
        if sum(info.file_size for info in infos) > MAX_IMPORT_UNCOMPRESSED_BYTES:
            raise _bad_import(_TOO_LARGE)
        budget = _ReadBudget(MAX_IMPORT_UNCOMPRESSED_BYTES)

        manifest = _read_json_member(zf, "manifest.json", budget, "manifest")
        if not isinstance(manifest, dict):
            raise _bad_import("Invalid manifest: expected an object")

        version = manifest.get("version", "0")
        if version != EXPORT_VERSION:
            logger.warning(f"Export version mismatch: {version} vs {EXPORT_VERSION}")

        data = _read_json_member(zf, "ship.json", budget, "ship data")
        _validate_export_data(data)

        # Validate every asset entry before touching the database or disk
        asset_plan = [
            (info, *_plan_asset(info.filename))
            for info in infos
            if info.filename.startswith("assets/") and not info.is_dir()
        ]

        ship_name = new_name or manifest.get("ship_name") or "Imported Ship"
        if not isinstance(ship_name, str):
            raise _bad_import("Invalid manifest: ship_name must be a string")

        # Check for name conflict
        cursor = await db.execute("SELECT id, name FROM ships WHERE name = ?", (ship_name,))
        existing = await cursor.fetchone()

        if existing and not replace_existing:
            base_name = ship_name
            counter = 2
            while True:
                suggested = f"{base_name} ({counter})"
                cursor = await db.execute("SELECT id FROM ships WHERE name = ?", (suggested,))
                if not await cursor.fetchone():
                    break
                counter += 1

            return {
                "conflict": "ship_name_exists",
                "existing_ship": {"id": existing["id"], "name": existing["name"]},
                "suggested_name": suggested,
            }

        new_ship_id = generate_id(5)
        written: list[Path] = []

        try:
            remapped_data, id_mappings = remap_ids(data, new_ship_id)
            remapped_data = remap_widget_ids(remapped_data, id_mappings)

            if "ships" in remapped_data and remapped_data["ships"]:
                remapped_data["ships"][0]["name"] = ship_name
                now = datetime.now(UTC).isoformat()
                remapped_data["ships"][0]["created_at"] = now
                remapped_data["ships"][0]["updated_at"] = now

            # Copy asset files and build URL mapping
            url_mapping: dict[str, str] = {}
            root = uploads_root()
            for info, old_url, dest in asset_plan:
                content = budget.read(zf, info)
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(content)
                written.append(dest)
                url_mapping[old_url] = "/uploads/" + dest.relative_to(root).as_posix()

            remapped_data = remap_asset_urls(remapped_data, url_mapping)

            # Delete (when replacing) and insert in a single transaction so a
            # failed import leaves the existing ship untouched.
            if existing and replace_existing:
                await db.execute("DELETE FROM ships WHERE id = ?", (existing["id"],))

            record_counts = await insert_records(db, remapped_data)

            cursor = await db.execute("SELECT * FROM ships WHERE id = ?", (new_ship_id,))
            ship_row = await cursor.fetchone()
            if not ship_row:
                raise _bad_import("Invalid ship data: no ship record")

            # Admin/GM audit trail only
            await emit_event(
                db,
                new_ship_id,
                "ship_imported",
                f"Ship imported: {ship_name}",
                data={
                    "source_ship_id": manifest.get("ship_id"),
                    "replaced_ship_id": existing["id"] if existing and replace_existing else None,
                    "imported_records": sum(record_counts.values()),
                    "imported_assets": len(written),
                },
                transmitted=False,
            )
            await db.commit()
        except BaseException as e:
            await db.rollback()
            for path in written:
                path.unlink(missing_ok=True)
            if isinstance(e, sqlite3.Error | TypeError | ValueError | AttributeError):
                logger.warning("Ship import failed: %s", e)
                raise _bad_import(f"Import failed: {e}") from e
            raise

    ship = dict(ship_row)
    if "attributes" in ship:
        ship["attributes"] = safe_json_loads(ship["attributes"], default={})

    return {
        "ship": ship,
        "imported_records": record_counts,
        "imported_assets": len(written),
    }
