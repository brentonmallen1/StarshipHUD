"""
Authorization: per-ship roles, the player action allowlist, and visibility rules.

`authorize_request` is attached to every domain router in `app.main`. For each
request it:

1. authenticates the caller (via `get_current_user`, so anonymous -> 401),
2. works out which ship(s) the request touches (path/query/body `ship_id`, or
   the ship that owns the resource named in the path, e.g. `/events/{event_id}`),
3. computes the caller's effective role on those ships (admin > ship_access
   role_override > global role) and rejects players who have no access to the
   ship,
4. rejects player mutations that are not on the player allowlist
   (`PLAYER_RULES`), including field-level restrictions,
5. hides GM-only resources from players on by-id routes (404).

List endpoints use the returned `Authz` to force visibility filters for players.

When auth is disabled every caller is the mock admin from `get_current_user`, so
none of this changes behaviour in "trusted table" mode.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated, Any

import aiosqlite
from fastapi import Depends, HTTPException, Request, status

from app.config import settings
from app.database import get_db
from app.models.base import Role
from app.services.auth import ROLE_HIERARCHY, get_current_user, get_effective_role, get_ship_access
from app.utils import safe_json_loads

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@dataclass
class Authz:
    """Authorization context for one request."""

    user: dict
    role: Role
    ship_ids: set[str] = field(default_factory=set)

    @property
    def is_player(self) -> bool:
        return self.role == Role.PLAYER

    @property
    def is_gm(self) -> bool:
        return ROLE_HIERARCHY.get(self.role, 0) >= ROLE_HIERARCHY[Role.GM]


# ---------------------------------------------------------------------------
# Effective role helpers
# ---------------------------------------------------------------------------


def _global_role(user: dict) -> Role:
    return Role(user["role"])


async def get_ship_role(db: aiosqlite.Connection, user: dict, ship_id: str) -> Role:
    """Effective role of `user` on `ship_id`; 403 for a player without ship access.

    Admins always get ADMIN. Otherwise the ship_access.role_override wins, then the
    user's global role. Players need a ship_access row (the same rule `/auth/my-ships`
    uses to list ships); GMs are trusted across ships unless demoted by an override.
    """
    if not settings.auth_enabled or _global_role(user) == Role.ADMIN:
        return Role.ADMIN
    access = await get_ship_access(db, user["user_id"], ship_id)
    role = get_effective_role(user, access)
    if role == Role.PLAYER and access is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this ship")
    return role


async def is_player_view(db: aiosqlite.Connection, user: dict, ship_id: str | None) -> bool:
    """True when `user` should get the filtered player view of `ship_id`."""
    if ship_id is None:
        return settings.auth_enabled and _global_role(user) == Role.PLAYER
    return await get_ship_role(db, user, ship_id) == Role.PLAYER


async def accessible_ship_ids(db: aiosqlite.Connection, user: dict) -> set[str] | None:
    """Ship IDs a user may see, or None when unrestricted (admin/GM/auth disabled)."""
    if not settings.auth_enabled or _global_role(user) in (Role.ADMIN, Role.GM):
        return None
    cursor = await db.execute("SELECT ship_id FROM ship_access WHERE user_id = ?", (user["user_id"],))
    return {row["ship_id"] for row in await cursor.fetchall()}


def _min_role(roles: list[Role]) -> Role:
    return min(roles, key=lambda r: ROLE_HIERARCHY.get(r, 0))


# ---------------------------------------------------------------------------
# Resource -> ship resolution
# ---------------------------------------------------------------------------

# (first path segment after /api, parameter name) -> SQL returning ship_id for that id.
# Parameters are looked up in the path, then the query string, then the JSON body.
SHIP_RESOLVERS: dict[tuple[str, str], str] = {
    ("panels", "panel_id"): "SELECT ship_id FROM panels WHERE id = ?",
    ("panels", "widget_id"): (
        "SELECT p.ship_id FROM widget_instances w JOIN panels p ON p.id = w.panel_id WHERE w.id = ?"
    ),
    ("system-states", "state_id"): "SELECT ship_id FROM system_states WHERE id = ?",
    ("system-categories", "category_id"): "SELECT ship_id FROM system_categories WHERE id = ?",
    ("events", "event_id"): "SELECT ship_id FROM events WHERE id = ?",
    ("scenarios", "scenario_id"): "SELECT ship_id FROM scenarios WHERE id = ?",
    ("contacts", "contact_id"): "SELECT ship_id FROM contacts WHERE id = ?",
    ("crew", "crew_id"): "SELECT ship_id FROM crew WHERE id = ?",
    ("sensor-contacts", "sensor_contact_id"): "SELECT ship_id FROM sensor_contacts WHERE id = ?",
    ("tasks", "task_id"): "SELECT ship_id FROM tasks WHERE id = ?",
    ("incidents", "incident_id"): "SELECT ship_id FROM incidents WHERE id = ?",
    ("assets", "asset_id"): "SELECT ship_id FROM assets WHERE id = ?",
    ("cargo", "cargo_id"): "SELECT ship_id FROM cargo WHERE id = ?",
    ("cargo-bays", "bay_id"): "SELECT ship_id FROM cargo_bays WHERE id = ?",
    ("cargo-categories", "category_id"): "SELECT ship_id FROM cargo_categories WHERE id = ?",
    ("cargo-placements", "placement_id"): (
        "SELECT c.ship_id FROM cargo_placements p JOIN cargo c ON c.id = p.cargo_id WHERE p.id = ?"
    ),
    ("cargo-placements", "cargo_id"): "SELECT ship_id FROM cargo WHERE id = ?",
    ("cargo-placements", "bay_id"): "SELECT ship_id FROM cargo_bays WHERE id = ?",
    ("holomap", "layer_id"): "SELECT ship_id FROM holomap_layers WHERE id = ?",
    ("holomap", "marker_id"): (
        "SELECT l.ship_id FROM holomap_markers m JOIN holomap_layers l ON l.id = m.layer_id WHERE m.id = ?"
    ),
    ("sector-maps", "map_id"): "SELECT ship_id FROM sector_maps WHERE id = ?",
    ("sector-maps", "preset_id"): "SELECT ship_id FROM gm_waypoint_presets WHERE id = ?",
    ("sector-maps", "sprite_id"): "SELECT ship_id FROM sector_sprites WHERE id = ?",
    ("sector-maps", "obj_id"): (
        "SELECT m.ship_id FROM sector_map_objects o JOIN sector_maps m ON m.id = o.map_id WHERE o.id = ?"
    ),
    ("sector-maps", "waypoint_id"): (
        "SELECT m.ship_id FROM sector_map_waypoints w JOIN sector_maps m ON m.id = w.map_id WHERE w.id = ?"
    ),
    ("timers", "timer_id"): "SELECT ship_id FROM timers WHERE id = ?",
}


async def _json_body(request: Request) -> dict | None:
    """The request's JSON object body, or None (FastAPI caches the parsed body)."""
    if request.method not in MUTATING_METHODS:
        return None
    if "application/json" not in request.headers.get("content-type", ""):
        return None
    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return None
    return body if isinstance(body, dict) else None


