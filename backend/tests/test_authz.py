"""
Authorization tests: authentication on every domain route, the player action
allowlist, field restrictions, and server-side visibility filtering.
"""

import re

import aiosqlite
import pytest
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from nanoid import generate as nanoid

from app.config import settings
from app.database import SCHEMA, get_db
from app.main import app
from app.services.auth import hash_password

# Routes reachable without logging in.
PUBLIC_ROUTES = {
    ("POST", "/api/auth/login"),
    ("GET", "/api/auth/status"),
    ("GET", "/api/health"),
    ("GET", "/api/theme/"),
    ("POST", "/api/theme/"),
    ("DELETE", "/api/theme/"),
}


@pytest.fixture
async def authz_db():
    conn = await aiosqlite.connect(":memory:")
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    await conn.executescript(SCHEMA)
    await conn.commit()
    try:
        yield conn
    finally:
        await conn.close()


@pytest.fixture
async def anon(authz_db, monkeypatch):
    """Anonymous client with auth enabled."""
    monkeypatch.setattr(settings, "auth_enabled", True)

    async def _override_get_db():
        yield authz_db

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def _make_user(db, username, role):
    user_id = nanoid(size=21)
    await db.execute(
        "INSERT INTO users (id, username, display_name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
        (user_id, username, username.title(), hash_password("password123"), role),
    )
    await db.commit()
    return user_id


async def _client_for(db, username):
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    resp = await client.post("/api/auth/login", json={"username": username, "password": "password123"})
    assert resp.status_code == 200, resp.text
    return client


