"""
Abstract base class for solar API provider clients.

All provider clients (Deye, Solarman) must implement this interface
so the rest of the system can work provider-agnostically.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import date

from integrations.normalizers import (
    NormalizedAlert,
    NormalizedDevice,
    NormalizedStation,
    NormalizedTelemetry,
)

logger = logging.getLogger(__name__)


class ProviderClientError(Exception):
    """Base exception for all provider client errors."""
    pass


class AuthenticationError(ProviderClientError):
    """Raised when authentication with the provider fails."""
    pass


class RateLimitError(ProviderClientError):
    """Raised when the provider returns a rate limit error."""
    pass


class BaseProviderClient(ABC):
    """
    Abstract interface that every solar API provider must implement.

    Implementations handle:
    - Authentication & token management
    - API request construction & signing
    - Response parsing & normalization
    - Error handling & retries
    """

    @abstractmethod
    def authenticate(self) -> str:
        """
        Obtain or refresh an access token from the provider.

        Returns:
            The access token string.

        Raises:
            AuthenticationError: If authentication fails.
        """
        ...

    @abstractmethod
    def get_station_list(self, page: int = 1, size: int = 20) -> list[NormalizedStation]:
        """
        Retrieve the list of power stations/plants.

        Returns:
            List of normalized station objects.
        """
        ...

    @abstractmethod
    def get_device_list(
        self, station_id: str = "", page: int = 1, size: int = 20
    ) -> list[NormalizedDevice]:
        """
        Retrieve the list of devices, optionally filtered by station.

        Returns:
            List of normalized device objects.
        """
        ...

    @abstractmethod
    def get_realtime_data(
        self, device_sn: str, device_id: int | None = None
    ) -> NormalizedTelemetry:
        """
        Fetch the latest real-time data for a single device.

        Returns:
            A normalized telemetry snapshot.
        """
        ...

    @abstractmethod
    def get_realtime_data_batch(
        self, device_sns: list[str]
    ) -> list[NormalizedTelemetry]:
        """
        Fetch latest data for multiple devices in a single call (if supported).

        Fall back to calling get_realtime_data() in a loop if the provider
        does not support batch queries.

        Returns:
            List of normalized telemetry snapshots.
        """
        ...

    @abstractmethod
    def get_historical_data(
        self,
        device_sn: str,
        start: date,
        end: date,
        granularity: int = 1,
    ) -> list[NormalizedTelemetry]:
        """
        Fetch historical data for a device.

        Granularity levels (provider-specific mapping):
            1 = Raw / frame-level (intra-day)
            2 = Daily aggregates
            3 = Monthly aggregates
            4 = Yearly aggregates

        Returns:
            List of normalized telemetry snapshots.
        """
        ...

    @abstractmethod
    def get_alerts(
        self,
        station_id: str,
        start: date,
        end: date,
        page: int = 1,
        size: int = 100,
    ) -> list[NormalizedAlert]:
        """
        Fetch alerts/alarms for a station within a date range.

        Returns:
            List of normalized alert objects.
        """
        ...

    def _safe_float(self, data: dict, keys: list[str]) -> float | None:
        """
        Extract a float value from a dict, trying multiple possible key names.

        Used for response normalization where field names vary between providers
        and even between endpoints of the same provider.
        """
        for key in keys:
            value = data.get(key)
            if value is None:
                continue
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
        return None

    def _safe_str(self, data: dict, keys: list[str], default: str = "") -> str:
        """Extract a string value trying multiple key names."""
        for key in keys:
            value = data.get(key)
            if value is not None:
                return str(value)
        return default