async def _resolve_ship_ids(
    db: aiosqlite.Connection, segment: str, request: Request, body: dict | None
) -> set[str]:
    """Every ship the request touches. 404 if a referenced resource does not exist."""
    sources: list[dict[str, Any]] = [dict(request.path_params), dict(request.query_params), body or {}]
    ship_ids: set[str] = set()
    for source in sources:
        if isinstance(source.get("ship_id"), str):
            ship_ids.add(source["ship_id"])
        for (seg, param), sql in SHIP_RESOLVERS.items():
            if seg != segment or not isinstance(source.get(param), str):
                continue
            cursor = await db.execute(sql, (source[param],))
            row = await cursor.fetchone()
            if row is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
            ship_ids.add(row["ship_id"])
    return ship_ids


def _ship_scoping_params(segment: str) -> set[str]:
    return {"ship_id"} | {param for (seg, param) in SHIP_RESOLVERS if seg == segment}


# ---------------------------------------------------------------------------
# Player visibility of individual resources
# ---------------------------------------------------------------------------


def panel_visible_to_players(role_visibility: Any) -> bool:
    roles = safe_json_loads(role_visibility, default=["player", "gm"], field_name="role_visibility")
    return isinstance(roles, list) and "player" in roles


# (segment, param) -> (SQL fetching the row, predicate deciding player visibility)
_VISIBILITY: dict[tuple[str, str], tuple[str, Callable[[aiosqlite.Row], bool]]] = {
    ("panels", "panel_id"): (
        "SELECT role_visibility FROM panels WHERE id = ?",
        lambda r: panel_visible_to_players(r["role_visibility"]),
    ),
    ("panels", "widget_id"): (
        "SELECT p.role_visibility FROM widget_instances w JOIN panels p ON p.id = w.panel_id WHERE w.id = ?",
        lambda r: panel_visible_to_players(r["role_visibility"]),
    ),
    ("events", "event_id"): ("SELECT transmitted FROM events WHERE id = ?", lambda r: bool(r["transmitted"])),
    ("sensor-contacts", "sensor_contact_id"): (
        "SELECT visible FROM sensor_contacts WHERE id = ?",
        lambda r: bool(r["visible"]),
    ),
    ("tasks", "task_id"): ("SELECT visible FROM tasks WHERE id = ?", lambda r: bool(r["visible"])),
    ("timers", "timer_id"): (
        "SELECT visible, gm_only FROM timers WHERE id = ?",
        lambda r: bool(r["visible"]) and not r["gm_only"],
    ),
    ("holomap", "layer_id"): ("SELECT visible FROM holomap_layers WHERE id = ?", lambda r: bool(r["visible"])),
    ("holomap", "marker_id"): (
        "SELECT m.visible, l.visible AS layer_visible FROM holomap_markers m"
        " JOIN holomap_layers l ON l.id = m.layer_id WHERE m.id = ?",
        lambda r: bool(r["visible"]) and bool(r["layer_visible"]),
    ),
    ("sector-maps", "obj_id"): (
        "SELECT visibility_state FROM sector_map_objects WHERE id = ?",
        lambda r: r["visibility_state"] in ("visible", "anomaly"),
    ),
}