@pytest.fixture
async def world(anon, authz_db):
    """Users (admin, gm, player with access, outsider player) and a ship full of fixtures."""
    db = authz_db
    await _make_user(db, "admin", "admin")
    await _make_user(db, "gm", "gm")
    player_id = await _make_user(db, "player", "player")
    await _make_user(db, "outsider", "player")

    admin = await _client_for(db, "admin")
    gm = await _client_for(db, "gm")
    player = await _client_for(db, "player")
    outsider = await _client_for(db, "outsider")

    async def post(path, payload):
        resp = await admin.post(path, json=payload)
        assert resp.status_code == 200, (path, resp.text)
        return resp.json()

    ship = await post("/api/ships", {"name": "Authz Ship", "seed_type": "blank"})
    sid = ship["id"]
    resp = await admin.post(f"/api/ships/{sid}/access", json={"user_id": player_id})
    assert resp.status_code in (200, 201), resp.text

    w = {"ship_id": sid, "admin": admin, "gm": gm, "player": player, "outsider": outsider, "anon": anon}
    w["system"] = await post(
        "/api/system-states", {"id": "reactor", "ship_id": sid, "name": "Reactor", "value": 100, "max_value": 100}
    )
    w["asset"] = await post(
        "/api/assets",
        {"ship_id": sid, "name": "Railgun", "asset_type": "railgun", "is_armed": True, "is_ready": True,
         "ammo_current": 5, "ammo_max": 10},
    )
    w["cargo"] = await post("/api/cargo", {"ship_id": sid, "name": "Crate"})
    w["bay"] = await post("/api/cargo-bays", {"ship_id": sid, "name": "Bay 1"})
    w["contact"] = await post("/api/contacts", {"ship_id": sid, "name": "Vex"})
    w["crew"] = await post("/api/crew", {"ship_id": sid, "name": "Ensign Kim"})
    w["visible_sc"] = await post(
        "/api/sensor-contacts", {"ship_id": sid, "label": "Blip", "visible": True, "notes": "GM: it's a trap"}
    )
    w["hidden_sc"] = await post(
        "/api/sensor-contacts", {"ship_id": sid, "label": "Cloaked", "visible": False, "notes": "secret"}
    )
    w["task"] = await post("/api/tasks", {"ship_id": sid, "title": "Fix it", "station": "engineering"})
    w["hidden_task"] = await post(
        "/api/tasks", {"ship_id": sid, "title": "Ambush", "station": "tactical", "visible": False}
    )
    w["timer"] = await post("/api/timers", {"ship_id": sid, "label": "Warp", "duration_seconds": 600})
    w["gm_timer"] = await post(
        "/api/timers", {"ship_id": sid, "label": "Reinforcements", "duration_seconds": 600, "gm_only": True}
    )
    w["alert"] = await post(
        "/api/events",
        {"ship_id": sid, "type": "alert", "severity": "warning", "message": "Hull breach",
         "data": {"acknowledged": False, "location": "Deck 3"}},
    )
    w["transmission"] = await post(
        "/api/events",
        {"ship_id": sid, "type": "transmission_received", "message": "Incoming",
         "data": {"text": "hello", "encrypted": True, "decrypted": False, "decryption_attempts": 0}},
    )
    w["log"] = await post("/api/events", {"ship_id": sid, "type": "log_entry", "message": "Captain's log"})
    w["secret_event"] = await post(
        "/api/events", {"ship_id": sid, "type": "log_entry", "message": "GM draft", "transmitted": False}
    )
    w["panel"] = await post(
        "/api/panels", {"ship_id": sid, "name": "Bridge", "slug": "bridge", "station_group": "command"}
    )
    w["gm_panel"] = await post(
        "/api/panels",
        {"ship_id": sid, "name": "GM Screen", "slug": "gm-screen", "station_group": "admin",
         "role_visibility": ["gm"]},
    )
    w["widget"] = await post(
        f"/api/panels/{w['panel']['id']}/widgets",
        {"panel_id": w["panel"]["id"], "widget_type": "contact_tracker", "x": 0, "y": 0, "width": 4,
         "height": 4, "config": {}},
    )
    w["map"] = await post("/api/sector-maps", {"ship_id": sid, "name": "Sector 7"})
    resp = await admin.post(f"/api/sector-maps/{w['map']['id']}/set-active")
    assert resp.status_code == 200
    w["gm_waypoint"] = await post(
        f"/api/sector-maps/{w['map']['id']}/waypoints",
        {"map_id": w["map"]["id"], "hex_q": 0, "hex_r": 0, "created_by": "gm"},
    )
    w["hidden_object"] = await post(
        f"/api/sector-maps/{w['map']['id']}/objects",
        {"map_id": w["map"]["id"], "hex_q": 1, "hex_r": 1, "label": "Hidden base", "visibility_state": "hidden"},
    )
    w["visible_object"] = await post(
        f"/api/sector-maps/{w['map']['id']}/objects",
        {"map_id": w["map"]["id"], "hex_q": 2, "hex_r": 2, "label": "Station", "visibility_state": "visible"},
    )
    w["scenario"] = await post("/api/scenarios", {"ship_id": sid, "name": "Boarding", "actions": []})
    w["layer"] = await post("/api/holomap/layers", {"ship_id": sid, "name": "Deck 1", "visible": True})
    w["hidden_marker"] = await post(
        f"/api/holomap/layers/{w['layer']['id']}/markers",
        {"layer_id": w["layer"]["id"], "type": "hazard", "x": 0.5, "y": 0.5, "visible": False},
    )
    w["visible_marker"] = await post(
        f"/api/holomap/layers/{w['layer']['id']}/markers",
        {"layer_id": w["layer"]["id"], "type": "hazard", "x": 0.2, "y": 0.2, "visible": True},
    )

    yield w

    for c in (admin, gm, player, outsider):
        await c.aclose()


# ---------------------------------------------------------------------------
# (a) Every domain route requires authentication
# ---------------------------------------------------------------------------


async def test_every_api_route_requires_auth(anon):
    checked = 0
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api"):
            continue
        for method in route.methods - {"HEAD"}:
            if (method, route.path) in PUBLIC_ROUTES:
                continue
            path = re.sub(r"\{[^}]+\}", "x", route.path)
            kwargs = {"json": {}} if method in ("POST", "PATCH", "PUT") else {}
            resp = await anon.request(method, path, **kwargs)
            assert resp.status_code == 401, f"{method} {route.path} -> {resp.status_code}"
            checked += 1
    assert checked > 150


async def test_public_routes_stay_public(anon):
    assert (await anon.get("/api/health")).status_code == 200
    assert (await anon.get("/api/auth/status")).status_code == 200
    assert (await anon.get("/api/theme/")).status_code == 200


async def test_session_router_removed(anon):
    assert (await anon.get("/api/session/ship")).status_code == 404


# ---------------------------------------------------------------------------
# (b) Players are refused GM mutations and disallowed fields
# ---------------------------------------------------------------------------


