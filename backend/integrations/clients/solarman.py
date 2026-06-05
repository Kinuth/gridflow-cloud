"""
Solarman Cloud API client.

Implements BaseProviderClient for the Solarman OpenAPI v1.0.

Authentication:
    POST /account/v1.0/token
    Body: {appId, appSecret} or with HMAC signing
    Returns access_token / token in response body

Base URL: https://globalapi.solarmanpv.com

Auth header for subsequent calls:
    - Authorization: bearer <token>
    - X-App-Id: <app_id>
    - X-Time: <timestamp_ms>
    - X-Sign: HMAC-SHA256 signature
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import time
from datetime import date, datetime, timedelta, timezone

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

SHA256_HEX_RE = re.compile(r"^[a-fA-F0-9]{64}$")


class SolarmanClient(BaseProviderClient):
    """
    Client for the Solarman OpenAPI v1.0.

    Uses platform-wide credentials from Django settings.
    Requests are HMAC-signed per Solarman specification.
    """

    def __init__(
        self,
        base_url: str | None = None,
        app_id: str | None = None,
        app_secret: str | None = None,
        email: str | None = None,
        password_hash: str | None = None,
        password: str | None = None,
        timeout: int = 30,
    ):
        self.base_url = (base_url or getattr(settings, "SOLARMAN_BASE_URL", "")).strip().rstrip("/")
        self.app_id = (app_id or getattr(settings, "SOLARMAN_APP_ID", "")).strip()
        self.app_secret = (app_secret or getattr(settings, "SOLARMAN_APP_SECRET", "")).strip()
        self.email = (email or getattr(settings, "SOLARMAN_EMAIL", "")).strip()
        self.password = (password or getattr(settings, "SOLARMAN_PASSWORD", "")).strip()
        self.language = getattr(settings, "SOLARMAN_LANGUAGE", "en").strip() or "en"
        raw_password_hash = (
            password_hash
            or getattr(settings, "SOLARMAN_PASSWORD_HASH", "")
            or self.password
        )
        self.password_hash = raw_password_hash.strip().lower()
        self.timeout = timeout

        self._token: str | None = None
        self._token_expiry: float = 0
        self._session = requests.Session()

    # -------------------------------------------------------------------------
    # Authentication
    # -------------------------------------------------------------------------

    @staticmethod
    def _hash_password(password: str) -> str:
        """Hash password using SHA256."""
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    def authenticate(self) -> str:
        """Obtain or refresh access token from Solarman."""
        now = time.time()
        if self._token and now < self._token_expiry:
            return self._token

        # Check DB cache
        self._token = self._load_cached_token()
        if self._token:
            return self._token

        missing = []
        if not self.app_id:
            missing.append("SOLARMAN_APP_ID")
        if not self.app_secret:
            missing.append("SOLARMAN_APP_SECRET")
        if not self.email:
            missing.append("SOLARMAN_EMAIL")
        if not self.password_hash:
            missing.append("SOLARMAN_PASSWORD_HASH")
        elif not SHA256_HEX_RE.fullmatch(self.password_hash):
            raise AuthenticationError(
                "Solarman auth failed: SOLARMAN_PASSWORD_HASH must be a 64-character SHA256 hex string."
            )
        if missing:
            raise AuthenticationError(
                f"Solarman auth failed: missing required settings: {', '.join(missing)}"
            )

        auth_error_messages: list[str] = []
        resp: dict | None = None
        for endpoint, payload, label in self._auth_attempt_variants():
            try:
                resp = self._raw_request("POST", endpoint, payload, authenticated=False)
                token = resp.get("access_token") or resp.get("token")
                if token:
                    break
                auth_error_messages.append(f"{label}: token missing")
            except ProviderClientError as exc:
                msg = str(exc)
                auth_error_messages.append(f"{label}: {msg}")
                if self._is_app_locked_error(msg):
                    raise AuthenticationError(
                        "Solarman app is locked by provider (appId or API locked). "
                        "Please unlock or re-enable the app in Solarman OpenAPI console "
                        "and confirm API permissions are active."
                    ) from exc
                # Keep trying known auth variants when provider rejects parameters.
                if "invalid param" in msg.lower():
                    continue
                raise AuthenticationError(f"Solarman auth failed: {exc}") from exc

        if not resp:
            raise AuthenticationError(
                "Solarman auth failed: all token request variants were rejected. "
                f"Last errors: {' | '.join(auth_error_messages[-3:])}"
            )

        token = resp.get("access_token") or resp.get("token")
        expires_in = int(resp.get("expires_in", 3600))

        if not token:
            raise AuthenticationError(
                "No token in Solarman auth response after trying known request variants. "
                f"Last errors: {' | '.join(auth_error_messages[-3:])}"
            )

        self._token = str(token)
        self._token_expiry = time.time() + max(expires_in - 60, 60)

        self._save_cached_token(self._token, expires_in)

        logger.info("Solarman authentication successful.")
        return self._token

    def _auth_attempt_variants(self) -> list[tuple[str, dict, str]]:
        """Return token request variants used across Solarman deployments."""
        password_candidates = self._password_candidates()
        variants: list[tuple[str, dict, str]] = []

        for pwd in password_candidates:
            variants.append(
                (
                    "/account/v1.0/token",
                    {
                        "appId": self.app_id,
                        "appSecret": self.app_secret,
                        "email": self.email,
                        "password": pwd,
                    },
                    "body_appId_appSecret",
                )
            )
            variants.append(
                (
                    f"/account/v1.0/token?appId={self.app_id}",
                    {
                        "appSecret": self.app_secret,
                        "email": self.email,
                        "password": pwd,
                    },
                    "query_appId_appSecret",
                )
            )
            variants.append(
                (
                    f"/account/v1.0/token?appId={self.app_id}",
                    {
                        "email": self.email,
                        "password": pwd,
                    },
                    "query_appId_noAppSecret",
                )
            )

        return variants

    def _password_candidates(self) -> list[str]:
        """Generate auth password candidates without leaking credential values."""
        if not self.password_hash:
            return [""]

        # Always send the pre-hashed value from environment/config.
        return [self.password_hash]

    @staticmethod
    def _is_app_locked_error(message: str) -> bool:
        msg = message.lower()
        return "appid or api is locked" in msg or ("locked" in msg and "appid" in msg)

    # -------------------------------------------------------------------------
    # Station / Plant
    # -------------------------------------------------------------------------

    def get_station_list(self, page: int = 1, size: int = 20) -> list[NormalizedStation]:
        """Fetch list of plants/stations."""
        data = self._api_request("/station/v1.0/list", {"page": page, "size": size})

        stations_raw = data if isinstance(data, list) else data.get("stationList", [])

        return [
            NormalizedStation(
                station_id=str(s.get("id", s.get("stationId", ""))),
                name=s.get("name", s.get("stationName", "Unknown")),
                source="SOLARMAN",
                location=s.get("location", s.get("locationAddress", "")),
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
        """Fetch list of devices, optionally filtered by station."""
        payload: dict = {"page": page, "size": size}
        if station_id:
            payload["stationId"] = int(station_id)

        data = self._api_request("/station/v1.0/device", payload)

        devices_raw = data if isinstance(data, list) else data.get("deviceListItems", [])

        return [
            NormalizedDevice(
                device_sn=str(d.get("deviceSn", "")),
                device_name=d.get("deviceName", d.get("deviceType", "")),
                station_id=str(d.get("stationId", station_id)),
                source="SOLARMAN",
                device_type=d.get("deviceType", ""),
                status="ONLINE" if d.get("connectStatus") == 1 else "OFFLINE",
                raw_data=d,
            )
            for d in devices_raw
        ]

    def get_realtime_data(
        self, device_sn: str, device_id: int | None = None
    ) -> NormalizedTelemetry:
        """Fetch latest real-time data for a single device."""
        payload: dict = {"deviceSn": device_sn}
        if device_id is not None:
            payload["deviceId"] = device_id

        data = self._api_request(
            "/device/v1.0/currentData",
            payload,
            query_params={"language": self.language},
        )

        flat = self._flatten_data_list(data.get("dataList", []) if isinstance(data, dict) else [])
        flat.update(data if isinstance(data, dict) else {})

        timestamp = self._parse_collection_time(data.get("collectionTime") if isinstance(data, dict) else None)
        return self._normalize_telemetry(device_sn, flat, data, timestamp)

    def get_realtime_data_batch(
        self, device_sns: list[str]
    ) -> list[NormalizedTelemetry]:
        """
        Solarman does not support native batch queries.
        Calls get_realtime_data() for each device.
        """
        results: list[NormalizedTelemetry] = []
        for sn in device_sns:
            try:
                results.append(self.get_realtime_data(sn))
            except ProviderClientError as exc:
                logger.error(f"Failed to get realtime data for Solarman device {sn}: {exc}")
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

        Solarman timeType mapping:
            1 = Frame (intra-day, start/end as epoch timestamps)
            2 = Day (start/end as yyyy-MM-dd)
            3 = Month (start/end as yyyy-MM)
            4 = Year (start/end as yyyy)
        """
        format_map = {
            1: lambda d: str(int(datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc).timestamp())),
            2: lambda d: d.strftime("%Y-%m-%d"),
            3: lambda d: d.strftime("%Y-%m"),
            4: lambda d: d.strftime("%Y"),
        }
        fmt_fn = format_map.get(granularity, format_map[2])

        payload = {
            "deviceSn": device_sn,
            "timeType": granularity,
            "startTime": fmt_fn(start),
            "endTime": fmt_fn(end),
        }

        data = self._api_request("/device/v1.0/historical", payload)

        history_list = data if isinstance(data, list) else data.get("paramDataList", [])

        results = []
        for entry in history_list:
            ts_str = entry.get("collectTime") or entry.get("dateTime") or entry.get("time")
            try:
                ts = datetime.fromisoformat(ts_str) if ts_str else dj_timezone.now()
            except (ValueError, TypeError):
                try:
                    ts = datetime.fromtimestamp(int(ts_str), tz=timezone.utc)
                except (ValueError, TypeError, OSError):
                    ts = dj_timezone.now()

            flat = self._flatten_data_list(entry.get("dataList", []))
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
        """Fetch alerts for a station within a date range."""
        payload = {
            "stationId": int(station_id),
            "startTime": start.strftime("%Y-%m-%d"),
            "endTime": end.strftime("%Y-%m-%d"),
            "page": page,
            "size": size,
        }

        try:
            data = self._api_request("/station/v1.0/alert", payload)
        except ProviderClientError:
            logger.warning("Solarman alert endpoint not available, returning empty.")
            return []

        alert_list = data if isinstance(data, list) else data.get("stationAlertItems", [])

        results = []
        for a in alert_list:
            ts_str = a.get("alertTime") or a.get("createAt", "")
            try:
                occurred = datetime.fromisoformat(ts_str) if ts_str else dj_timezone.now()
            except (ValueError, TypeError):
                occurred = dj_timezone.now()

            results.append(
                NormalizedAlert(
                    device_sn=str(a.get("deviceSn", "")),
                    source="SOLARMAN",
                    alert_code=str(a.get("alertCode", a.get("errorCode", ""))),
                    alert_name=a.get("alertName", a.get("alertNamee", "Unknown Alert")),
                    severity=self._map_severity(a.get("alertLevel", 2)),
                    occurred_at=occurred,
                    resolved_at=None,
                    is_active=True,
                    raw_data=a,
                )
            )

        return results

    # -------------------------------------------------------------------------
    # Internal — API request infrastructure
    # -------------------------------------------------------------------------

    def _api_request(
        self,
        endpoint: str,
        payload: dict,
        query_params: dict | None = None,
    ) -> dict:
        """Make an authenticated, HMAC-signed request to Solarman."""
        self.authenticate()
        return self._raw_request(
            "POST",
            endpoint,
            payload,
            authenticated=True,
            query_params=query_params,
        )

    def _raw_request(
        self,
        method: str,
        endpoint: str,
        payload: dict,
        authenticated: bool = True,
        query_params: dict | None = None,
    ) -> dict:
        """Low-level HTTP request with HMAC signing."""
        url = f"{self.base_url}{endpoint}"
        timestamp_ms = str(int(time.time() * 1000))
        body_bytes = json.dumps(payload).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "X-App-Id": self.app_id,
            "X-Time": timestamp_ms,
        }

        if authenticated and self._token:
            headers["Authorization"] = f"bearer {self._token}"

        # HMAC-SHA256 signature
        headers["X-Sign"] = self._build_signature(
            self.app_secret, timestamp_ms, body_bytes
        )

        try:
            resp = self._session.request(
                method,
                url,
                params=query_params,
                data=body_bytes,
                headers=headers,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            result = resp.json()
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code
            body = exc.response.text
            if status == 429:
                raise RateLimitError(f"Solarman rate limit: {body}") from exc
            if status == 401:
                self._token = None
                self._clear_cached_token()
                raise AuthenticationError(f"Solarman token expired: {body}") from exc
            raise ProviderClientError(f"Solarman HTTP {status}: {body}") from exc
        except requests.exceptions.RequestException as exc:
            raise ProviderClientError(f"Solarman connection error: {exc}") from exc

        if isinstance(result, dict) and result.get("success") is False:
            msg = result.get("msg", result.get("message", "Unknown error"))
            raise ProviderClientError(f"Solarman API failure: {msg}")

        # Unwrap data envelope
        if isinstance(result, dict) and "data" in result and isinstance(result["data"], dict):
            return result["data"]

        return result

    # -------------------------------------------------------------------------
    # Normalization helpers
    # -------------------------------------------------------------------------

    def _normalize_telemetry(
        self,
        device_sn: str,
        flat: dict,
        raw: dict,
        timestamp: datetime | None = None,
    ) -> NormalizedTelemetry:
        """Normalize Solarman response fields to NormalizedTelemetry."""
        return NormalizedTelemetry(
            device_sn=device_sn,
            timestamp=timestamp or dj_timezone.now(),
            source="SOLARMAN",
            power_w=self._safe_float(flat, ["pac", "power", "Power", "activePower", "powerW", "Pac_R"]),
            energy_today_kwh=self._safe_float(flat, ["eToday", "today", "Today", "Et_ge0", "todayEnergy", "energyToday"]),
            energy_total_kwh=self._safe_float(flat, ["eTotal", "total", "Total", "Etdy_ge1", "totalEnergy", "energyTotal"]),
            battery_soc=self._safe_float(flat, ["SOC", "soc", "batterySoc", "batterySOC", "B_left1"]),
            battery_power_w=self._safe_float(flat, ["batteryPower", "batPower", "Pb_Sum", "Power"]),
            grid_power_w=self._safe_float(flat, ["gridPower", "pGrid", "PG_Pt1", "Grid Tie Power"]),
            load_power_w=self._safe_float(flat, ["loadPower", "pLoad", "CT_Pt1", "Load Power"]),
            pv1_power_w=self._safe_float(flat, ["pv1Power", "DPi_t1", "P1"]),
            pv2_power_w=self._safe_float(flat, ["pv2Power", "DPi_t2", "P2"]),
            pv_total_power_w=self._safe_float(flat, ["pvPower", "solarPower", "Ppv_T"]),
            voltage_ac=self._safe_float(flat, ["gridVoltage", "acVoltage", "vac", "AV1", "L"]),
            frequency_hz=self._safe_float(flat, ["gridFrequency", "frequency", "fac", "PG_F1"]),
            temperature_c=self._safe_float(flat, ["temperature", "inverterTemp", "INV_T0", "Temp"]),
            raw_response=raw if isinstance(raw, dict) else {},
        )

    @staticmethod
    def _flatten_data_list(data_list: list) -> dict:
        """
        Solarman sometimes returns data as a list of {key, value} dicts.
        Flatten for easier field extraction.
        """
        flat: dict = {}
        for item in data_list:
            key = item.get("key") or item.get("name", "")
            name = item.get("name", "")
            value = item.get("value")
            if key and value is not None:
                flat[key] = value
                lower_key = str(key).strip().lower()
                if lower_key and lower_key not in flat:
                    flat[lower_key] = value
            if name and value is not None:
                flat[name] = value
                lower_name = str(name).strip().lower()
                if lower_name and lower_name not in flat:
                    flat[lower_name] = value
        return flat

    @staticmethod
    def _build_signature(app_secret: str, timestamp_ms: str, body: bytes) -> str:
        """Construct HMAC-SHA256 signature per Solarman spec."""
        payload_hash = hashlib.sha256(body).hexdigest()
        sign_target = f"{timestamp_ms}{payload_hash}"
        return hmac.new(
            app_secret.encode("utf-8"),
            sign_target.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    @staticmethod
    def _parse_collection_time(value: object) -> datetime | None:
        """Convert Solarman collectionTime to an aware datetime if possible."""
        try:
            if value is None:
                return None
            timestamp = int(value)
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except (TypeError, ValueError, OSError):
            return None

    @staticmethod
    def _map_severity(level: int | str) -> str:
        """Map Solarman alert level to our severity enum."""
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
        from integrations.models import ProviderCredential

        try:
            cred = ProviderCredential.objects.get(provider="SOLARMAN", is_active=True)
        except ProviderCredential.DoesNotExist:
            return None

        if cred.cached_token and cred.token_expires_at and cred.token_expires_at > dj_timezone.now():
            return cred.cached_token
        return None

    @staticmethod
    def _save_cached_token(token: str, expires_in: int = 3600) -> None:
        from integrations.models import ProviderCredential

        ProviderCredential.objects.update_or_create(
            provider="SOLARMAN",
            defaults={
                "base_url": getattr(settings, "SOLARMAN_BASE_URL", ""),
                "cached_token": token,
                "token_expires_at": dj_timezone.now() + timedelta(seconds=max(expires_in - 60, 60)),
                "last_used_at": dj_timezone.now(),
                "is_active": True,
            },
        )

    @staticmethod
    def _clear_cached_token() -> None:
        from integrations.models import ProviderCredential

        ProviderCredential.objects.filter(provider="SOLARMAN").update(
            cached_token="", token_expires_at=None
        )
