"""
Normalized data types shared across all provider clients.

Every provider client must map its raw API response into these dataclasses
so that the rest of the system (tasks, views, serializers) works identically
regardless of whether the data came from Deye Cloud or Solarman.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class NormalizedTelemetry:
    """A single normalized telemetry snapshot from any provider."""

    device_sn: str
    timestamp: datetime
    source: str  # "DEYE" | "SOLARMAN"

    # Core power metrics
    power_w: float | None = None
    energy_today_kwh: float | None = None
    energy_total_kwh: float | None = None

    # Battery
    battery_soc: float | None = None
    battery_power_w: float | None = None

    # Grid
    grid_power_w: float | None = None

    # Load
    load_power_w: float | None = None

    # PV strings
    pv1_power_w: float | None = None
    pv2_power_w: float | None = None
    pv_total_power_w: float | None = None

    # Electrical
    voltage_ac: float | None = None
    frequency_hz: float | None = None
    temperature_c: float | None = None

    # Raw response for debugging
    raw_response: dict = field(default_factory=dict)


@dataclass
class NormalizedAlert:
    """A single normalized alert from any provider."""

    device_sn: str
    source: str  # "DEYE" | "SOLARMAN"
    alert_code: str
    alert_name: str
    severity: str  # "INFO" | "WARNING" | "CRITICAL"
    occurred_at: datetime
    resolved_at: datetime | None = None
    is_active: bool = True
    raw_data: dict = field(default_factory=dict)


@dataclass
class NormalizedStation:
    """A station/plant from any provider."""

    station_id: str
    name: str
    source: str  # "DEYE" | "SOLARMAN"
    location: str = ""
    capacity_kw: float | None = None
    raw_data: dict = field(default_factory=dict)


@dataclass
class NormalizedDevice:
    """A device from any provider's device list."""

    device_sn: str
    device_name: str
    station_id: str
    source: str  # "DEYE" | "SOLARMAN"
    device_type: str = ""
    status: str = ""
    raw_data: dict = field(default_factory=dict)
