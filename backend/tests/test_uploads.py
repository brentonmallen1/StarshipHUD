"""Tests for the Uploads API (widget asset uploads)."""

import io

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.routing import Mount

from app.api import uploads as uploads_api
from app.config import settings
from app.main import app
from app.services.uploads import UPLOADS_CSP, UploadsStaticFiles, read_upload_limited


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


class TestUploadLimits:
    async def test_oversized_upload_rejected(self, client, uploads_dir, monkeypatch):
        monkeypatch.setattr(uploads_api, "MAX_FILE_SIZE", 1024)
        resp = await client.post(
            "/api/uploads/widget-assets",
            files={"file": ("big.png", io.BytesIO(b"\x00" * 2048), "image/png")},
        )
        assert resp.status_code == 400
        assert "File too large" in resp.json()["detail"]
        assert not (uploads_dir / "widget-assets").exists() or not any(
            p.suffix == ".png" for p in (uploads_dir / "widget-assets").iterdir()
        )

    async def test_read_stops_once_limit_exceeded(self):
        """The reader aborts mid-stream instead of buffering the whole file."""

        class FakeUpload:
            def __init__(self):
                self.reads = 0

            async def read(self, size=-1):
                self.reads += 1
                return b"\x00" * size

        fake = FakeUpload()
        with pytest.raises(HTTPException) as exc:
            await read_upload_limited(fake, max_bytes=3 * 1024 * 1024)
        assert exc.value.status_code == 400
        assert fake.reads == 4  # 4 x 1MB chunks, then abort

    async def test_rename_rejects_path_segments(self, client, uploads_dir):
        resp = await client.patch("/api/uploads/widget-assets/..", json={"display_name": "x"})
        assert resp.status_code == 404


SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>'


class TestUploadsServingHeaders:
    def test_app_mounts_hardened_static_files(self):
        mounts = [r for r in app.routes if getattr(r, "path", None) == "/uploads"]
        assert len(mounts) == 1
        assert isinstance(mounts[0].app, UploadsStaticFiles)

    async def test_served_files_are_sandboxed(self, tmp_path):
        (tmp_path / "evil.svg").write_bytes(SVG)
        (tmp_path / "ok.png").write_bytes(b"\x89PNG\r\n\x1a\n")
        static_app = Starlette(routes=[Mount("/uploads", UploadsStaticFiles(directory=str(tmp_path)))])

        transport = ASGITransport(app=static_app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            for name in ("evil.svg", "ok.png"):
                resp = await ac.get(f"/uploads/{name}")
                assert resp.status_code == 200
                assert resp.headers["content-security-policy"] == UPLOADS_CSP
                assert "sandbox" in resp.headers["content-security-policy"]
                assert "default-src 'none'" in resp.headers["content-security-policy"]
                assert resp.headers["x-content-type-options"] == "nosniff"

            resp = await ac.get("/uploads/missing.png")
            assert resp.status_code == 404
