# GridFlow Cloud — API Documentation

**Base URL**: `http://localhost:8000/api/`  
**Authentication**: All endpoints require a valid session or token in the `Authorization` header.  
**Content-Type**: `application/json`

---

## Table of Contents

- [Authentication](#authentication)
- [Users](#users)
- [Organizations](#organizations)
- [Devices](#devices)
- [Telemetry](#telemetry)
- [Alerts](#alerts)
- [Dashboard](#dashboard)
- [Integrations](#integrations)
- [Error Handling](#error-handling)

---

## Authentication

All API endpoints require authentication. The API supports two methods:

### Session Authentication
For browser-based access (Django admin, development).

### Token Authentication
For API clients, include the token in the header:
```
Authorization: Token <your-token-here>
```

---

## Users

### List Users
```
GET /api/users/
```
Returns users in the caller's organization (admins see all).

**Response** `200 OK`
```json
[
    {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "role": "OWNER",
        "organization": 1
    }
]
```

### Create User
```
POST /api/users/
```
**Body**
```json
{
    "username": "jane_doe",
    "email": "jane@example.com",
    "password": "securepassword",
    "role": "OPERATOR",
    "organization": 1
}
```

### Retrieve / Update / Delete User
```
GET    /api/users/<id>/
PUT    /api/users/<id>/
PATCH  /api/users/<id>/
DELETE /api/users/<id>/
```

**Role Choices**: `OWNER`, `OPERATOR`, `VIEWER`, `ADMIN`

---

## Organizations

### List Organizations
```
GET /api/organizations/
```

**Response** `200 OK`
```json
[
    {
        "id": 1,
        "name": "SunPower Homes",
        "org_type": "HOUSEHOLD",
        "created_at": "2024-01-15T10:30:00Z"
    }
]
```

### Create Organization
```
POST /api/organizations/
```
**Body**
```json
{
    "name": "SunPower Homes",
    "org_type": "SME"
}
```

**Org Type Choices**: `HOUSEHOLD`, `SME`, `CI`

### Retrieve / Update / Delete
```
GET    /api/organizations/<id>/
PUT    /api/organizations/<id>/
PATCH  /api/organizations/<id>/
DELETE /api/organizations/<id>/
```

---

## Devices

### List Devices
```
GET /api/devices/
```
Returns devices in the caller's organization (admins see all).

**Response** `200 OK`
```json
[
    {
        "id": 1,
        "serial_number": "SN123456789",
        "device_type": "INVERTER",
        "organization": 1,
        "auth_token": "a1b2c3d4...",
        "status": "ONLINE",
        "data_source": "DEYE",
        "provider_device_id": "ext-device-001",
        "provider_station_id": "station-42",
        "last_synced_at": "2024-06-15T14:30:00Z",
        "installed_at": "2024-01-10T08:00:00Z"
    }
]
```

### Create Device
```
POST /api/devices/
```
**Body**
```json
{
    "serial_number": "SN123456789",
    "device_type": "INVERTER",
    "organization": 1,
    "data_source": "DEYE",
    "provider_device_id": "ext-device-001",
    "provider_station_id": "station-42"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serial_number` | string | ✅ | Unique device serial number |
| `device_type` | string | ✅ | `INVERTER` or `LOGGER` |
| `organization` | integer | ✅ | Organization ID |
| `data_source` | string | ❌ | `DEYE`, `SOLARMAN`, or `MANUAL` (default: `MANUAL`) |
| `provider_device_id` | string | ❌ | External ID from cloud API |
| `provider_station_id` | string | ❌ | External station/plant ID |
| `installed_at` | datetime | ❌ | Installation timestamp |

### Retrieve / Update / Delete
```
GET    /api/devices/<id>/
PUT    /api/devices/<id>/
PATCH  /api/devices/<id>/
DELETE /api/devices/<id>/
```

---

## Telemetry

### List Telemetry Readings
```
GET /api/devices/<device_id>/telemetry/
```

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | datetime | Filter from this timestamp (ISO 8601) |
| `end` | datetime | Filter until this timestamp (ISO 8601) |
| `limit` | integer | Max records to return (default: 500) |

**Example**
```
GET /api/devices/1/telemetry/?start=2024-06-01T00:00:00Z&end=2024-06-30T23:59:59Z&limit=100
```

**Response** `200 OK`
```json
[
    {
        "id": 42,
        "device": 1,
        "timestamp": "2024-06-15T14:30:00Z",
        "source": "DEYE",
        "power_w": 4500.0,
        "energy_today_kwh": 18.5,
        "energy_total_kwh": 12450.0,
        "battery_soc": 85.0,
        "battery_power_w": 1200.0,
        "grid_power_w": -500.0,
        "load_power_w": 3200.0,
        "pv1_power_w": 2300.0,
        "pv2_power_w": 2200.0,
        "pv_total_power_w": 4500.0,
        "voltage_ac": 230.5,
        "frequency_hz": 50.01,
        "temperature_c": 42.3
    }
]
```

### Get Latest Reading (Cached)
```
GET /api/devices/<device_id>/telemetry/latest/
```
Returns the most recent reading, preferring the Redis cache (~1ms) over a database query.

**Response** `200 OK`
```json
{
    "power_w": 4500.0,
    "energy_today_kwh": 18.5,
    "battery_soc": 85.0,
    "grid_power_w": -500.0,
    "load_power_w": 3200.0,
    "pv_total_power_w": 4500.0,
    "timestamp": "2024-06-15T14:30:00Z",
    "source": "DEYE",
    "cached": true
}
```

### Trigger Manual Sync
```
POST /api/devices/<device_id>/telemetry/sync/
```
Immediately fetches the latest data from the device's cloud provider (Deye or Solarman) and stores it.

**Response** `201 Created`
```json
{
    "id": 43,
    "device": 1,
    "timestamp": "2024-06-15T14:35:00Z",
    "source": "DEYE",
    "power_w": 4480.0,
    "energy_today_kwh": 18.7,
    "energy_total_kwh": 12450.2,
    "battery_soc": 86.0,
    ...
}
```

**Error Responses**
| Code | Meaning |
|------|---------|
| `400` | Device is not cloud-connected (data_source = MANUAL) |
| `404` | Device not found |
| `502` | Cloud API returned an error |

---

## Alerts

### List Device Alerts
```
GET /api/devices/<device_id>/alerts/
```

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `active` | boolean | Filter by active status (`true` or `false`) |
| `severity` | string | Filter by severity: `INFO`, `WARNING`, `CRITICAL` |

**Example**
```
GET /api/devices/1/alerts/?active=true&severity=CRITICAL
```

**Response** `200 OK`
```json
[
    {
        "id": 7,
        "device": 1,
        "source": "DEYE",
        "alert_code": "E021",
        "alert_name": "Grid Overvoltage",
        "severity": "WARNING",
        "occurred_at": "2024-06-15T14:30:00Z",
        "resolved_at": null,
        "is_active": true,
        "notification_sent": true
    }
]
```

---

## Dashboard

### Dashboard Summary
```
GET /api/dashboard/summary/
```
Returns aggregated statistics for the caller's organization.

**Response** `200 OK`
```json
{
    "total_devices": 12,
    "online_devices": 10,
    "offline_devices": 2,
    "total_power_w": 45000.0,
    "total_pv_power_w": 48000.0,
    "active_alerts": 3
}
```

---

## Integrations

### List Provider Credentials
```
GET /api/integrations/credentials/
```
Lists platform-wide provider credentials (tokens are never exposed).

**Response** `200 OK`
```json
[
    {
        "id": 1,
        "provider": "DEYE",
        "base_url": "https://eu1-developer.deyecloud.com/v1.0",
        "is_active": true,
        "last_used_at": "2024-06-15T14:30:00Z",
        "token_expires_at": "2024-06-15T15:20:00Z",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-06-15T14:30:00Z"
    }
]
```

### Create Provider Credential
```
POST /api/integrations/credentials/
```
**Body**
```json
{
    "provider": "DEYE",
    "base_url": "https://eu1-developer.deyecloud.com/v1.0",
    "is_active": true
}
```

### Update Provider Credential
```
PUT /api/integrations/credentials/<id>/
```

### Deactivate Provider Credential
```
DELETE /api/integrations/credentials/<id>/
```
Soft-deletes by setting `is_active = false`.

---

### Discover Stations
```
POST /api/integrations/discover/stations/
```
Fetches the list of power stations/plants from a cloud provider.

**Body**
```json
{
    "provider": "DEYE"
}
```

**Response** `200 OK`
```json
{
    "provider": "DEYE",
    "stations": [
        {
            "station_id": "42",
            "name": "Sharjah Rooftop Site A",
            "location": "Sharjah, UAE",
            "capacity_kw": 15.5
        }
    ]
}
```

### Discover Devices
```
POST /api/integrations/discover/devices/
```
Fetches devices from a cloud provider, optionally filtered by station.

**Body**
```json
{
    "provider": "DEYE",
    "station_id": "42"
}
```

**Response** `200 OK`
```json
{
    "provider": "DEYE",
    "devices": [
        {
            "device_sn": "SN123456789",
            "device_name": "Hybrid Inverter 5kW",
            "station_id": "42",
            "device_type": "INVERTER",
            "status": "ONLINE"
        }
    ]
}
```

---

### Trigger Manual Sync (Background)
```
POST /api/integrations/sync/<device_id>/
```
Queues a background Celery task to sync a device.

**Response** `202 Accepted`
```json
{
    "detail": "Sync queued for device SN123456789.",
    "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Backfill Historical Data
```
POST /api/integrations/backfill/<device_id>/
```
Queues a background task to pull historical data from the cloud API.

**Body**
```json
{
    "start_date": "2024-03-01",
    "end_date": "2024-06-01",
    "granularity": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `start_date` | string | ✅ | Start date (YYYY-MM-DD) |
| `end_date` | string | ✅ | End date (YYYY-MM-DD) |
| `granularity` | integer | ❌ | 1=raw, 2=daily, 3=monthly, 4=yearly (default: 1) |

> **Note**: High-granularity (level 1) backfill is capped at 90 days.

**Response** `202 Accepted`
```json
{
    "detail": "Backfill queued for device SN123456789.",
    "task_id": "f0e1d2c3-b4a5-6789-0abc-def123456789"
}
```

### Sync Logs
```
GET /api/integrations/logs/
```
Returns the 100 most recent sync audit logs.

**Response** `200 OK`
```json
[
    {
        "id": 150,
        "provider": "DEYE",
        "started_at": "2024-06-15T14:30:00Z",
        "finished_at": "2024-06-15T14:30:12Z",
        "status": "SUCCESS",
        "devices_synced": 8,
        "devices_failed": 0,
        "error_message": ""
    }
]
```

---

## Error Handling

All error responses follow a consistent format:

```json
{
    "detail": "Human-readable error description."
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created successfully |
| `202` | Accepted (queued for background processing) |
| `400` | Bad request (invalid parameters) |
| `401` | Authentication required |
| `403` | Permission denied |
| `404` | Resource not found |
| `429` | Rate limited (by upstream cloud API) |
| `502` | Bad gateway (upstream cloud API error) |
| `500` | Internal server error |

### Upstream API Errors
When a cloud provider API (Deye/Solarman) returns an error, the response includes the provider-specific error message:

```json
{
    "detail": "Sync failed: Deye API error 401: Token expired"
}
```

---

## Data Models

### Telemetry Fields Reference

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `power_w` | float | Watts | Total active output power |
| `energy_today_kwh` | float | kWh | Energy generated today |
| `energy_total_kwh` | float | kWh | Lifetime energy generated |
| `battery_soc` | float | % | Battery State of Charge (0-100) |
| `battery_power_w` | float | Watts | Battery power (+charge, -discharge) |
| `grid_power_w` | float | Watts | Grid power (+import, -export) |
| `load_power_w` | float | Watts | Total load consumption |
| `pv1_power_w` | float | Watts | PV string 1 power |
| `pv2_power_w` | float | Watts | PV string 2 power |
| `pv_total_power_w` | float | Watts | Total PV input power |
| `voltage_ac` | float | Volts | AC output voltage |
| `frequency_hz` | float | Hz | AC frequency |
| `temperature_c` | float | °C | Inverter temperature |

### Alert Severity Levels

| Level | Description |
|-------|-------------|
| `INFO` | Informational, no action required |
| `WARNING` | Attention needed, not critical |
| `CRITICAL` | Immediate action required |

---

## Rate Limits

The upstream cloud APIs have their own rate limits:

| Provider | Limit | Notes |
|----------|-------|-------|
| **Deye Cloud** | Per-application | Check your developer portal |
| **Solarman** | Per-account | Specified in developer agreement |

The background sync runs every **5 minutes** to stay well within these limits. Manual sync operations should be used sparingly.