async def _check_player_visibility(db: aiosqlite.Connection, segment: str, path_params: dict) -> None:
    for (seg, param), (sql, predicate) in _VISIBILITY.items():
        if seg != segment or param not in path_params:
            continue
        cursor = await db.execute(sql, (path_params[param],))
        row = await cursor.fetchone()
        if row is None or not predicate(row):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


# ---------------------------------------------------------------------------
# Player mutation allowlist
# ---------------------------------------------------------------------------


@dataclass
class RuleContext:
    db: aiosqlite.Connection
    request: Request
    body: dict | None

    def param(self, name: str) -> str:
        return self.request.path_params[name]

    async def fetch(self, sql: str, param: str) -> dict:
        cursor = await self.db.execute(sql, (self.param(param),))
        row = await cursor.fetchone()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        return dict(row)


Rule = Callable[[RuleContext], Awaitable[None]]


def _forbid(message: str) -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, message)


def _normalize(value: Any) -> Any:
    """Normalize DB and JSON values so unchanged fields compare equal."""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped[:1] in ("{", "["):
            try:
                return _normalize(json.loads(stripped))
            except json.JSONDecodeError:
                return value
        try:
            return datetime.fromisoformat(value).timestamp()
        except ValueError:
            return value
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {k: _normalize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize(v) for v in value]
    return value


def _body_fields(request: Request, body: dict | None) -> dict:
    """Body keys the endpoint's model actually accepts (others are ignored by the API)."""
    if not body:
        return {}
    route = request.scope.get("route")
    body_field = getattr(route, "body_field", None)
    model_fields = getattr(getattr(body_field, "type_", None), "model_fields", None)
    if model_fields is None:
        return dict(body)
    return {k: v for k, v in body.items() if k in model_fields}


def changed_fields(request: Request, body: dict | None, row: dict, aliases: dict[str, str] | None = None) -> set[str]:
    """Fields in the body whose value differs from the stored row.

    Player edit modals send the whole record back, so unchanged values for
    read-only fields must not count as edits. A field with no matching column is
    always treated as changed.
    """
    aliases = aliases or {}
    changed = set()
    for key, value in _body_fields(request, body).items():
        column = aliases.get(key, key)
        if column not in row or _normalize(row[column]) != _normalize(value):
            changed.add(key)
    return changed


