"""Tests for the Ship Transfer (Export/Import) API."""

import io
import json
import zipfile

import pytest

from app.api import ship_transfer
from app.config import settings


class TestShipExport:
    async def test_export_ship(self, client, seeded_ship):
        """Export a seeded ship and verify ZIP structure."""
        resp = await client.get(f"/api/ships/{seeded_ship['id']}/export")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"
        assert "attachment" in resp.headers.get("content-disposition", "")

        # Verify ZIP contents
        zip_buffer = io.BytesIO(resp.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            assert "manifest.json" in names
            assert "ship.json" in names

            # Check manifest
            manifest = json.loads(zf.read("manifest.json"))
            assert manifest["version"] == "1.0"
            assert manifest["ship_name"] == seeded_ship["name"]
            assert manifest["ship_id"] == seeded_ship["id"]
            assert "export_date" in manifest

            # Check ship data
            data = json.loads(zf.read("ship.json"))
            assert "ships" in data
            assert len(data["ships"]) == 1
            assert data["ships"][0]["id"] == seeded_ship["id"]

            # Seeded ship should have panels
            assert "panels" in data
            assert len(data["panels"]) > 0

            # Seeded ship should have system states
            assert "system_states" in data
            assert len(data["system_states"]) > 0

    async def test_export_ship_not_found(self, client):
        """Export nonexistent ship returns 404."""
        resp = await client.get("/api/ships/nonexistent/export")
        assert resp.status_code == 404

    async def test_export_blank_ship(self, client, ship):
        """Export a blank ship (minimal data)."""
        resp = await client.get(f"/api/ships/{ship['id']}/export")
        assert resp.status_code == 200

        zip_buffer = io.BytesIO(resp.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            data = json.loads(zf.read("ship.json"))
            assert "ships" in data
            assert len(data["ships"]) == 1
            # Blank ship may have minimal data
            assert data["ships"][0]["name"] == ship["name"]


class TestShipImport:
    async def test_import_ship(self, client, seeded_ship):
        """Export a ship, then import it with a new name."""
        # Export first
        export_resp = await client.get(f"/api/ships/{seeded_ship['id']}/export")
        assert export_resp.status_code == 200

        # Import with new name
        files = {"file": ("ship.zip", export_resp.content, "application/zip")}
        data = {"new_name": "Imported Ship"}
        import_resp = await client.post("/api/ships/import", files=files, data=data)

        assert import_resp.status_code == 200
        result = import_resp.json()

        # Should succeed without conflict
        assert "ship" in result
        assert result["ship"]["name"] == "Imported Ship"
        assert result["ship"]["id"] != seeded_ship["id"]  # New ID
        assert "imported_records" in result
        assert result["imported_records"]["ships"] == 1

    async def test_import_ship_conflict(self, client, seeded_ship):
        """Import a ship with same name returns conflict info."""
        # Export first
        export_resp = await client.get(f"/api/ships/{seeded_ship['id']}/export")
        assert export_resp.status_code == 200

        # Import without new name (will conflict)
        files = {"file": ("ship.zip", export_resp.content, "application/zip")}
        import_resp = await client.post("/api/ships/import", files=files)

        assert import_resp.status_code == 200
        result = import_resp.json()

        # Should return conflict
        assert result["conflict"] == "ship_name_exists"
        assert result["existing_ship"]["id"] == seeded_ship["id"]
        assert result["existing_ship"]["name"] == seeded_ship["name"]
        assert "suggested_name" in result
        assert result["suggested_name"] != seeded_ship["name"]

    async def test_import_ship_replace(self, client, seeded_ship):
        """Import a ship with replace_existing=true deletes existing ship."""
        original_id = seeded_ship["id"]

        # Export first
        export_resp = await client.get(f"/api/ships/{seeded_ship['id']}/export")
        assert export_resp.status_code == 200

        # Import with replace
        files = {"file": ("ship.zip", export_resp.content, "application/zip")}
        data = {"replace_existing": "true"}
        import_resp = await client.post("/api/ships/import", files=files, data=data)

        assert import_resp.status_code == 200
        result = import_resp.json()

        assert "ship" in result
        assert result["ship"]["name"] == seeded_ship["name"]
        new_id = result["ship"]["id"]

        # Original ship should be gone
        check_resp = await client.get(f"/api/ships/{original_id}")
        assert check_resp.status_code == 404

        # New ship should exist
        check_resp = await client.get(f"/api/ships/{new_id}")
        assert check_resp.status_code == 200

    async def test_import_invalid_zip(self, client):
        """Import invalid file returns 400."""
        files = {"file": ("ship.zip", b"not a zip file", "application/zip")}
        resp = await client.post("/api/ships/import", files=files)
        assert resp.status_code == 400

    async def test_import_missing_manifest(self, client):
        """Import ZIP without manifest returns 400."""
        # Create a ZIP without manifest
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zf:
            zf.writestr("ship.json", "{}")
        zip_buffer.seek(0)

        files = {"file": ("ship.zip", zip_buffer.read(), "application/zip")}
        resp = await client.post("/api/ships/import", files=files)
        assert resp.status_code == 400

    async def test_import_preserves_fk_integrity(self, client, seeded_ship):
        """Imported ship has valid FK relationships."""
        # Export first
        export_resp = await client.get(f"/api/ships/{seeded_ship['id']}/export")
        assert export_resp.status_code == 200

        # Import with new name
        files = {"file": ("ship.zip", export_resp.content, "application/zip")}
        data = {"new_name": "FK Test Ship"}
        import_resp = await client.post("/api/ships/import", files=files, data=data)
        assert import_resp.status_code == 200

        new_ship_id = import_resp.json()["ship"]["id"]

        # Check panels belong to new ship
        panels_resp = await client.get(f"/api/panels?ship_id={new_ship_id}")
        assert panels_resp.status_code == 200
        panels = panels_resp.json()

        if panels:
            # Verify panel has widgets
            panel = panels[0]
            panel_detail = await client.get(f"/api/panels/{panel['id']}")
            assert panel_detail.status_code == 200
            # Widgets should reference the panel correctly
            detail = panel_detail.json()
            if "widgets" in detail and detail["widgets"]:
                for widget in detail["widgets"]:
                    assert widget["panel_id"] == panel["id"]

        # Check system states belong to new ship
        states_resp = await client.get(f"/api/system-states?ship_id={new_ship_id}")
        assert states_resp.status_code == 200
        states = states_resp.json()
        for state in states:
            assert state["ship_id"] == new_ship_id


class TestWidgetBindingRemapping:
    async def test_widget_bindings_remapped(self, client, seeded_ship):
        """Widget bindings are remapped to new system_state IDs during import."""
        # Export the ship
        export_resp = await client.get(f"/api/ships/{seeded_ship['id']}/export")
        assert export_resp.status_code == 200

        # Get original system states for reference
        orig_states_resp = await client.get(f"/api/system-states?ship_id={seeded_ship['id']}")
        orig_states = {s["id"]: s for s in orig_states_resp.json()}

        # Import with new name
        files = {"file": ("ship.zip", export_resp.content, "application/zip")}
        data = {"new_name": "Binding Test Ship"}
        import_resp = await client.post("/api/ships/import", files=files, data=data)
        assert import_resp.status_code == 200

        new_ship_id = import_resp.json()["ship"]["id"]

        # Get new system states
        new_states_resp = await client.get(f"/api/system-states?ship_id={new_ship_id}")
        new_states = {s["id"]: s for s in new_states_resp.json()}
        new_state_ids = set(new_states.keys())

        # Get panels with widgets
        panels_resp = await client.get(f"/api/panels?ship_id={new_ship_id}")
        panels = panels_resp.json()

        bindings_found = False
        for panel in panels:
            panel_detail = await client.get(f"/api/panels/{panel['id']}")
            detail = panel_detail.json()

            for widget in detail.get("widgets", []):
                bindings = widget.get("bindings", {})

                # Check system_state_id binding
                if "system_state_id" in bindings and bindings["system_state_id"]:
                    bindings_found = True
                    bound_id = bindings["system_state_id"]
                    # The bound ID should be a NEW ID (not an original ID)
                    assert bound_id not in orig_states, (
                        f"Widget binding still references OLD system_state_id: {bound_id}"
                    )
                    # The bound ID should exist in the new ship's system states
                    assert bound_id in new_state_ids, (
                        f"Widget binding references non-existent system_state_id: {bound_id}"
                    )

                # Check system_state_ids binding (array)
                if "system_state_ids" in bindings and bindings["system_state_ids"]:
                    bindings_found = True
                    for bound_id in bindings["system_state_ids"]:
                        assert bound_id not in orig_states, (
                            f"Widget binding still references OLD system_state_id: {bound_id}"
                        )
                        assert bound_id in new_state_ids, (
                            f"Widget binding references non-existent system_state_id: {bound_id}"
                        )

        # Ensure we actually tested something
        assert bindings_found, "No widget bindings found in test - test may be ineffective"


class TestExportImportRoundTrip:
    async def test_full_roundtrip(self, client, seeded_ship):
        """Full export-import roundtrip preserves data."""
        # Get original data counts
        original_panels = await client.get(f"/api/panels?ship_id={seeded_ship['id']}")
        original_states = await client.get(f"/api/system-states?ship_id={seeded_ship['id']}")

        original_panel_count = len(original_panels.json())
        original_state_count = len(original_states.json())

        # Export
        export_resp = await client.get(f"/api/ships/{seeded_ship['id']}/export")
        assert export_resp.status_code == 200

        # Import with new name
        files = {"file": ("ship.zip", export_resp.content, "application/zip")}
        data = {"new_name": "Roundtrip Test"}
        import_resp = await client.post("/api/ships/import", files=files, data=data)
        assert import_resp.status_code == 200

        new_ship_id = import_resp.json()["ship"]["id"]

        # Verify counts match
        new_panels = await client.get(f"/api/panels?ship_id={new_ship_id}")
        new_states = await client.get(f"/api/system-states?ship_id={new_ship_id}")

        assert len(new_panels.json()) == original_panel_count
        assert len(new_states.json()) == original_state_count


# =============================================================================
# Hardening: archive contents, export confinement, atomic replace
# =============================================================================

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@pytest.fixture
async def uploads_dir(tmp_path):
    """Point uploads at <tmp>/uploads so that <tmp> itself is 'outside'."""
    original = settings.uploads_dir
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    settings.uploads_dir = str(uploads)
    yield uploads
    settings.uploads_dir = original


async def _export(client, ship_id) -> bytes:
    resp = await client.get(f"/api/ships/{ship_id}/export")
    assert resp.status_code == 200
    return resp.content


def _rebuild_zip(zip_bytes: bytes, *, data_fn=None, extra: dict[str, bytes] | None = None) -> bytes:
    """Copy an export archive, optionally rewriting ship.json and adding entries."""
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as src, zipfile.ZipFile(out, "w") as dst:
        for name in src.namelist():
            content = src.read(name)
            if name == "ship.json" and data_fn:
                data = json.loads(content)
                data_fn(data)
                content = json.dumps(data).encode()
            dst.writestr(name, content)
        for name, content in (extra or {}).items():
            dst.writestr(name, content)
    return out.getvalue()


async def _import(client, zip_bytes, **form):
    files = {"file": ("ship.zip", zip_bytes, "application/zip")}
    return await client.post("/api/ships/import", files=files, data=form)


def _all_files(root):
    return sorted(p for p in root.rglob("*") if p.is_file())


class TestImportArchiveValidation:
    @pytest.mark.parametrize(
        "entry",
        [
            "assets/../../escaped/a.png",
            "assets/../escaped.png",
            "assets/widget-assets/../../a.png",
            "assets/widget-assets/page.html",
            "assets/widget-assets/no_extension",
            "assets/a/b/c.png",
            "assets/widget-assets\\..\\a.png",
            "assets/.hidden/a.png",
        ],
    )
    async def test_malicious_asset_entries_rejected(self, client, ship, uploads_dir, tmp_path, entry):
        zip_bytes = _rebuild_zip(await _export(client, ship["id"]), extra={entry: PNG_BYTES})
        before = _all_files(tmp_path)

        resp = await _import(client, zip_bytes, new_name="Evil Import")

        assert resp.status_code == 400
        assert _all_files(tmp_path) == before
        ships = (await client.get("/api/ships")).json()
        assert all(s["name"] != "Evil Import" for s in ships)

    async def test_valid_asset_written_inside_uploads(self, client, ship, uploads_dir):
        zip_bytes = _rebuild_zip(
            await _export(client, ship["id"]),
            extra={"assets/widget-assets/pic.png": PNG_BYTES},
        )
        resp = await _import(client, zip_bytes, new_name="Asset Import")
        assert resp.status_code == 200
        assert resp.json()["imported_assets"] == 1
        written = _all_files(uploads_dir)
        assert len(written) == 1
        assert written[0].parent == uploads_dir / "widget-assets"
        assert written[0].suffix == ".png"

    async def test_too_many_entries_rejected(self, client, ship, uploads_dir, monkeypatch):
        monkeypatch.setattr(ship_transfer, "MAX_IMPORT_ENTRIES", 3)
        zip_bytes = _rebuild_zip(
            await _export(client, ship["id"]),
            extra={f"assets/widget-assets/{i}.png": PNG_BYTES for i in range(3)},
        )
        resp = await _import(client, zip_bytes, new_name="Many Entries")
        assert resp.status_code == 400
        assert "too many entries" in resp.json()["detail"]
        assert _all_files(uploads_dir) == []

    async def test_uncompressed_size_capped(self, client, ship, uploads_dir, monkeypatch):
        monkeypatch.setattr(ship_transfer, "MAX_IMPORT_UNCOMPRESSED_BYTES", 64 * 1024)
        zip_bytes = _rebuild_zip(
            await _export(client, ship["id"]),
            extra={"assets/widget-assets/big.png": b"\x00" * (128 * 1024)},
        )
        resp = await _import(client, zip_bytes, new_name="Zip Bomb")
        assert resp.status_code == 400
        assert "too large" in resp.json()["detail"]
        assert _all_files(uploads_dir) == []

    async def test_unknown_columns_are_not_spliced_into_sql(self, client, ship, db):
        injected = "name) VALUES ('x'); DROP TABLE contacts; --"

        def add_column(data):
            data["ships"][0][injected] = "boom"
            data["ships"][0]["not_a_column"] = 1

        zip_bytes = _rebuild_zip(await _export(client, ship["id"]), data_fn=add_column)
        resp = await _import(client, zip_bytes, new_name="Injected")
        assert resp.status_code == 200
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE name = 'contacts'")
        assert await cursor.fetchone() is not None

    async def test_rows_cannot_target_another_ship(self, client, ship, db):
        """ship_id / FK values in the archive are rewritten, never trusted."""
        other = (await client.post("/api/ships", json={"name": "Victim", "seed_type": "blank"})).json()
        await db.execute(
            "INSERT INTO panels (id, ship_id, name, slug, station_group) VALUES (?, ?, ?, ?, ?)",
            ("victim-panel", other["id"], "Victim Panel", "victim-panel", "command"),
        )
        await db.commit()

        def retarget(data):
            data["panels"] = [
                {"id": "p1", "ship_id": other["id"], "name": "Planted", "slug": "planted", "station_group": "command"}
            ]

        zip_bytes = _rebuild_zip(await _export(client, ship["id"]), data_fn=retarget)
        resp = await _import(client, zip_bytes, new_name="Retarget")
        assert resp.status_code == 200
        new_id = resp.json()["ship"]["id"]
        cursor = await db.execute("SELECT ship_id FROM panels WHERE name = 'Planted'")
        assert [r[0] for r in await cursor.fetchall()] == [new_id]

        def attach_to_victim(data):
            data["widget_instances"] = [{"id": "w1", "panel_id": "victim-panel", "widget_type": "title"}]

        zip_bytes = _rebuild_zip(await _export(client, ship["id"]), data_fn=attach_to_victim)
        resp = await _import(client, zip_bytes, new_name="Attach")
        # The victim panel isn't part of the export, so the reference is cleared
        # and the NOT NULL panel_id makes the import fail cleanly.
        assert resp.status_code == 400
        cursor = await db.execute("SELECT COUNT(*) FROM widget_instances WHERE panel_id = 'victim-panel'")
        assert (await cursor.fetchone())[0] == 0


class TestExportConfinement:
    async def test_export_skips_paths_outside_uploads(self, client, ship, db, uploads_dir, tmp_path):
        (tmp_path / "secret.png").write_bytes(b"top secret")
        (uploads_dir / "widget-assets").mkdir()
        (uploads_dir / "widget-assets" / "ok.png").write_bytes(PNG_BYTES)
        (uploads_dir / "notes.txt").write_bytes(b"not media")

        urls = [
            "/uploads/../secret.png",
            "/uploads/widget-assets/../../secret.png",
            "/uploads/notes.txt",
            "/uploads/widget-assets/ok.png",
        ]
        for i, url in enumerate(urls):
            # Inserted directly: the API would reject these URLs
            await db.execute(
                "INSERT INTO contacts (id, ship_id, name, image_url) VALUES (?, ?, ?, ?)",
                (f"c{i}", ship["id"], f"Contact {i}", url),
            )
        await db.commit()

        zip_bytes = await _export(client, ship["id"])
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            assets = [n for n in zf.namelist() if n.startswith("assets/")]
            assert assets == ["assets/widget-assets/ok.png"]
            for name in zf.namelist():
                assert b"top secret" not in zf.read(name)


class TestAtomicReplace:
    async def test_failed_replace_keeps_original_ship(self, client, seeded_ship, db, uploads_dir):
        original_id = seeded_ship["id"]
        panels_before = len((await client.get(f"/api/panels?ship_id={original_id}")).json())
        assert panels_before > 0

        def break_last_table(data):
            # Missing NOT NULL name: fails late, after the ship row is inserted
            data["datasets"] = [{"id": "broken"}]

        zip_bytes = _rebuild_zip(
            await _export(client, original_id),
            data_fn=break_last_table,
            extra={"assets/widget-assets/pic.png": PNG_BYTES},
        )
        resp = await _import(client, zip_bytes, replace_existing="true")
        assert resp.status_code == 400

        assert (await client.get(f"/api/ships/{original_id}")).status_code == 200
        panels_after = len((await client.get(f"/api/panels?ship_id={original_id}")).json())
        assert panels_after == panels_before
        cursor = await db.execute("SELECT COUNT(*) FROM ships WHERE name = ?", (seeded_ship["name"],))
        assert (await cursor.fetchone())[0] == 1
        # Asset files written during the failed import are removed
        assert _all_files(uploads_dir) == []


class TestCategoriesRoundTrip:
    async def test_system_categories_exported_and_remapped(self, client, seeded_ship, db):
        zip_bytes = await _export(client, seeded_ship["id"])
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            data = json.loads(zf.read("ship.json"))
        assert data.get("system_categories"), "seeded ship should export its categories"

        resp = await _import(client, zip_bytes, new_name="Category Copy")
        assert resp.status_code == 200
        new_id = resp.json()["ship"]["id"]
        assert resp.json()["imported_records"]["system_categories"] == len(data["system_categories"])

        cursor = await db.execute(
            """
            SELECT ss.id, sc.ship_id AS category_ship
            FROM system_states ss JOIN system_categories sc ON ss.category_id = sc.id
            WHERE ss.ship_id = ?
            """,
            (new_id,),
        )
        rows = await cursor.fetchall()
        assert rows, "imported systems should keep their categories"
        assert all(r["category_ship"] == new_id for r in rows)

        # Deleting the source ship leaves the copy's categories intact
        assert (await client.delete(f"/api/ships/{seeded_ship['id']}")).status_code == 200
        cursor = await db.execute(
            "SELECT COUNT(*) FROM system_states WHERE ship_id = ? AND category_id IS NOT NULL", (new_id,)
        )
        assert (await cursor.fetchone())[0] == len(rows)
