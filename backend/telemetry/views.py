"""
Telemetry API views.

Provides endpoints for:
- Listing telemetry readings for a device (with date filtering)
- Manual sync trigger (provider-agnostic)
- Historical data with date range
- Device alerts
- Dashboard summary
"""

import json

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from devices.models import Device
from integrations.clients import get_client
from integrations.clients.base import ProviderClientError

from .models import DeviceAlert, TelemetryReading
from .serializers import (
    DeviceAlertSerializer,
    TelemetryReadingDetailSerializer,
    TelemetryReadingSerializer,
)


def _parse_provider_device_id(value: str | int | None) -> int | None:
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError, AttributeError):
        return None
    return parsed if parsed > 0 else None


class TelemetryListView(ListAPIView):
    """
    GET /api/devices/<device_id>/telemetry/
    List telemetry readings for a device. Supports date filtering.

    Query params:
        ?start=2024-01-01T00:00:00Z — Filter from this timestamp
        ?end=2024-01-31T23:59:59Z   — Filter until this timestamp
        ?limit=100                   — Max records (default 500)
    """

    serializer_class = TelemetryReadingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_org = getattr(self.request.user, "organization", None)
        if user_org is None and not self.request.user.is_staff:
            return TelemetryReading.objects.none()

        qs = TelemetryReading.objects.filter(device_id=self.kwargs["device_id"])

        if user_org and not self.request.user.is_staff:
            qs = qs.filter(device__organization=user_org)

        # Date filtering
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if start:
            qs = qs.filter(timestamp__gte=start)
        if end:
            qs = qs.filter(timestamp__lte=end)

        limit = int(self.request.query_params.get("limit", 500))
        return qs[:limit]


class TelemetrySyncView(APIView):
    """
    POST /api/devices/<device_id>/telemetry/sync/
    Provider-agnostic manual telemetry sync.

    Works for both Deye and Solarman devices based on the device's data_source.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, device_id: int):
        user_org = getattr(request.user, "organization", None)

        try:
            device = Device.objects.get(pk=device_id)
            if user_org and not request.user.is_staff:
                if device.organization != user_org:
                    return Response(
                        {"detail": "Device not found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
        except Device.DoesNotExist:
            return Response(
                {"detail": "Device not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if device.data_source not in ("DEYE", "SOLARMAN"):
            return Response(
                {"detail": f"Device is not cloud-connected (source={device.data_source})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client = get_client(device.data_source)
            reading = client.get_realtime_data(
                device.serial_number,
                _parse_provider_device_id(device.provider_device_id),
            )
        except ProviderClientError as exc:
            return Response(
                {"detail": f"Sync failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        record = TelemetryReading.objects.create(
            device=device,
            timestamp=reading.timestamp,
            source=reading.source,
            power_w=reading.power_w,
            energy_today_kwh=reading.energy_today_kwh,
            energy_total_kwh=reading.energy_total_kwh,
            battery_soc=reading.battery_soc,
            battery_power_w=reading.battery_power_w,
            grid_power_w=reading.grid_power_w,
            load_power_w=reading.load_power_w,
            pv1_power_w=reading.pv1_power_w,
            pv2_power_w=reading.pv2_power_w,
            pv_total_power_w=reading.pv_total_power_w,
            voltage_ac=reading.voltage_ac,
            frequency_hz=reading.frequency_hz,
            temperature_c=reading.temperature_c,
            raw_response=reading.raw_response,
        )

        # Update device status
        device.last_synced_at = timezone.now()
        device.status = "ONLINE"
        device.save(update_fields=["last_synced_at", "status"])

        serializer = TelemetryReadingDetailSerializer(record)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TelemetryLatestView(APIView):
    """
    GET /api/devices/<device_id>/telemetry/latest/
    Get the latest telemetry reading, preferring Redis cache.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, device_id: int):
        # Try Redis cache first
        cache_key = f"device:{device_id}:latest"
        cached = cache.get(cache_key)
        if cached:
            data = json.loads(cached) if isinstance(cached, str) else cached
            data["cached"] = True
            return Response(data)

        # Fall back to DB
        try:
            reading = TelemetryReading.objects.filter(device_id=device_id).first()
        except TelemetryReading.DoesNotExist:
            return Response(
                {"detail": "No telemetry data found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not reading:
            return Response(
                {"detail": "No telemetry data found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TelemetryReadingDetailSerializer(reading)
        return Response(serializer.data)


class DeviceAlertListView(ListAPIView):
    """
    GET /api/devices/<device_id>/alerts/
    List alerts for a device with optional filters.

    Query params:
        ?active=true      — Only active alerts
        ?severity=CRITICAL — Filter by severity
    """

    serializer_class = DeviceAlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = DeviceAlert.objects.filter(device_id=self.kwargs["device_id"])

        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(is_active=active.lower() == "true")

        severity = self.request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity.upper())

        return qs[:200]


class DashboardSummaryView(APIView):
    """
    GET /api/dashboard/summary/
    Aggregated dashboard data for the current user's organization.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_org = getattr(request.user, "organization", None)

        if user_org is None and not request.user.is_staff:
            return Response({"detail": "No organization."}, status=status.HTTP_403_FORBIDDEN)

        # Get devices
        devices = Device.objects.all()
        if user_org and not request.user.is_staff:
            devices = devices.filter(organization=user_org)

        total_devices = devices.count()
        online_devices = devices.filter(status="ONLINE").count()

        # Get latest readings for each device
        device_ids = list(devices.values_list("id", flat=True))
        latest_readings = []
        for device_id in device_ids[:50]:  # Cap at 50 for perf
            cache_key = f"device:{device_id}:latest"
            cached = cache.get(cache_key)
            if cached:
                data = json.loads(cached) if isinstance(cached, str) else cached
                latest_readings.append(data)

        # Aggregate
        total_power_w = sum(r.get("power_w", 0) or 0 for r in latest_readings)
        total_pv_w = sum(r.get("pv_total_power_w", 0) or 0 for r in latest_readings)

        # Active alerts count
        active_alerts = DeviceAlert.objects.filter(
            device_id__in=device_ids,
            is_active=True,
        ).count()

        return Response(
            {
                "total_devices": total_devices,
                "online_devices": online_devices,
                "offline_devices": total_devices - online_devices,
                "total_power_w": total_power_w,
                "total_pv_power_w": total_pv_w,
                "active_alerts": active_alerts,
            }
        )