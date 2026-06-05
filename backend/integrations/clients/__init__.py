"""
Provider client factory.

Returns the appropriate provider client based on the data source string.
"""

from __future__ import annotations

from integrations.clients.base import BaseProviderClient, ProviderClientError
from integrations.clients.deye import DeyeCloudClient
from integrations.clients.solarman import SolarmanClient


def get_client(data_source: str) -> BaseProviderClient:
    """
    Factory that returns the correct provider client for the given source.

    Args:
        data_source: "DEYE" or "SOLARMAN"

    Returns:
        An initialized provider client using platform-wide credentials.

    Raises:
        ProviderClientError: If the data source is unknown.
    """
    if data_source == "DEYE":
        return DeyeCloudClient()
    elif data_source == "SOLARMAN":
        return SolarmanClient()
    else:
        raise ProviderClientError(f"Unknown data source: {data_source}")


__all__ = [
    "get_client",
    "BaseProviderClient",
    "ProviderClientError",
    "DeyeCloudClient",
    "SolarmanClient",
]
