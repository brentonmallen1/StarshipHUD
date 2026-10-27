"""PATCH bodies must reject explicit null for NOT NULL columns (422, not 500)."""

import pytest

from app.models.base import UpdateSchema, not_null_columns


def _all_update_models():
    seen, stack = [], list(UpdateSchema.__subclasses__())
    while stack:
        cls = stack.pop()
        seen.append(cls)
        stack.extend(cls.__subclasses__())
    return seen


def _import_all_models():
    import importlib
    import pkgutil

    import app.models as pkg

    for mod in pkgutil.iter_modules(pkg.__path__):
        importlib.import_module(f"app.models.{mod.name}")


_import_all_models()
UPDATE_MODELS = _all_update_models()


def test_update_models_are_registered():
    names = {m.__name__ for m in UPDATE_MODELS}
    for expected in ("SystemStateUpdate", "ShipUpdate", "PanelUpdate", "ScenarioUpdate", "WidgetInstanceUpdate"):
        assert expected in names


@pytest.mark.parametrize("model", UPDATE_MODELS, ids=lambda m: m.__name__)
def test_every_not_null_field_rejects_explicit_null(model):
    table = model.__db_table__
    assert table, f"{model.__name__} has no table declared"
    required = not_null_columns(table)
    aliases = model.__db_column_aliases__
    checked = 0
    for name in model.model_fields:
        column = aliases.get(name, name)
        if column not in required:
            continue
        with pytest.raises(ValueError, match="cannot be null"):
            model.model_validate({name: None})
        checked += 1
    # Omitting everything is always fine
    model.model_validate({})
    assert checked or not required & set(model.model_fields)


def test_nullable_columns_still_accept_null():
    from app.models.panel import PanelUpdate
    from app.models.system_state import SystemStateUpdate

    assert PanelUpdate.model_validate({"description": None}).description is None
    assert SystemStateUpdate.model_validate({"status_thresholds": None}).status_thresholds is None
    assert SystemStateUpdate.model_validate({"category_id": None}).category_id is None


async def _system(client, ship_id):
    resp = await client.post(
        "/api/system-states",
        json={"id": "sys-1", "ship_id": ship_id, "name": "Reactor", "value": 80, "max_value": 100},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestPatchNulls:
    @pytest.mark.parametrize("field", ["name", "max_value", "status", "value"])
    async def test_system_state(self, client, ship, field):
        system = await _system(client, ship["id"])
        resp = await client.patch(f"/api/system-states/{system['id']}", json={field: None})
        assert resp.status_code == 422, resp.text
        assert field in resp.text

    async def test_system_state_nullable_fields(self, client, ship):
        system = await _system(client, ship["id"])
        resp = await client.patch(
            f"/api/system-states/{system['id']}", json={"category_id": None, "status_thresholds": None}
        )
        assert resp.status_code == 200, resp.text

    @pytest.mark.parametrize("field", ["name", "attributes"])
    async def test_ship(self, client, ship, field):
        resp = await client.patch(f"/api/ships/{ship['id']}", json={field: None})
        assert resp.status_code == 422, resp.text

    @pytest.mark.parametrize("field", ["name", "station_group", "role_visibility", "grid_columns"])
    async def test_panel(self, client, ship, field):
        resp = await client.post(
            "/api/panels", json={"ship_id": ship["id"], "name": "Bridge", "station_group": "command"}
        )
        assert resp.status_code == 200, resp.text
        resp = await client.patch(f"/api/panels/{resp.json()['id']}", json={field: None})
        assert resp.status_code == 422, resp.text

    @pytest.mark.parametrize("field", ["name", "actions"])
    async def test_scenario(self, client, ship, field):
        resp = await client.post("/api/scenarios", json={"ship_id": ship["id"], "name": "Red Alert", "actions": []})
        assert resp.status_code == 200, resp.text
        scenario_id = resp.json()["id"]
        resp = await client.patch(f"/api/scenarios/{scenario_id}", json={field: None})
        assert resp.status_code == 422, resp.text
        resp = await client.patch(f"/api/scenarios/{scenario_id}", json={"description": None})
        assert resp.status_code == 200, resp.text
