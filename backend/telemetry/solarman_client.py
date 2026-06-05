"""
Backward-compatibility shim.

The SolarmanClient has been moved to integrations.clients.solarman.
This module re-exports it so existing code continues to work.
"""

from integrations.clients.solarman import SolarmanClient
from integrations.clients.base import ProviderClientError as SolarmanClientError

__all__ = ["SolarmanClient", "SolarmanClientError"]
