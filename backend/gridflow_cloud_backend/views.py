import json
from datetime import timedelta

from django.conf import settings
from django.shortcuts import render
from django.utils import timezone

from devices.models import Device
from telemetry.models import DeviceAlert, TelemetryReading
from telemetry.serializers import TelemetryReadingDetailSerializer
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
from users.serializers import UserSerializer
import json
from organizations.models import Organization


def _mask_value(value: str, visible: int = 3) -> str:
    if not value:
        return "Not set"
    if len(value) <= visible * 2:
        return "*" * len(value)
    return f"{value[:visible]}{'*' * (len(value) - (visible * 2))}{value[-visible:]}"


def _format_telemetry_value(value):
    if value is None:
        return "Not set"
    if isinstance(value, dict):
        return json.dumps(value, indent=2, sort_keys=True)
    return value


def dashboard_view(request):
    now = timezone.now()
    last_24h = now - timedelta(hours=24)

    total_devices = Device.objects.count()
    online_devices = Device.objects.filter(status="ONLINE").count()
    active_alerts = DeviceAlert.objects.filter(is_active=True).count()
    recent_readings = TelemetryReading.objects.filter(timestamp__gte=last_24h).count()
    latest_reading = TelemetryReading.objects.select_related("device").first()

    telemetry_rows = []
    if latest_reading:
        latest_telemetry = TelemetryReadingDetailSerializer(latest_reading).data
        telemetry_rows = [
            ("Device", _format_telemetry_value(latest_telemetry.get("device"))),
            ("Timestamp", _format_telemetry_value(latest_telemetry.get("timestamp"))),
            ("Source", _format_telemetry_value(latest_telemetry.get("source"))),
            ("Power W", _format_telemetry_value(latest_telemetry.get("power_w"))),
            (
                "Energy Today kWh",
                _format_telemetry_value(latest_telemetry.get("energy_today_kwh")),
            ),
            (
                "Energy Total kWh",
                _format_telemetry_value(latest_telemetry.get("energy_total_kwh")),
            ),
            ("Battery SoC", _format_telemetry_value(latest_telemetry.get("battery_soc"))),
            (
                "Battery Power W",
                _format_telemetry_value(latest_telemetry.get("battery_power_w")),
            ),
            ("Grid Power W", _format_telemetry_value(latest_telemetry.get("grid_power_w"))),
            ("Load Power W", _format_telemetry_value(latest_telemetry.get("load_power_w"))),
            ("PV1 Power W", _format_telemetry_value(latest_telemetry.get("pv1_power_w"))),
            ("PV2 Power W", _format_telemetry_value(latest_telemetry.get("pv2_power_w"))),
            (
                "PV Total Power W",
                _format_telemetry_value(latest_telemetry.get("pv_total_power_w")),
            ),
            ("Voltage AC", _format_telemetry_value(latest_telemetry.get("voltage_ac"))),
            ("Frequency Hz", _format_telemetry_value(latest_telemetry.get("frequency_hz"))),
            (
                "Temperature C",
                _format_telemetry_value(latest_telemetry.get("temperature_c")),
            ),
            ("Raw Response", _format_telemetry_value(latest_telemetry.get("raw_response"))),
        ]

    context = {
        "last_updated": now,
        "cards": [
            {"label": "Total Devices", "value": total_devices},
            {"label": "Online Devices", "value": online_devices},
            {"label": "Offline Devices", "value": total_devices - online_devices},
            {"label": "Active Alerts", "value": active_alerts},
            {"label": "Telemetry (24h)", "value": recent_readings},
        ],
        "telemetry_rows": telemetry_rows,
    }
    return render(request, "dashboard/index.html", context)


@csrf_exempt
def register_view(request):
    """Simple registration endpoint for MVP that returns an auth token.

    Expects JSON: {"username": "...", "password": "...", "email": "..."}
    Returns: {"token": "...", "user": { ... }}
    """
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    # default role for self-registered users
    if 'role' not in payload:
        payload['role'] = 'OWNER'

    # If the client passes an organization_name (register as org), create it
    org_name = payload.pop('organization_name', None)
    if org_name:
        org_type = payload.pop('org_type', 'HOUSEHOLD')
        org = Organization.objects.create(name=org_name, org_type=org_type)
        # attach the created org id to payload so the UserSerializer links it
        payload['organization'] = org.id

    serializer = UserSerializer(data=payload)
    if not serializer.is_valid():
        return JsonResponse(serializer.errors, status=400)

    user = serializer.save()
    token, _ = Token.objects.get_or_create(user=user)

    user_data = UserSerializer(user).data
    return JsonResponse({"token": token.key, "user": user_data})