async def test_player_forbidden_gm_mutations(world):
    w, p, sid = world, world["player"], world["ship_id"]
    forbidden = [
        ("DELETE", f"/api/ships/{sid}", None),
        ("PATCH", f"/api/ships/{sid}", {"name": "Mine now"}),
        ("POST", f"/api/scenarios/{w['scenario']['id']}/execute", None),
        ("POST", "/api/system-states", {"id": "new", "ship_id": sid, "name": "New", "value": 1, "max_value": 1}),
        ("DELETE", f"/api/system-states/{w['system']['id']}", None),
        ("POST", "/api/system-states/bulk-reset", {"ship_id": sid, "reset_all": True}),
        ("POST", "/api/events", {"ship_id": sid, "type": "alert", "message": "fake"}),
        ("PATCH", f"/api/sensor-contacts/{w['visible_sc']['id']}/hide", None),
        ("POST", "/api/timers", {"ship_id": sid, "label": "x", "duration_seconds": 5}),
        ("POST", f"/api/timers/{w['timer']['id']}/pause", None),
        ("PATCH", f"/api/tasks/{w['task']['id']}", {"visible": False}),
        ("DELETE", f"/api/tasks/{w['task']['id']}", None),
        ("DELETE", f"/api/cargo/{w['cargo']['id']}", None),
        ("POST", "/api/panels", {"ship_id": sid, "name": "P", "slug": "p", "station_group": "command"}),
        ("DELETE", f"/api/panels/widgets/{w['widget']['id']}", None),
        ("POST", f"/api/panels/{w['panel']['id']}/layout", []),
        ("POST", f"/api/sector-maps/{w['map']['id']}/objects", {"map_id": w["map"]["id"], "hex_q": 0, "hex_r": 0}),
        ("POST", f"/api/ships/{sid}/hail", None),
        ("POST", "/api/ships", {"name": "Pirate", "seed_type": "blank"}),
    ]
    for method, path, body in forbidden:
        kwargs = {"json": body} if body is not None else {}
        resp = await p.request(method, path, **kwargs)
        assert resp.status_code == 403, f"{method} {path} -> {resp.status_code} {resp.text}"


@pytest.mark.parametrize(
    ("key", "path_tpl", "body", "field"),
    [
        ("system", "/api/system-states/{id}", {"name": "Hacked"}, "name"),
        ("system", "/api/system-states/{id}", {"max_value": 999}, "max_value"),
        ("asset", "/api/assets/{id}", {"damage": 999}, "damage"),
        ("cargo", "/api/cargo/{id}", {"size_class": "large"}, "size_class"),
        ("crew", "/api/crew/{id}", {"name": "Admiral"}, "name"),
        ("visible_sc", "/api/sensor-contacts/{id}", {"label": "Friendly"}, "label"),
        ("visible_sc", "/api/sensor-contacts/{id}", {"visible": False}, "visible"),
        ("widget", "/api/panels/widgets/{id}", {"x": 10}, "x"),
        ("alert", "/api/events/{id}", {"message": "nothing to see"}, "message"),
        ("alert", "/api/events/{id}", {"data": {"acknowledged": True, "location": "Deck 9"}}, "data.location"),
        ("alert", "/api/events/{id}", {"transmitted": False}, "transmitted"),
        ("log", "/api/events/{id}", {"data": {"acknowledged": True}}, "data.acknowledged"),
    ],
)
async def test_player_disallowed_fields(world, key, path_tpl, body, field):
    resp = await world["player"].patch(path_tpl.format(id=world[key]["id"]), json=body)
    assert resp.status_code == 403, resp.text
    assert field in resp.json()["detail"]


async def test_player_event_and_waypoint_restrictions(world):
    w, p = world, world["player"]
    # Only alerts can be cleared
    assert (await p.delete(f"/api/events/{w['log']['id']}")).status_code == 403
    # GM waypoints are off limits; player waypoints must be tagged as such
    assert (await p.delete(f"/api/sector-maps/waypoints/{w['gm_waypoint']['id']}")).status_code == 403
    resp = await p.patch(f"/api/sector-maps/waypoints/{w['gm_waypoint']['id']}", json={"label": "x"})
    assert resp.status_code == 403
    resp = await p.post(
        f"/api/sector-maps/{w['map']['id']}/waypoints",
        json={"map_id": w["map"]["id"], "hex_q": 3, "hex_r": 3, "created_by": "gm"},
    )
    assert resp.status_code == 403
    # Hidden resources are invisible, even for allowed actions
    assert (await p.post(f"/api/tasks/{w['hidden_task']['id']}/claim?claimed_by=P")).status_code == 404
    resp = await p.patch(f"/api/sensor-contacts/{w['hidden_sc']['id']}", json={"threat_level": "hostile"})
    assert resp.status_code == 404


