import json
import logging

logger = logging.getLogger(__name__)


def safe_json_loads(value: str | None, *, default=None, field_name: str = "unknown"):
    """Safely parse a JSON string, returning a default on failure.

    Args:
        value: The JSON string to parse. None and empty string return default.
        default: Value to return if parsing fails. Defaults to empty dict.
        field_name: Name of the field (for logging).
    """
    if default is None:
        default = {}
    if value is None or value == "":
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning("Invalid JSON in field '%s': %s", field_name, e)
        return default
