"""Tests for the Ship Transfer (Export/Import) API."""

import io
import json
import zipfile


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