async def test_player_without_ship_access(world):
    o, sid = world["outsider"], world["ship_id"]
    assert (await o.get(f"/api/system-states?ship_id={sid}")).status_code == 403
    assert (await o.get(f"/api/ships/{sid}")).status_code == 403
    assert (await o.get(f"/api/events/{world['alert']['id']}")).status_code == 403
    resp = await o.patch(f"/api/system-states/{world['system']['id']}", json={"value": 1})
    assert resp.status_code == 403
    assert (await o.get("/api/ships")).json() == []


async def test_player_must_scope_lists_to_a_ship(world):
    assert (await world["player"].get("/api/system-states")).status_code == 400
    assert (await world["player"].get("/api/sensor-contacts")).status_code == 400


async def test_player_gm_only_reads(world):
    p, sid = world["player"], world["ship_id"]
    assert (await p.get(f"/api/scenarios?ship_id={sid}")).status_code == 403
    assert (await p.get(f"/api/scenarios/{world['scenario']['id']}")).status_code == 403
    assert (await p.get(f"/api/ships/{sid}/export")).status_code == 403


async def test_role_override_promotes_player_to_gm(world, authz_db):
    await authz_db.execute(
        "UPDATE ship_access SET role_override = 'gm' WHERE ship_id = ?", (world["ship_id"],)
    )
    await authz_db.commit()
    resp = await world["player"].get(f"/api/sensor-contacts?ship_id={world['ship_id']}")
    assert len(resp.json()) == 2
    resp = await world["player"].patch(f"/api/system-states/{world['system']['id']}", json={"name": "Core"})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# (c) Every allowed player action works
# ---------------------------------------------------------------------------


