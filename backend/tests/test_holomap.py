"""Tests for the Holomap API (layers and markers)."""

import io
import os

import pytest
from PIL import Image

from app.config import settings


@pytest.fixture
async def uploads_dir(tmp_path):
    """Override uploads_dir to use a temp directory."""
    original = settings.uploads_dir
    settings.uploads_dir = str(tmp_path)
    yield tmp_path
    settings.uploads_dir = original


async def create_layer(client, ship_id, name="Deck 1", **kwargs):
    """Helper to create a holomap layer."""
    payload = {
        "ship_id": ship_id,
        "name": name,
    }
    for key in ("image_url", "deck_level", "sort_order", "visible",
                "image_scale", "image_offset_x", "image_offset_y", "id"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post("/api/holomap/layers", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_marker(client, layer_id, **kwargs):
    """Helper to create a holomap marker."""
    payload = {
        "layer_id": layer_id,
        "type": kwargs.get("type", "breach"),
        "x": kwargs.get("x", 0.5),
        "y": kwargs.get("y", 0.5),
    }
    for key in ("severity", "label", "description", "linked_incident_id",
                "linked_task_id", "visible", "id"):
        if key in kwargs:
            payload[key] = kwargs[key]

    resp = await client.post(f"/api/holomap/layers/{layer_id}/markers", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def create_incident(client, ship_id, name="Test Incident"):
    """Helper to create an incident for linking."""
    resp = await client.post("/api/incidents", json={
        "ship_id": ship_id,
        "name": name,
        "severity": "minor",
    })
    assert resp.status_code == 200
    return resp.json()


async def create_task(client, ship_id, title="Test Task"):
    """Helper to create a task for linking."""
    resp = await client.post("/api/tasks", json={
        "ship_id": ship_id,
        "title": title,
        "station": "engineering",
    })
    assert resp.status_code == 200
    return resp.json()


def make_png_bytes(width=4, height=4):
    """Create a small valid PNG image in memory and return its bytes."""
    img = Image.new("RGB", (width, height), color=(0, 128, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


class TestLayerCRUD:
    async def test_create_layer(self, client, ship):
        layer = await create_layer(client, ship["id"], "Main Deck", deck_level="1", sort_order=0)
        assert layer["name"] == "Main Deck"
        assert layer["deck_level"] == "1"
        assert layer["ship_id"] == ship["id"]
        assert layer["visible"] is True  # default

    async def test_create_layer_with_image_settings(self, client, ship):
        layer = await create_layer(
            client, ship["id"],
            image_scale=1.5,
            image_offset_x=0.1,
            image_offset_y=0.2,
        )
        assert layer["image_scale"] == 1.5
        assert layer["image_offset_x"] == 0.1
        assert layer["image_offset_y"] == 0.2

    async def test_list_layers(self, client, ship):
        await create_layer(client, ship["id"], "Deck A")
        await create_layer(client, ship["id"], "Deck B")

        resp = await client.get(f"/api/holomap/layers?ship_id={ship['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_list_layers_filter_visible(self, client, ship):
        await create_layer(client, ship["id"], "Visible", visible=True)
        await create_layer(client, ship["id"], "Hidden", visible=False)

        resp = await client.get(f"/api/holomap/layers?ship_id={ship['id']}&visible=true")
        layers = resp.json()
        assert all(l["visible"] is True for l in layers)

    async def test_get_layer_with_markers(self, client, ship):
        layer = await create_layer(client, ship["id"])
        await create_marker(client, layer["id"], label="Marker A")
        await create_marker(client, layer["id"], label="Marker B")

        resp = await client.get(f"/api/holomap/layers/{layer['id']}")
        assert resp.status_code == 200
        result = resp.json()
        assert result["id"] == layer["id"]
        assert len(result["markers"]) == 2

    async def test_get_layer_visible_markers_only(self, client, ship):
        layer = await create_layer(client, ship["id"])
        await create_marker(client, layer["id"], label="Visible", visible=True)
        await create_marker(client, layer["id"], label="Hidden", visible=False)

        resp = await client.get(f"/api/holomap/layers/{layer['id']}?visible_markers_only=true")
        result = resp.json()
        assert all(m["visible"] is True for m in result["markers"])

    async def test_get_layer_not_found(self, client):
        resp = await client.get("/api/holomap/layers/nonexistent")
        assert resp.status_code == 404

    async def test_update_layer(self, client, ship):
        layer = await create_layer(client, ship["id"])
        resp = await client.patch(f"/api/holomap/layers/{layer['id']}", json={
            "name": "Updated Deck",
            "visible": False,
            "image_scale": 2.0,
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["name"] == "Updated Deck"
        assert updated["visible"] is False
        assert updated["image_scale"] == 2.0

    async def test_update_layer_not_found(self, client):
        resp = await client.patch("/api/holomap/layers/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    async def test_delete_layer(self, client, ship):
        layer = await create_layer(client, ship["id"])
        resp = await client.delete(f"/api/holomap/layers/{layer['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_layer_not_found(self, client):
        resp = await client.delete("/api/holomap/layers/nonexistent")
        assert resp.status_code == 404

    async def test_delete_layer_cascades_markers(self, client, ship):
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"])

        await client.delete(f"/api/holomap/layers/{layer['id']}")

        resp = await client.get(f"/api/holomap/markers/{marker['id']}")
        assert resp.status_code == 404


class TestMarkerCRUD:
    async def test_create_marker(self, client, ship):
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(
            client, layer["id"],
            type="objective",
            label="Engineering Bay",
            x=0.3, y=0.7,
        )
        assert marker["type"] == "objective"
        assert marker["label"] == "Engineering Bay"
        assert marker["x"] == 0.3
        assert marker["y"] == 0.7
        assert marker["layer_id"] == layer["id"]

    async def test_create_marker_with_severity(self, client, ship):
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"], severity="critical")
        assert marker["severity"] == "critical"

    async def test_create_marker_linked_incident(self, client, ship):
        layer = await create_layer(client, ship["id"])
        incident = await create_incident(client, ship["id"])
        marker = await create_marker(
            client, layer["id"],
            linked_incident_id=incident["id"],
        )
        assert marker["linked_incident_id"] == incident["id"]

    async def test_create_marker_linked_task(self, client, ship):
        layer = await create_layer(client, ship["id"])
        task = await create_task(client, ship["id"])
        marker = await create_marker(
            client, layer["id"],
            linked_task_id=task["id"],
        )
        assert marker["linked_task_id"] == task["id"]

    async def test_create_marker_invalid_linked_incident(self, client, ship):
        layer = await create_layer(client, ship["id"])
        resp = await client.post(f"/api/holomap/layers/{layer['id']}/markers", json={
            "layer_id": layer["id"],
            "type": "breach",
            "x": 0.0, "y": 0.0,
            "linked_incident_id": "nonexistent",
        })
        assert resp.status_code == 400
        assert "incident" in resp.json()["detail"].lower()

    async def test_create_marker_invalid_linked_task(self, client, ship):
        layer = await create_layer(client, ship["id"])
        resp = await client.post(f"/api/holomap/layers/{layer['id']}/markers", json={
            "layer_id": layer["id"],
            "type": "breach",
            "x": 0.0, "y": 0.0,
            "linked_task_id": "nonexistent",
        })
        assert resp.status_code == 400
        assert "task" in resp.json()["detail"].lower()

    async def test_create_marker_layer_not_found(self, client):
        resp = await client.post("/api/holomap/layers/nonexistent/markers", json={
            "layer_id": "nonexistent",
            "type": "breach",
            "x": 0.0, "y": 0.0,
        })
        assert resp.status_code == 404

    async def test_list_markers(self, client, ship):
        layer = await create_layer(client, ship["id"])
        await create_marker(client, layer["id"])
        await create_marker(client, layer["id"])

        resp = await client.get(f"/api/holomap/layers/{layer['id']}/markers")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_list_markers_layer_not_found(self, client):
        resp = await client.get("/api/holomap/layers/nonexistent/markers")
        assert resp.status_code == 404

    async def test_get_marker(self, client, ship):
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"])
        resp = await client.get(f"/api/holomap/markers/{marker['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == marker["id"]

    async def test_get_marker_not_found(self, client):
        resp = await client.get("/api/holomap/markers/nonexistent")
        assert resp.status_code == 404

    async def test_update_marker(self, client, ship):
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"])
        resp = await client.patch(f"/api/holomap/markers/{marker['id']}", json={
            "label": "Updated",
            "x": 0.9,
            "severity": "warning",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["label"] == "Updated"
        assert updated["x"] == 0.9
        assert updated["severity"] == "warning"

    async def test_update_marker_invalid_linked_incident(self, client, ship):
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"])
        resp = await client.patch(f"/api/holomap/markers/{marker['id']}", json={
            "linked_incident_id": "nonexistent",
        })
        assert resp.status_code == 400

    async def test_update_marker_invalid_linked_task(self, client, ship):
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"])
        resp = await client.patch(f"/api/holomap/markers/{marker['id']}", json={
            "linked_task_id": "nonexistent",
        })
        assert resp.status_code == 400

    async def test_update_marker_not_found(self, client):
        resp = await client.patch("/api/holomap/markers/nonexistent", json={"label": "x"})
        assert resp.status_code == 404

    async def test_delete_marker(self, client, ship):
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"])
        resp = await client.delete(f"/api/holomap/markers/{marker['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_marker_not_found(self, client):
        resp = await client.delete("/api/holomap/markers/nonexistent")
        assert resp.status_code == 404


class TestLayerImageDelete:
    async def test_delete_layer_image(self, client, ship):
        layer = await create_layer(client, ship["id"], image_url="/uploads/holomap/test.png")
        resp = await client.delete(f"/api/holomap/layers/{layer['id']}/image")
        assert resp.status_code == 200
        assert resp.json()["image_url"] == "placeholder"

        # Verify layer was updated
        resp = await client.get(f"/api/holomap/layers/{layer['id']}")
        assert resp.json()["image_url"] == "placeholder"

    async def test_delete_layer_image_not_found(self, client):
        resp = await client.delete("/api/holomap/layers/nonexistent/image")
        assert resp.status_code == 404


# =============================================================================
# New test classes covering missing branches
# =============================================================================


class TestLayerImageUpload:
    """Tests for POST /api/holomap/layers/{layer_id}/upload."""

    async def test_upload_valid_image(self, client, ship, uploads_dir):
        """Upload a valid PNG and verify response contains image_url, width, height."""
        layer = await create_layer(client, ship["id"])
        png_data = make_png_bytes(width=16, height=8)

        resp = await client.post(
            f"/api/holomap/layers/{layer['id']}/upload",
            files={"file": ("deck.png", io.BytesIO(png_data), "image/png")},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["image_url"].startswith("/uploads/holomap/")
        assert result["image_url"].endswith(".png")
        assert result["width"] == 16
        assert result["height"] == 8
        assert result["aspect_ratio"] == 2.0
        assert "filename" in result

        # Verify the layer was updated with the new image URL
        resp = await client.get(f"/api/holomap/layers/{layer['id']}")
        assert resp.json()["image_url"] == result["image_url"]

    async def test_upload_invalid_extension(self, client, ship, uploads_dir):
        """Upload a .txt file and expect 400."""
        layer = await create_layer(client, ship["id"])
        resp = await client.post(
            f"/api/holomap/layers/{layer['id']}/upload",
            files={"file": ("notes.txt", io.BytesIO(b"hello world"), "text/plain")},
        )
        assert resp.status_code == 400
        assert "Invalid file type" in resp.json()["detail"]

    async def test_upload_replaces_old_image(self, client, ship, uploads_dir):
        """Upload twice and verify the old file is deleted from disk."""
        layer = await create_layer(client, ship["id"])

        # First upload
        png1 = make_png_bytes(width=10, height=10)
        resp1 = await client.post(
            f"/api/holomap/layers/{layer['id']}/upload",
            files={"file": ("first.png", io.BytesIO(png1), "image/png")},
        )
        assert resp1.status_code == 200
        first_filename = resp1.json()["filename"]
        first_path = uploads_dir / "holomap" / first_filename
        assert first_path.exists()

        # Second upload
        png2 = make_png_bytes(width=20, height=20)
        resp2 = await client.post(
            f"/api/holomap/layers/{layer['id']}/upload",
            files={"file": ("second.png", io.BytesIO(png2), "image/png")},
        )
        assert resp2.status_code == 200
        second_filename = resp2.json()["filename"]

        # Old file should be gone, new one should exist
        assert not first_path.exists(), "Old image file should have been deleted"
        assert (uploads_dir / "holomap" / second_filename).exists()

    async def test_upload_layer_not_found(self, client, uploads_dir):
        """Upload to a nonexistent layer and expect 404."""
        png_data = make_png_bytes()
        resp = await client.post(
            "/api/holomap/layers/nonexistent/upload",
            files={"file": ("deck.png", io.BytesIO(png_data), "image/png")},
        )
        assert resp.status_code == 404
        assert "Layer not found" in resp.json()["detail"]

    async def test_upload_oversized_file(self, client, ship, uploads_dir):
        """Upload a file larger than 10MB and expect 400."""
        layer = await create_layer(client, ship["id"])
        # Create data just over 10MB
        oversized_data = b"\x00" * (10 * 1024 * 1024 + 1)
        resp = await client.post(
            f"/api/holomap/layers/{layer['id']}/upload",
            files={"file": ("huge.png", io.BytesIO(oversized_data), "image/png")},
        )
        assert resp.status_code == 400
        assert "File too large" in resp.json()["detail"]

    async def test_upload_svg_no_dimensions(self, client, ship, uploads_dir):
        """Upload an SVG file and verify width/height are 0 (SVGs skip PIL)."""
        layer = await create_layer(client, ship["id"])
        svg_data = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'
        resp = await client.post(
            f"/api/holomap/layers/{layer['id']}/upload",
            files={"file": ("deck.svg", io.BytesIO(svg_data), "image/svg+xml")},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["width"] == 0
        assert result["height"] == 0
        assert result["aspect_ratio"] == 0
        assert result["image_url"].endswith(".svg")


class TestLayerDeleteWithImage:
    """Tests for delete endpoints when actual image files exist on disk."""

    async def test_delete_layer_with_image_file(self, client, ship, uploads_dir):
        """Delete a layer that has an image file on disk; verify the file is removed."""
        layer = await create_layer(client, ship["id"])

        # Upload an actual image so the file exists on disk
        png_data = make_png_bytes()
        upload_resp = await client.post(
            f"/api/holomap/layers/{layer['id']}/upload",
            files={"file": ("deck.png", io.BytesIO(png_data), "image/png")},
        )
        assert upload_resp.status_code == 200
        filename = upload_resp.json()["filename"]
        image_path = uploads_dir / "holomap" / filename
        assert image_path.exists(), "Image file should exist before deletion"

        # Delete the layer
        resp = await client.delete(f"/api/holomap/layers/{layer['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

        # Verify the image file was removed from disk
        assert not image_path.exists(), "Image file should be deleted when layer is deleted"

    async def test_delete_layer_image_with_file(self, client, ship, uploads_dir):
        """DELETE /layers/{id}/image when an actual file exists on disk."""
        layer = await create_layer(client, ship["id"])

        # Upload an actual image
        png_data = make_png_bytes()
        upload_resp = await client.post(
            f"/api/holomap/layers/{layer['id']}/upload",
            files={"file": ("deck.png", io.BytesIO(png_data), "image/png")},
        )
        assert upload_resp.status_code == 200
        filename = upload_resp.json()["filename"]
        image_path = uploads_dir / "holomap" / filename
        assert image_path.exists(), "Image file should exist before deletion"

        # Delete just the image (not the layer)
        resp = await client.delete(f"/api/holomap/layers/{layer['id']}/image")
        assert resp.status_code == 200
        assert resp.json()["image_url"] == "placeholder"

        # Verify the image file was removed from disk
        assert not image_path.exists(), "Image file should be deleted"

        # Verify layer still exists but with placeholder
        resp = await client.get(f"/api/holomap/layers/{layer['id']}")
        assert resp.status_code == 200
        assert resp.json()["image_url"] == "placeholder"


class TestMarkerUpdateBranches:
    """Tests covering update_marker branches for type/severity/visible enum conversion."""

    async def test_update_marker_type(self, client, ship):
        """Update marker type from one valid type to another."""
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"], type="breach")
        assert marker["type"] == "breach"

        resp = await client.patch(f"/api/holomap/markers/{marker['id']}", json={
            "type": "fire",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["type"] == "fire"

    async def test_update_marker_visible(self, client, ship):
        """Toggle visible from True to False."""
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"], visible=True)
        assert marker["visible"] is True

        resp = await client.patch(f"/api/holomap/markers/{marker['id']}", json={
            "visible": False,
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["visible"] is False

        # Toggle back to True
        resp = await client.patch(f"/api/holomap/markers/{marker['id']}", json={
            "visible": True,
        })
        assert resp.status_code == 200
        assert resp.json()["visible"] is True

    async def test_update_marker_severity_and_type(self, client, ship):
        """Update both severity and type at once."""
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"], type="breach", severity="info")
        assert marker["type"] == "breach"
        assert marker["severity"] == "info"

        resp = await client.patch(f"/api/holomap/markers/{marker['id']}", json={
            "type": "hazard",
            "severity": "critical",
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["type"] == "hazard"
        assert updated["severity"] == "critical"

    async def test_update_marker_no_changes(self, client, ship):
        """PATCH with empty body should succeed without modifying the marker."""
        layer = await create_layer(client, ship["id"])
        marker = await create_marker(client, layer["id"], type="objective", label="Bridge")

        resp = await client.patch(f"/api/holomap/markers/{marker['id']}", json={})
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["type"] == "objective"
        assert updated["label"] == "Bridge"