def _deny_fields(disallowed: set[str]) -> None:
    if disallowed:
        raise _forbid(f"Players may not change: {', '.join(sorted(disallowed))}")


def allow() -> Rule:
    async def rule(ctx: RuleContext) -> None:
        return None

    return rule


def fields(table: str, param: str, allowed: set[str], aliases: dict[str, str] | None = None) -> Rule:
    """Allow a PATCH that only changes `allowed` fields of the row `table.id = path[param]`."""

    async def rule(ctx: RuleContext) -> None:
        row = await ctx.fetch(f"SELECT * FROM {table} WHERE id = ?", param)  # noqa: S608 - table is a constant
        _deny_fields(changed_fields(ctx.request, ctx.body, row, aliases) - allowed)

    return rule


# Event data keys a player may change, by event type.
PLAYER_EVENT_DATA_KEYS = {
    "alert": {"acknowledged", "acknowledged_at"},
    "transmission_received": {
        "decrypted",
        "decryption_attempts",
        "decryption_locked",
        "decryption_cooldown_until",
    },
}


async def _event_patch(ctx: RuleContext) -> None:
    """Players may acknowledge alerts, record decryption attempts and clear received transmissions."""
    row = await ctx.fetch("SELECT * FROM events WHERE id = ?", "event_id")
    event_type = row["type"]
    changed = changed_fields(ctx.request, ctx.body, row)
    disallowed = changed - {"data", "transmitted"}

    if "transmitted" in changed and not (event_type == "transmission_received" and ctx.body["transmitted"] is False):
        disallowed.add("transmitted")

    if "data" in changed:
        old = safe_json_loads(row["data"], default={}, field_name="data") or {}
        new = ctx.body.get("data") or {}
        if not isinstance(new, dict):
            disallowed.add("data")
        else:
            allowed_keys = PLAYER_EVENT_DATA_KEYS.get(event_type, set())
            for key in set(old) | set(new):
                if _normalize(old.get(key)) != _normalize(new.get(key)) and key not in allowed_keys:
                    disallowed.add(f"data.{key}")

    _deny_fields(disallowed)


async def _event_delete(ctx: RuleContext) -> None:
    """Players may clear (delete) alerts, nothing else."""
    row = await ctx.fetch("SELECT type FROM events WHERE id = ?", "event_id")
    if row["type"] != "alert":
        raise _forbid("Players may only clear alerts")


async def _waypoint_create(ctx: RuleContext) -> None:
    if (ctx.body or {}).get("created_by") != "player":
        raise _forbid("Players may only create waypoints with created_by='player'")


async def _player_waypoint(ctx: RuleContext) -> None:
    row = await ctx.fetch("SELECT created_by FROM sector_map_waypoints WHERE id = ?", "waypoint_id")
    if row["created_by"] != "player":
        raise _forbid("Players may only change player-created waypoints")