async def test_player_allowed_actions(world):
    w, p, sid = world, world["player"], world["ship_id"]

    async def ok(method, path, body=None):
        kwargs = {"json": body} if body is not None else {}
        resp = await p.request(method, path, **kwargs)
        assert resp.status_code == 200, f"{method} {path} -> {resp.status_code} {resp.text}"
        return resp.json()

    # System state status/value
    await ok("PATCH", f"/api/system-states/{w['system']['id']}", {"value": 50})
    await ok("PATCH", f"/api/system-states/{w['system']['id']}", {"status": "degraded"})
    # Player edit modal sends the whole record back; unchanged read-only fields are fine
    record = await ok("GET", f"/api/system-states/{w['system']['id']}")
    record["value"] = 40
    await ok("PATCH", f"/api/system-states/{w['system']['id']}", record)

    # Assets: player fields + fire
    await ok("PATCH", f"/api/assets/{w['asset']['id']}", {"is_armed": True, "current_target": w["visible_sc"]["id"]})
    asset = await ok("GET", f"/api/assets/{w['asset']['id']}")
    asset["ammo_current"] = 4
    await ok("PATCH", f"/api/assets/{w['asset']['id']}", asset)
    await ok("POST", f"/api/assets/{w['asset']['id']}/fire")

    # Cargo: create, rename/notes, place/move/remove
    crate = await ok("POST", "/api/cargo", {"ship_id": sid, "name": "Spare parts"})
    await ok("PATCH", f"/api/cargo/{crate['id']}", {"name": "Spare parts (used)", "notes": "half gone"})
    await ok("POST", "/api/cargo-placements/validate", {"cargo_id": crate["id"], "bay_id": w["bay"]["id"], "x": 0,
                                                         "y": 0})
    placement = await ok(
        "POST", "/api/cargo-placements", {"cargo_id": crate["id"], "bay_id": w["bay"]["id"], "x": 0, "y": 0}
    )
    await ok("PATCH", f"/api/cargo-placements/{placement['id']}", {"x": 1})
    await ok("DELETE", f"/api/cargo-placements/{placement['id']}")

    # Contacts: create + edit
    contact = await ok("POST", "/api/contacts", {"ship_id": sid, "name": "Smuggler"})
    await ok("PATCH", f"/api/contacts/{contact['id']}", {"threat_level": "hostile", "notes": "owes us"})

    # Tasks: create, claim, complete
    task = await ok("POST", "/api/tasks", {"ship_id": sid, "title": "Reroute power", "station": "engineering"})
    await ok("POST", f"/api/tasks/{w['task']['id']}/claim?claimed_by=Player")
    await ok("POST", f"/api/tasks/{w['task']['id']}/complete?status=succeeded")
    assert task["id"]

    # Alerts: acknowledge then clear
    alert = await ok("GET", f"/api/events/{w['alert']['id']}")
    ack = {**alert["data"], "acknowledged": True, "acknowledged_at": "2026-01-01T00:00:00Z"}
    updated = await ok("PATCH", f"/api/events/{w['alert']['id']}", {"data": ack})
    assert updated["data"]["acknowledged"] is True
    await ok("DELETE", f"/api/events/{w['alert']['id']}")

    # Transmissions: decryption attempt then clear from console
    tx = await ok("GET", f"/api/events/{w['transmission']['id']}")
    data = {**tx["data"], "decryption_attempts": 1, "decryption_cooldown_until": "2026-01-01T00:00:30Z"}
    await ok("PATCH", f"/api/events/{w['transmission']['id']}", {"data": data})
    data = {k: v for k, v in data.items() if k != "decryption_cooldown_until"} | {"decrypted": True}
    await ok("PATCH", f"/api/events/{w['transmission']['id']}", {"data": data})
    await ok("PATCH", f"/api/events/{w['transmission']['id']}", {"transmitted": False})

    # Widget runtime config
    widget = await ok("PATCH", f"/api/panels/widgets/{w['widget']['id']}", {"config": {"pinnedContactIds": ["a"]}})
    assert widget["config"] == {"pinnedContactIds": ["a"]}

    # Player waypoints
    wp = await ok(
        "POST",
        f"/api/sector-maps/{w['map']['id']}/waypoints",
        {"map_id": w["map"]["id"], "hex_q": 4, "hex_r": 4, "created_by": "player"},
    )
    await ok("PATCH", f"/api/sector-maps/waypoints/{wp['id']}", {"label": "Rendezvous"})
    await ok("DELETE", f"/api/sector-maps/waypoints/{wp['id']}")

    # Posture, hail, radar threat classification, crew status
    await ok("PATCH", f"/api/ships/{sid}/posture?posture=red")
    await ok("DELETE", f"/api/ships/{sid}/hail")
    await ok("PATCH", f"/api/sensor-contacts/{w['visible_sc']['id']}", {"threat_level": "hostile"})
    await ok("PATCH", f"/api/crew/{w['crew']['id']}", {"status": "light_duty"})

    # The alert feed also acknowledges/clears system events such as status changes
    resp = await w["admin"].post(
        "/api/events", json={"ship_id": sid, "type": "status_change", "message": "Reactor degraded", "data": {}}
    )
    ev = resp.json()
    await ok("PATCH", f"/api/events/{ev['id']}", {"data": {"acknowledged": True}})
    await ok("DELETE", f"/api/events/{ev['id']}")


# ---------------------------------------------------------------------------
# (d) Player reads are filtered server-side; (e) GMs still see everything
# ---------------------------------------------------------------------------


