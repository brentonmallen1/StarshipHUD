import pytest
from app. utils import safe_json_loads

# tests to cover the utils.py functionality
@pytest.fixture
def safe_json_string():
    return '{"key": "value"}'

@pytest.fixture
def invalid_json_string():
    return '{"key": "value"'

def test_safe_json_loads_valid(safe_json_string):
    result = safe_json_loads(safe_json_string)
    assert result == {"key": "value"}
    
def test_safe_json_loads_invalid(invalid_json_string):
    result = safe_json_loads(invalid_json_string, default={"default": "value"}, field_name="test_field")
    assert result == {"default": "value"}

def test_safe_json_loads_none():
    result = safe_json_loads(None)
    assert result == {}

def test_safe_json_loads_default():
    result = safe_json_loads(None, default={"default": "value"}, field_name="test_field")
    assert result == {"default": "value"}