# (method, route path) -> rule. Anything not listed requires GM.
# Derived from what the player-facing UI (widgets, PanelView, layout) actually calls.
PLAYER_RULES: dict[tuple[str, str], Rule] = {
    # Status/value controls on display widgets (dataPermissions.systemStates)
    ("PATCH", "/api/system-states/{state_id}"): fields("system_states", "state_id", {"status", "value"}),
    # Weapon/asset console (dataPermissions.assets + target selector)
    ("PATCH", "/api/assets/{asset_id}"): fields(
        "assets", "asset_id", {"ammo_current", "status", "is_armed", "is_ready", "current_target"}
    ),
    ("POST", "/api/assets/{asset_id}/fire"): allow(),
    # Cargo manifest + bay (dataPermissions.cargo)
    ("POST", "/api/cargo"): allow(),
    ("PATCH", "/api/cargo/{cargo_id}"): fields("cargo", "cargo_id", {"name", "notes"}),
    ("POST", "/api/cargo-placements/validate"): allow(),
    ("POST", "/api/cargo-placements"): allow(),
    ("PATCH", "/api/cargo-placements/{placement_id}"): allow(),
    ("DELETE", "/api/cargo-placements/{placement_id}"): allow(),
    # Contact dossiers (dataPermissions.contacts: create + all fields)
    ("POST", "/api/contacts"): allow(),
    ("PATCH", "/api/contacts/{contact_id}"): allow(),
    # Task queue widget
    ("POST", "/api/tasks"): allow(),
    ("POST", "/api/tasks/{task_id}/claim"): allow(),
    ("POST", "/api/tasks/{task_id}/complete"): allow(),
    # Alerts (acknowledge/clear) and transmissions (decrypt/clear)
    ("PATCH", "/api/events/{event_id}"): _event_patch,
    ("DELETE", "/api/events/{event_id}"): _event_delete,
    # Widgets persist runtime config (pinned contacts, ticks, notes)
    ("PATCH", "/api/panels/widgets/{widget_id}"): fields("widget_instances", "widget_id", {"config"}),
    # Player waypoints on the sector map overlay
    ("POST", "/api/sector-maps/{map_id}/waypoints"): _waypoint_create,
    ("PATCH", "/api/sector-maps/waypoints/{waypoint_id}"): _player_waypoint,
    ("DELETE", "/api/sector-maps/waypoints/{waypoint_id}"): _player_waypoint,
    # Posture display + transmission console hail indicator
    ("PATCH", "/api/ships/{ship_id}/posture"): allow(),
    ("DELETE", "/api/ships/{ship_id}/hail"): allow(),
    # Radar contact detail: threat classification only
    ("PATCH", "/api/sensor-contacts/{sensor_contact_id}"): fields(
        "sensor_contacts", "sensor_contact_id", {"threat_level"}, aliases={"threat_level": "iff"}
    ),
    # Crew status widget: status only
    ("PATCH", "/api/crew/{crew_id}"): fields("crew", "crew_id", {"status"}),
}

# Reads that expose GM-only material (scenario scripts, incidents, exports, GM presets).
GM_ONLY_READS: set[str] = {
    "/api/scenarios",
    "/api/scenarios/{scenario_id}",
    "/api/incidents",
    "/api/incidents/{incident_id}",
    "/api/ships/{ship_id}/export",
    "/api/sector-maps/gm-presets",
}


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------


async def authorize_request(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    db: aiosqlite.Connection = Depends(get_db),
) -> Authz:
    """Authenticate + authorize a domain API request (see module docstring)."""
    if not settings.auth_enabled or _global_role(user) == Role.ADMIN:
        authz = Authz(user=user, role=Role.ADMIN)
        request.state.authz = authz
        return authz

    route = request.scope.get("route")
    path = getattr(route, "path", request.url.path)
    parts = path.split("/")
    segment = parts[2] if len(parts) > 2 else ""
    method = request.method
    body = await _json_body(request)

    ship_ids = await _resolve_ship_ids(db, segment, request, body)
    if ship_ids:
        role = _min_role([await get_ship_role(db, user, sid) for sid in ship_ids])
    else:
        role = _global_role(user)

    authz = Authz(user=user, role=role, ship_ids=ship_ids)
    request.state.authz = authz

    if not authz.is_player:
        return authz

    if not ship_ids:
        # A player listing without naming a ship would see every ship's data.
        declared = {p.name for p in getattr(route, "dependant", None).query_params} if route else set()
        if declared & _ship_scoping_params(segment):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "ship_id is required")

    if method in MUTATING_METHODS:
        rule = PLAYER_RULES.get((method, path))
        if rule is None:
            raise _forbid("This action requires the GM role")
        await _check_player_visibility(db, segment, request.path_params)
        await rule(RuleContext(db=db, request=request, body=body))
    else:
        if path in GM_ONLY_READS:
            raise _forbid("This resource requires the GM role")
        await _check_player_visibility(db, segment, request.path_params)

    return authz


AuthzDep = Annotated[Authz, Depends(authorize_request)]


async def require_gm(authz: AuthzDep) -> Authz:
    """Dependency: caller must be GM or admin on the ship(s) the request touches."""
    if not authz.is_gm:
        raise _forbid("This action requires the GM role")
    return authz