async def test_player_reads_are_filtered(world):
    w, p, sid = world, world["player"], world["ship_id"]

    contacts = (await p.get(f"/api/sensor-contacts?ship_id={sid}&visible=false")).json()
    assert [c["id"] for c in contacts] == [w["visible_sc"]["id"]]
    assert contacts[0]["notes"] is None
    dossiers = (await p.get(f"/api/sensor-contacts/with-dossiers?ship_id={sid}")).json()
    assert [c["id"] for c in dossiers] == [w["visible_sc"]["id"]]
    assert dossiers[0]["notes"] is None
    assert (await p.get(f"/api/sensor-contacts/{w['visible_sc']['id']}")).json()["notes"] is None
    assert (await p.get(f"/api/sensor-contacts/{w['hidden_sc']['id']}")).status_code == 404

    timers = (await p.get(f"/api/timers?ship_id={sid}&gm_only=true")).json()
    assert [t["id"] for t in timers] == [w["timer"]["id"]]
    assert (await p.get(f"/api/timers/{w['gm_timer']['id']}")).status_code == 404

    events = (await p.get(f"/api/events?ship_id={sid}&transmitted=false")).json()
    assert w["secret_event"]["id"] not in {e["id"] for e in events}
    assert events
    feed = (await p.get(f"/api/events/feed/{sid}?transmitted=false")).json()
    assert w["secret_event"]["id"] not in {e["id"] for e in feed}
    assert (await p.get(f"/api/events/{w['secret_event']['id']}")).status_code == 404

    tasks = (await p.get(f"/api/tasks?ship_id={sid}&visible=false")).json()
    assert [t["id"] for t in tasks] == [w["task"]["id"]]
    assert (await p.get(f"/api/tasks/{w['hidden_task']['id']}")).status_code == 404

    panels = (await p.get(f"/api/panels?ship_id={sid}")).json()
    assert [x["id"] for x in panels] == [w["panel"]["id"]]
    by_station = (await p.get(f"/api/panels/by-station?ship_id={sid}")).json()
    assert "admin" not in by_station
    assert (await p.get(f"/api/panels/{w['gm_panel']['id']}")).status_code == 404
    assert (await p.get(f"/api/ships/{sid}/panels/gm-screen")).status_code == 404
    assert (await p.get(f"/api/ships/{sid}/panels/bridge")).status_code == 200

    layer = (await p.get(f"/api/holomap/layers/{w['layer']['id']}")).json()
    assert [m["id"] for m in layer["markers"]] == [w["visible_marker"]["id"]]
    markers = (await p.get(f"/api/holomap/markers?ship_id={sid}")).json()
    assert [m["id"] for m in markers] == [w["visible_marker"]["id"]]
    markers = (await p.get(f"/api/holomap/layers/{w['layer']['id']}/markers")).json()
    assert [m["id"] for m in markers] == [w["visible_marker"]["id"]]
    assert (await p.get(f"/api/holomap/markers/{w['hidden_marker']['id']}")).status_code == 404

    active = (await p.get(f"/api/sector-maps/active?ship_id={sid}&visible_only=false")).json()
    assert [o["id"] for o in active["objects"]] == [w["visible_object"]["id"]]
    full = (await p.get(f"/api/sector-maps/{w['map']['id']}?visible_only=false")).json()
    assert [o["id"] for o in full["objects"]] == [w["visible_object"]["id"]]
    objects = (await p.get(f"/api/sector-maps/{w['map']['id']}/objects")).json()
    assert [o["id"] for o in objects] == [w["visible_object"]["id"]]

    assert [s["id"] for s in (await p.get("/api/ships")).json()] == [sid]


@pytest.mark.parametrize("who", ["gm", "admin"])
async def test_gm_sees_everything(world, who):
    c, w, sid = world[who], world, world["ship_id"]
    contacts = (await c.get(f"/api/sensor-contacts?ship_id={sid}")).json()
    assert len(contacts) == 2
    assert {x["notes"] for x in contacts} == {"GM: it's a trap", "secret"}
    # Params are still honoured for GMs
    assert len((await c.get(f"/api/sensor-contacts?ship_id={sid}&visible=false")).json()) == 1
    assert len((await c.get(f"/api/timers?ship_id={sid}")).json()) == 2
    assert w["secret_event"]["id"] in {e["id"] for e in (await c.get(f"/api/events?ship_id={sid}")).json()}
    assert len((await c.get(f"/api/tasks?ship_id={sid}")).json()) == 2
    assert len((await c.get(f"/api/panels?ship_id={sid}")).json()) == 2
    assert (await c.get(f"/api/ships/{sid}/panels/gm-screen")).status_code == 200
    layer = (await c.get(f"/api/holomap/layers/{w['layer']['id']}")).json()
    assert len(layer["markers"]) == 2
    full = (await c.get(f"/api/sector-maps/{w['map']['id']}")).json()
    assert len(full["objects"]) == 2
    assert (await c.get(f"/api/scenarios?ship_id={sid}")).status_code == 200
    resp = await c.patch(f"/api/system-states/{w['system']['id']}", json={"name": "Main Reactor"})
    assert resp.status_code == 200
