"""
System state models.
"""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from .base import BaseSchema, SystemStatus, UpdateSchema

# Valid status keys for thresholds (ordered from best to worst for validation)
THRESHOLD_STATUS_ORDER = ["optimal", "operational", "degraded", "compromised", "critical", "destroyed"]


def validate_thresholds(thresholds: dict[str, int] | None, max_value: float | None = None) -> None:
    """
    Validate custom status thresholds (status -> minimum value).

    Keys must be known statuses and values non-negative integers in descending
    order from optimal to destroyed. When ``max_value`` is given, no threshold
    may exceed it. Raises ValueError (surfaced as a 422 from validators).
    """
    if thresholds is None:
        return

    for key in thresholds:
        if key not in THRESHOLD_STATUS_ORDER:
            raise ValueError(f"Invalid status key in thresholds: {key}. Must be one of {THRESHOLD_STATUS_ORDER}")

    for key, val in thresholds.items():
        if not isinstance(val, int) or val < 0:
            raise ValueError(f"Threshold value for '{key}' must be a non-negative integer, got {val}")

    # optimal should be highest, destroyed lowest
    present_statuses = [s for s in THRESHOLD_STATUS_ORDER if s in thresholds]
    for curr_status, next_status in zip(present_statuses, present_statuses[1:]):
        if thresholds[curr_status] < thresholds[next_status]:
            raise ValueError(
                f"Threshold values must be in descending order: {curr_status}={thresholds[curr_status]} "
                f"should be >= {next_status}={thresholds[next_status]}"
            )

    if max_value is not None:
        for key in present_statuses:
            if thresholds[key] > max_value:
                raise ValueError(f"Threshold for '{key}' ({thresholds[key]}) cannot exceed max_value ({max_value})")


class SystemStateBase(BaseModel):
    """Base system state fields."""

    name: str = Field(min_length=1)
    status: SystemStatus = SystemStatus.OPERATIONAL
    value: float = 100
    max_value: float = Field(default=100, gt=0)
    unit: str = "%"
    category: str | None = None
    category_id: str | None = None
    depends_on: list[str] = Field(default_factory=list)
    status_thresholds: dict[str, int] | None = Field(
        default=None,
        description=(
            "Custom status thresholds mapping status → min_value. "
            "When set, status is determined by value >= threshold instead of percentage."
        ),
    )

    @model_validator(mode="after")
    def validate_status_thresholds(self):
        """Validate threshold keys and ordering."""
        validate_thresholds(self.status_thresholds)
        return self

    @model_validator(mode="after")
    def validate_value_within_max(self):
        """Ensure value does not exceed max_value."""
        if self.value > self.max_value:
            raise ValueError(f"value ({self.value}) cannot exceed max_value ({self.max_value})")
        return self


class SystemStateCreate(SystemStateBase):
    """Schema for creating a system state."""

    id: str  # Allow custom ID for seed data
    ship_id: str

    @model_validator(mode="after")
    def validate_thresholds_within_max(self):
        """Thresholds above max_value describe statuses the system can never reach."""
        validate_thresholds(self.status_thresholds, self.max_value)
        return self


class SystemStateUpdate(UpdateSchema, table="system_states"):
    """Schema for updating a system state."""

    name: str | None = None
    status: SystemStatus | None = None
    value: float | None = None
    max_value: float | None = Field(None, gt=0)
    unit: str | None = None
    category: str | None = None
    category_id: str | None = None
    depends_on: list[str] | None = None
    status_thresholds: dict[str, int] | None = None

    @model_validator(mode="after")
    def validate_status_thresholds(self):
        """Validate threshold keys and ordering, and bounds when max_value is in the same body.

        When only one of the two is sent, the PATCH handler checks against the
        stored value.
        """
        validate_thresholds(self.status_thresholds, self.max_value)
        return self


class LimitingParent(BaseModel):
    """Info about a parent system that is limiting a child's effective status."""

    id: str
    name: str
    effective_status: str


class SystemState(SystemStateBase, BaseSchema):
    """Full system state schema."""

    id: str
    ship_id: str
    created_at: datetime
    updated_at: datetime
    effective_status: SystemStatus | None = None  # Computed: status capped by parent dependencies
    limiting_parent: LimitingParent | None = None  # Parent system causing the status cap (if any)


# Bulk Reset Models


class SystemResetSpec(BaseModel):
    """Specification for resetting a single system."""

    system_id: str
    target_status: str | None = "operational"
    target_value: float | None = None  # If None, calculate from status


class BulkResetRequest(BaseModel):
    """Request for bulk resetting systems."""

    ship_id: str
    reset_all: bool = False  # If true, reset all systems for this ship
    systems: list[SystemResetSpec] = Field(default_factory=list)  # Specific systems to reset
    emit_event: bool = True  # Emit "all clear" event


class BulkResetResult(BaseModel):
    """Result of bulk reset operation."""

    systems_reset: int
    event_id: str | None = None
    errors: list[str] = Field(default_factory=list)
