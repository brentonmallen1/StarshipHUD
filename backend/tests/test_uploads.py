"""Tests for the Uploads API (widget asset uploads)."""

import io

import pytest

from app.config import settings


@pytest.fixture
async def uploads_dir(tmp_path):
    """Override uploads_dir to use a temp directory."""
    original = settings.uploads_dir
    settings.uploads_dir = str(tmp_path)
    yield tmp_path
    settings.uploads_dir = original


class TestWidgetAssetUpload:
    async def test_upload_valid_image(self, client, uploads_dir):
        # Create a small valid PNG (1x1 pixel)
        png_data = (
            b"\x89PNG\r\n\x1a\n"  # PNG signature
            b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02"
            b"\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx"
            b"\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N"
            b"\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        resp = await client.post(
            "/api/uploads/widget-assets",
            files={"file": ("test.png", io.BytesIO(png_data), "image/png")},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["image_url"].startswith("/uploads/widget-assets/")
        assert result["image_url"].endswith(".png")
        assert "filename" in result

    async def test_upload_invalid_extension(self, client, uploads_dir):
        resp = await client.post(
            "/api/uploads/widget-assets",
            files={"file": ("malware.exe", io.BytesIO(b"bad data"), "application/octet-stream")},
        )
        assert resp.status_code == 400
        assert "Invalid file type" in resp.json()["detail"]

    async def test_upload_gif(self, client, uploads_dir):
        gif_data = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
        resp = await client.post(
            "/api/uploads/widget-assets",
            files={"file": ("anim.gif", io.BytesIO(gif_data), "image/gif")},
        )
        assert resp.status_code == 200
        assert resp.json()["image_url"].endswith(".gif")


class TestWidgetAssetDelete:
    async def test_delete_asset(self, client, uploads_dir):
        # Upload first
        png_data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
        resp = await client.post(
            "/api/uploads/widget-assets",
            files={"file": ("test.png", io.BytesIO(png_data), "image/png")},
        )
        image_url = resp.json()["image_url"]

        # Delete it
        resp = await client.delete(f"/api/uploads/widget-assets?image_url={image_url}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_asset_invalid_url(self, client, uploads_dir):
        resp = await client.delete("/api/uploads/widget-assets?image_url=/some/other/path.png")
        assert resp.status_code == 400
        assert "Invalid asset URL" in resp.json()["detail"]

    async def test_delete_asset_not_found(self, client, uploads_dir):
        resp = await client.delete(
            "/api/uploads/widget-assets?image_url=/uploads/widget-assets/nonexistent.png"
        )
        assert resp.status_code == 404
