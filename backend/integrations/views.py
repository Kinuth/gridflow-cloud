"""
API views for solar provider integrations.

Provides endpoints for:
- Provider credential management
- Manual sync triggers
- Device discovery from cloud APIs
- Sync history / audit logs
"""

from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from devices.models import Device
from integrations.clients import get_client
from integrations.clients.base import ProviderClientError
from integrations.models import ProviderCredential, SyncLog
from integrations.serializers import ProviderCredentialSerializer, SyncLogSerializer
from integrations.tasks import backfill_device_history, sync_single_device


class ProviderCredentialListView(APIView):
    """
    GET  — List all provider credentials (platform-wide).
    POST — Create/update a provider credential.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        credentials = ProviderCredential.objects.all()
        serializer = ProviderCredentialSerializer(credentials, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ProviderCredentialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProviderCredentialDetailView(APIView):
    """
    PUT    — Update a provider credential.
    DELETE — Deactivate (soft-delete) a provider credential.
    """

    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            cred = ProviderCredential.objects.get(pk=pk)
        except ProviderCredential.DoesNotExist:
            return Response(
                {"detail": "Credential not found."}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = ProviderCredentialSerializer(cred, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            cred = ProviderCredential.objects.get(pk=pk)
        except ProviderCredential.DoesNotExist:
            return Response(
                {"detail": "Credential not found."}, status=status.HTTP_404_NOT_FOUND
            )

        cred.is_active = False
        cred.save(update_fields=["is_active"])
        return Response({"detail": "Credential deactivated."}, status=status.HTTP_200_OK)


class DiscoverStationsView(APIView):
    """
    POST — Discover stations/plants from a provider.
    Body: {"provider": "DEYE" or "SOLARMAN"}
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        provider = request.data.get("provider", "").upper()
        if provider not in ("DEYE", "SOLARMAN"):
            return Response(
                {"detail": "provider must be DEYE or SOLARMAN"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client = get_client(provider)
            stations = client.get_station_list()
        except ProviderClientError as exc:
            return Response(
                {"detail": f"Discovery failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "provider": provider,
                "stations": [
                    {
                        "station_id": s.station_id,
                        "name": s.name,
                        "location": s.location,
                        "capacity_kw": s.capacity_kw,
                    }
                    for s in stations
                ],
            }
        )


class DiscoverDevicesView(APIView):
    """
    POST — Discover devices from a provider (optionally for a specific station).
    Body: {"provider": "DEYE", "station_id": "optional"}
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        provider = request.data.get("provider", "").upper()
        station_id = request.data.get("station_id", "")

        if provider not in ("DEYE", "SOLARMAN"):
            return Response(
                {"detail": "provider must be DEYE or SOLARMAN"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client = get_client(provider)
            devices = client.get_device_list(station_id=station_id)
        except ProviderClientError as exc:
            return Response(
                {"detail": f"Discovery failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "provider": provider,
                "devices": [
                    {
                        "device_sn": d.device_sn,
                        "device_name": d.device_name,
                        "station_id": d.station_id,
                        "device_type": d.device_type,
                        "status": d.status,
                    }
                    for d in devices
                ],
            }
        )


class ManualSyncView(APIView):
    """
    POST /api/integrations/sync/<device_id>/ — Trigger on-demand sync.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, device_id):
        try:
            device = Device.objects.get(pk=device_id)
        except Device.DoesNotExist:
            return Response(
                {"detail": "Device not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if device.data_source not in ("DEYE", "SOLARMAN"):
            return Response(
                {"detail": f"Device {device.serial_number} is not cloud-connected (source={device.data_source})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = sync_single_device.delay(device_id)
        return Response(
            {
                "detail": f"Sync queued for device {device.serial_number}.",
                "task_id": task.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class BackfillHistoryView(APIView):
    """
    POST /api/integrations/backfill/<device_id>/ — Trigger historical data backfill.
    Body: {"start_date": "2024-01-01", "end_date": "2024-03-31", "granularity": 1}
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, device_id):
        try:
            device = Device.objects.get(pk=device_id)
        except Device.DoesNotExist:
            return Response(
                {"detail": "Device not found."}, status=status.HTTP_404_NOT_FOUND
            )

        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")
        granularity = int(request.data.get("granularity", 1))

        if not start_date or not end_date:
            return Response(
                {"detail": "start_date and end_date are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = backfill_device_history.delay(device_id, start_date, end_date, granularity)
        return Response(
            {
                "detail": f"Backfill queued for device {device.serial_number}.",
                "task_id": task.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class SyncLogListView(ListAPIView):
    """
    GET /api/integrations/logs/ — List sync audit logs.
    """

    serializer_class = SyncLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SyncLog.objects.select_related("credential").all()[:100]
