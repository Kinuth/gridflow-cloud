"""
Deye Cloud API client.

Implements BaseProviderClient for the Deye Cloud OpenAPI v1.0.

Authentication:
    POST /v1.0/account/token?appId=<appId>
    Body: {appSecret, email, password (SHA256 hashed)}
    Returns JWT token in Authorization: bearer <token>

Regional base URLs:
    EU/Africa/Asia-Pacific: https://eu1-developer.deyecloud.com/v1.0
    Americas:               https://us1-developer.deyecloud.com/v1.0
    India:                  https://india-developer.deyecloud.com/v1.0

Reference: https://github.com/DeyeCloudDevelopers/deye-openapi-client-sample-code
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timezone

import requests
from django.conf import settings
from django.utils import timezone as dj_timezone

from integrations.clients.base import (
    AuthenticationError,
    BaseProviderClient,
    ProviderClientError,
    RateLimitError,
)
from integrations.normalizers import (
    NormalizedAlert,
    NormalizedDevice,
    NormalizedStation,
    NormalizedTelemetry,
)

logger = logging.getLogger(__name__)


class DeyeCloudClient(BaseProviderClient):
    """
    Client for the Deye Cloud OpenAPI v1.0.

    Uses platform-wide credentials from Django settings.
    Caches the token in-memory and in the ProviderCredential model.
    """

    def __init__(
        self,
        base_url: str | None = None,
        app_id: str | None = None,
        app_secret: str | None = None,
        email: str | None = None,
        password: str | None = None,
        timeout: int = 30,
    ):
        self.base_url = (base_url or getattr(settings, "DEYE_BASE_URL", "")).rstrip("/")
        self.app_id = app_id or getattr(settings, "DEYE_APP_ID", "")
        self.app_secret = app_secret or getattr(settings, "DEYE_APP_SECRET", "")
        self.email = email or getattr(settings, "DEYE_EMAIL", "")
        self.password = password or getattr(settings, "DEYE_PASSWORD", "")
        self.timeout = timeout

        self._token: str | None = None
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

    # -------------------------------------------------------------------------
    # Authentication
    # -------------------------------------------------------------------------

    def authenticate(self) -> str:
        """Obtain access token from Deye Cloud."""
        if self._token:
            return self._token

        # Also check the DB cache
        self._token = self._load_cached_token()
        if self._token:
            return self._token

        url = f"{self.base_url}/account/token?appId={self.app_id}"

        # Deye requires SHA256-hashed password
        password_hash = hashlib.sha256(self.password.encode("utf-8")).hexdigest()

        payload = {
            "appSecret": self.app_secret,
            "email": self.email,
            "password": password_hash,
        }

        try:
            resp = self._session.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.HTTPError as exc:
            raise AuthenticationError(
                f"Deye auth failed (HTTP {exc.response.status_code}): {exc.response.text}"
            ) from exc
        except requests.exceptions.RequestException as exc:
            raise AuthenticationError(f"Deye auth connection error: {exc}") from exc

        if not data.get("success", True):
            raise AuthenticationError(f"Deye auth API error: {data}")

        token = data.get("data", {}).get("token") or data.get("token")
        if not token:
            raise AuthenticationError(f"No token in Deye auth response: {data}")

        self._token = token
        self._session.headers["Authorization"] = f"bearer {token}"

        # Cache in DB
        self._save_cached_token(token)

        logger.info("Deye Cloud authentication successful.")
        return token

    # -------------------------------------------------------------------------
    # Station / Plant
    # -------------------------------------------------------------------------

    def get_station_list(self, page: int = 1, size: int = 20) -> list[NormalizedStation]:
        """Fetch paginated list of stations."""
        data = self._api_request("/station/list", {"page": page, "size": size})
        stations_raw = data.get("stationList", []) if isinstance(data, dict) else []

        return [
            NormalizedStation(
                station_id=str(s.get("id", "")),
                name=s.get("name", "Unknown"),
                source="DEYE",
                location=s.get("locationAddress", ""),
                capacity_kw=self._safe_float(s, ["installedCapacity", "capacity"]),
                raw_data=s,
            )
            for s in stations_raw
        ]

    # -------------------------------------------------------------------------
    # Device
    # -------------------------------------------------------------------------

    def get_device_list(
        self, station_id: str = "", page: int = 1, size: int = 20
    ) -> list[NormalizedDevice]:
        """Fetch paginated list of devices."""
        payload: dict = {"page": page, "size": size}
        if station_id:
            payload["stationId"] = station_id

        data = self._api_request("/device/list", payload)
        devices_raw = data.get("deviceList", []) if isinstance(data, dict) else []

        return [
            NormalizedDevice(
                device_sn=str(d.get("deviceSn", "")),
                device_name=d.get("deviceName", ""),
                station_id=str(d.get("stationId", "")),
                source="DEYE",
                device_type=d.get("deviceType", ""),
                status="ONLINE" if d.get("connectStatus") == 1 else "OFFLINE",
                raw_data=d,
            )
            for d in devices_raw
        ]

    def get_realtime_data(
        self, device_sn: str, device_id: int | None = None
    ) -> NormalizedTelemetry:
        """Fetch latest data for a single device."""
        results = self.get_realtime_data_batch([device_sn])
        if not results:
            raise ProviderClientError(
                f"No realtime data returned for Deye device {device_sn}"
            )
        return results[0]

    def get_realtime_data_batch(
        self, device_sns: list[str]
    ) -> list[NormalizedTelemetry]:
        """
        Fetch latest data for up to 10 devices in a batch.

        Deye API: POST /device/latest  body: {deviceList: ["sn1", "sn2"]}
        """
        if len(device_sns) > 10:
            # Split into chunks of 10
            results: list[NormalizedTelemetry] = []
            for i in range(0, len(device_sns), 10):
                chunk = device_sns[i : i + 10]
                results.extend(self.get_realtime_data_batch(chunk))
            return results

        data = self._api_request("/device/latest", {"deviceList": device_sns})

        # Response is a list of device data dicts
        devices_data = data if isinstance(data, list) else data.get("deviceList", [data])

        results = []
        for d in devices_data:
            sn = str(d.get("deviceSn", ""))
            data_points = d.get("dataList", [])
            flat = self._flatten_data_points(data_points)
            flat.update(d)  # merge top-level fields

            results.append(self._normalize_telemetry(sn, flat, d))

        return results

    def get_historical_data(
        self,
        device_sn: str,
        start: date,
        end: date,
        granularity: int = 1,
    ) -> list[NormalizedTelemetry]:
        """
        Fetch historical data.

        Deye granularity mapping:
            1 = intra-day raw (startAt format: yyyy-MM-dd)
            2 = daily (startAt/endAt format: yyyy-MM-dd, max 31 days)
            3 = monthly (startAt/endAt format: yyyy-MM, max 12 months)
            4 = yearly (startAt/endAt format: yyyy)
        """
        format_map = {
            1: "%Y-%m-%d",
            2: "%Y-%m-%d",
            3: "%Y-%m",
            4: "%Y",
        }
        fmt = format_map.get(granularity, "%Y-%m-%d")

        payload: dict = {
            "deviceSn": device_sn,
            "granularity": granularity,
            "startAt": start.strftime(fmt),
            "endAt": end.strftime(fmt),
        }

        data = self._api_request("/device/history", payload)

        history_list = data if isinstance(data, list) else data.get("dataList", [])

        results = []
        for entry in history_list:
            ts_str = entry.get("dateTime") or entry.get("date") or entry.get("time")
            try:
                ts = datetime.fromisoformat(ts_str) if ts_str else dj_timezone.now()
            except (ValueError, TypeError):
                ts = dj_timezone.now()

            flat = self._flatten_data_points(entry.get("dataList", []))
            flat.update(entry)

            results.append(self._normalize_telemetry(device_sn, flat, entry, ts))

        return results

    def get_alerts(
        self,
        station_id: str,
        start: date,
        end: date,
        page: int = 1,
        size: int = 100,
    ) -> list[NormalizedAlert]:
        """Fetch alerts for a station. Deye alert endpoint varies by portal version."""
        payload = {
            "stationId": station_id,
            "startTime": start.strftime("%Y-%m-%d"),
            "endTime": end.strftime("%Y-%m-%d"),
            "page": page,
            "size": size,
        }

        try:
            data = self._api_request("/station/alert", payload)
        except ProviderClientError:
            logger.warning("Deye alert endpoint not available, returning empty list.")
            return []

        alert_list = data if isinstance(data, list) else data.get("alertList", [])

        results = []
        for a in alert_list:
            occurred_str = a.get("alertTime") or a.get("createTime", "")
            try:
                occurred = datetime.fromisoformat(occurred_str) if occurred_str else dj_timezone.now()
            except (ValueError, TypeError):
                occurred = dj_timezone.now()

            results.append(
                NormalizedAlert(
                    device_sn=str(a.get("deviceSn", "")),
                    source="DEYE",
                    alert_code=str(a.get("alertCode", a.get("errorCode", ""))),
                    alert_name=a.get("alertName", a.get("errorMsg", "Unknown Alert")),
                    severity=self._map_severity(a.get("alertLevel", 2)),
                    occurred_at=occurred,
                    is_active=not a.get("resolved", False),
                    raw_data=a,
                )
            )

        return results

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    def _api_request(self, endpoint: str, payload: dict) -> dict | list:
        """Make an authenticated POST request to the Deye API."""
        self.authenticate()

        url = f"{self.base_url}{endpoint}"

        try:
            resp = self._session.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            result = resp.json()
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code
            body = exc.response.text
            if status == 429:
                raise RateLimitError(f"Deye rate limit hit: {body}") from exc
            if status == 401:
                # Token expired, clear cache and retry once
                self._token = None
                self._clear_cached_token()
                raise AuthenticationError(f"Deye token expired: {body}") from exc
            raise ProviderClientError(f"Deye API error {status}: {body}") from exc
        except requests.exceptions.RequestException as exc:
            raise ProviderClientError(f"Deye connection error: {exc}") from exc

        if isinstance(result, dict) and result.get("success") is False:
            msg = result.get("msg", result.get("message", "Unknown error"))
            raise ProviderClientError(f"Deye API failure: {msg} — {result}")

        # Most Deye endpoints wrap data in a "data" key
        if isinstance(result, dict) and "data" in result:
            return result["data"]

        return result

    def _normalize_telemetry(
        self,
        device_sn: str,
        flat: dict,
        raw: dict,
        timestamp: datetime | None = None,
    ) -> NormalizedTelemetry:
        """Normalize Deye response fields to NormalizedTelemetry."""
        return NormalizedTelemetry(
            device_sn=device_sn,
            timestamp=timestamp or dj_timezone.now(),
            source="DEYE",
            power_w=self._safe_float(flat, ["GenPower", "pac", "outputPower", "power", "activePower"]),
            energy_today_kwh=self._safe_float(flat, ["eToday", "todayEnergy", "energyToday", "Daily Generation"]),
            energy_total_kwh=self._safe_float(flat, ["eTotal", "totalEnergy", "energyTotal", "Cumulative Generation"]),
            battery_soc=self._safe_float(flat, ["SOC", "batterySOC", "batterySoc", "soc"]),
            battery_power_w=self._safe_float(flat, ["batteryPower", "BatPower", "batPower"]),
            grid_power_w=self._safe_float(flat, ["gridPower", "GridPower", "TotalGridPower"]),
            load_power_w=self._safe_float(flat, ["loadPower", "LoadPower", "consumptionPower"]),
            pv1_power_w=self._safe_float(flat, ["pv1Power", "PV1Power", "PV1 Power"]),
            pv2_power_w=self._safe_float(flat, ["pv2Power", "PV2Power", "PV2 Power"]),
            pv_total_power_w=self._safe_float(flat, ["pvPower", "solarPower", "TotalPVPower"]),
            voltage_ac=self._safe_float(flat, ["gridVoltage", "acVoltage", "vac", "Grid Voltage"]),
            frequency_hz=self._safe_float(flat, ["gridFrequency", "frequency", "fac", "Grid Frequency"]),
            temperature_c=self._safe_float(flat, ["temperature", "inverterTemperature", "Temperature"]),
            raw_response=raw,
        )

    @staticmethod
    def _flatten_data_points(data_list: list) -> dict:
        """
        Deye returns data as a list of {key, value, unit, name} dicts.
        Flatten them into a simple {key: value} dict for easier normalization.
        """
        flat: dict = {}
        for item in data_list:
            key = item.get("key") or item.get("name", "")
            value = item.get("value")
            if key and value is not None:
                flat[key] = value
        return flat

    @staticmethod
    def _map_severity(level: int | str) -> str:
        """Map Deye alert level to our severity enum."""
        try:
            level_int = int(level)
        except (TypeError, ValueError):
            return "WARNING"

        if level_int >= 3:
            return "CRITICAL"
        elif level_int >= 2:
            return "WARNING"
        return "INFO"

    # -------------------------------------------------------------------------
    # Token caching (DB-backed)
    # -------------------------------------------------------------------------

    @staticmethod
    def _load_cached_token() -> str | None:
        """Load token from DB if still valid."""
        from integrations.models import ProviderCredential

        try:
            cred = ProviderCredential.objects.get(provider="DEYE", is_active=True)
        except ProviderCredential.DoesNotExist:
            return None

        if cred.cached_token and cred.token_expires_at and cred.token_expires_at > dj_timezone.now():
            return cred.cached_token
        return None

    @staticmethod
    def _save_cached_token(token: str) -> None:
        """Save token to DB cache."""
        from integrations.models import ProviderCredential
        from datetime import timedelta

        ProviderCredential.objects.update_or_create(
            provider="DEYE",
            defaults={
                "base_url": getattr(settings, "DEYE_BASE_URL", ""),
                "cached_token": token,
                "token_expires_at": dj_timezone.now() + timedelta(minutes=50),
                "last_used_at": dj_timezone.now(),
                "is_active": True,
            },
        )

    @staticmethod
    def _clear_cached_token() -> None:
        """Clear cached token on auth failure."""
        from integrations.models import ProviderCredential

        ProviderCredential.objects.filter(provider="DEYE").update(
            cached_token="", token_expires_at=None
        )
