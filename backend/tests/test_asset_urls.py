"""Tests for the shared image/asset URL validator and the models that use it."""

import pytest

from app.models.base import validate_asset_url

VALID = [
    None,
    "",
    "/uploads/widget-assets/abc123.png",
    "/uploads/kel.png",
    "/uploads/holomap/deck_1.svg?v=2",
    "https://example.com/images/ship.png",
    "http://localhost:8000/uploads/x.gif",
]

INVALID = [
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "//evil.example.com/x.png",
    "/etc/passwd",
    "/uploads/",
    "/uploads/../secret.png",
    "/uploads/widget-assets/../../secret.png",
    "/uploads/./x.png",
    "/uploads//x.png",
    "/uploads/widget-assets\\..\\x.png",
    "/uploads/%2e%2e/secret.png",
    "/uploads/x.png\n",
    "https:///nohost.png",
    "ftp://example.com/x.png",
    "relative/path.png",
    "placeholder",
]


@pytest.mark.parametrize("url", VALID)
def test_valid_urls_accepted(url):
    assert validate_asset_url(url) == url


@pytest.mark.parametrize("url", INVALID)
def test_invalid_urls_rejected(url):
    with pytest.raises(ValueError):
        validate_asset_url(url)


def test_placeholder_only_when_allowed():
    assert validate_asset_url("placeholder", allow_placeholder=True) == "placeholder"


BAD_URL = "/uploads/../../etc/passwd"
GOOD_URL = "/uploads/widget-assets/ok.png"


class TestContactImageUrl:
    async def test_create_rejects_bad_url(self, client, ship):
        resp = await client.post(
            "/api/contacts", json={"ship_id": ship["id"], "name": "Kel", "image_url": BAD_URL}
        )
        assert resp.status_code == 422

    async def test_patch_rejects_bad_url(self, client, ship):
        resp = await client.post("/api/contacts", json={"ship_id": ship["id"], "name": "Kel", "image_url": GOOD_URL})
        assert resp.status_code == 200
        contact_id = resp.json()["id"]
        resp = await client.patch(f"/api/contacts/{contact_id}", json={"image_url": "javascript:alert(1)"})
        assert resp.status_code == 422
        resp = await client.patch(f"/api/contacts/{contact_id}", json={"image_url": None})
        assert resp.status_code == 200


class TestHolomapImageUrl:
    async def test_create_and_patch(self, client, ship):
        resp = await client.post(
            "/api/holomap/layers", json={"ship_id": ship["id"], "name": "Deck", "image_url": BAD_URL}
        )
        assert resp.status_code == 422

        resp = await client.post("/api/holomap/layers", json={"ship_id": ship["id"], "name": "Deck"})
        assert resp.status_code == 200
        assert resp.json()["image_url"] == "placeholder"
        layer_id = resp.json()["id"]

        resp = await client.patch(f"/api/holomap/layers/{layer_id}", json={"image_url": BAD_URL})
        assert resp.status_code == 422
        resp = await client.patch(f"/api/holomap/layers/{layer_id}", json={"image_url": GOOD_URL})
        assert resp.status_code == 200
        resp = await client.patch(f"/api/holomap/layers/{layer_id}", json={"image_url": "placeholder"})
        assert resp.status_code == 200


class TestSectorMapUrls:
    async def test_map_background(self, client, ship):
        resp = await client.post(
            "/api/sector-maps", json={"ship_id": ship["id"], "name": "Alpha", "background_image_url": BAD_URL}
        )
        assert resp.status_code == 422

        resp = await client.post("/api/sector-maps", json={"ship_id": ship["id"], "name": "Alpha"})
        assert resp.status_code == 200
        map_id = resp.json()["id"]
        resp = await client.patch(f"/api/sector-maps/{map_id}", json={"background_image_url": "data:text/html,x"})
        assert resp.status_code == 422
        resp = await client.patch(f"/api/sector-maps/{map_id}", json={"background_image_url": GOOD_URL})
        assert resp.status_code == 200

    async def test_sprite_image(self, client, ship):
        resp = await client.post(
            "/api/sector-maps/sprites", json={"ship_id": ship["id"], "name": "Planet", "image_url": BAD_URL}
        )
        assert resp.status_code == 422

        resp = await client.post(
            "/api/sector-maps/sprites", json={"ship_id": ship["id"], "name": "Planet", "image_url": GOOD_URL}
        )
        assert resp.status_code == 200
        sprite_id = resp.json()["id"]
        resp = await client.patch(f"/api/sector-maps/sprites/{sprite_id}", json={"image_url": BAD_URL})
        assert resp.status_code == 422
