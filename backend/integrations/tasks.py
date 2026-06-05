"""
Celery tasks for periodic telemetry sync, alert processing, and history backfill.

Schedule (via django-celery-beat):
    - sync_all_devices: every 5 minutes
    - sync_alerts_all: every 15 minutes
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from devices.models import Device
from integrations.clients import get_client
from integrations.clients.base import ProviderClientError
from integrations.models import ProviderCredential, SyncLog
from integrations.normalizers import NormalizedAlert, NormalizedTelemetry
from telemetry.models import DeviceAlert, NotificationLog, TelemetryReading

logger = logging.getLogger(__name__)


def _parse_provider_device_id(value: str | int | None) -> int | None:
    """Return a numeric provider device id when available."""
    if value is None:
        return None
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


# ---------------------------------------------------------------------------
# Telemetry sync
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def sync_all_devices(self):
    """
    Periodic task: sync latest telemetry for all cloud-connected devices.

    Groups devices by data_source to reuse the same authenticated client,
    then fetches and stores data for each device.
    """
    devices = Device.objects.filter(
        data_source__in=["DEYE", "SOLARMAN"],
    ).select_related("organization")

    if not devices.exists():
        logger.info("No cloud-connected devices to sync.")
        return "No devices"

    deye_devices = [d for d in devices if d.data_source == "DEYE"]
    solarman_devices = [d for d in devices if d.data_source == "SOLARMAN"]

    total_synced = 0
    total_failed = 0

    if deye_devices:
        synced, failed = _sync_batch("DEYE", deye_devices)
        total_synced += synced
        total_failed += failed

    if solarman_devices:
        synced, failed = _sync_batch("SOLARMAN", solarman_devices)
        total_synced += synced
        total_failed += failed

    return f"Synced {total_synced}, failed {total_failed}"


def _sync_batch(data_source: str, devices: list[Device]) -> tuple[int, int]:
    """Sync a batch of devices for a given provider."""
    synced = 0
    failed = 0

    # Create sync log
    try:
        cred = ProviderCredential.objects.get(provider=data_source, is_active=True)
    except ProviderCredential.DoesNotExist:
        cred = None

    log = None
    if cred:
        log = SyncLog.objects.create(credential=cred)

    try:
        client = get_client(data_source)

        if data_source == "DEYE":
            # Deye supports batch queries (up to 10)
            sns = [d.serial_number for d in devices]
            telemetry_list = client.get_realtime_data_batch(sns)

            sn_to_device = {d.serial_number: d for d in devices}
            for reading in telemetry_list:
                device = sn_to_device.get(reading.device_sn)
                if device:
                    _store_telemetry(device, reading)
                    synced += 1
        else:
            # Solarman: one-by-one
            for device in devices:
                try:
                    reading = client.get_realtime_data(
                        device.serial_number,
                        _parse_provider_device_id(device.provider_device_id),
                    )
                    _store_telemetry(device, reading)
                    synced += 1
                except ProviderClientError as exc:
                    logger.error(f"Sync failed for {device.serial_number}: {exc}")
                    failed += 1

    except ProviderClientError as exc:
        logger.error(f"Batch sync failed for {data_source}: {exc}")
        failed = len(devices)
        if log:
            log.status = SyncLog.Status.FAILED
            log.error_message = str(exc)

    if log:
        log.devices_synced = synced
        log.devices_failed = failed
        log.finished_at = timezone.now()
        if failed > 0 and synced > 0:
            log.status = SyncLog.Status.PARTIAL
        elif failed > 0:
            log.status = SyncLog.Status.FAILED
        else:
            log.status = SyncLog.Status.SUCCESS
        log.save()

    return synced, failed


def _store_telemetry(device: Device, reading: NormalizedTelemetry) -> TelemetryReading:
    """Create a TelemetryReading record and update device status."""
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

    # Update device metadata
    Device.objects.filter(pk=device.pk).update(
        last_synced_at=timezone.now(),
        status="ONLINE",
    )

    # Cache latest reading in Redis
    _cache_latest_reading(device.pk, reading)

    return record


def _cache_latest_reading(device_id: int, reading: NormalizedTelemetry) -> None:
    """Cache the latest telemetry snapshot in Redis for fast dashboard access."""
    from django.core.cache import cache
    import json

    cache_key = f"device:{device_id}:latest"
    cache_data = {
        "power_w": reading.power_w,
        "energy_today_kwh": reading.energy_today_kwh,
        "battery_soc": reading.battery_soc,
        "grid_power_w": reading.grid_power_w,
        "load_power_w": reading.load_power_w,
        "pv_total_power_w": reading.pv_total_power_w,
        "timestamp": reading.timestamp.isoformat(),
        "source": reading.source,
    }
    cache.set(cache_key, json.dumps(cache_data), timeout=300)  # 5 min TTL


# ---------------------------------------------------------------------------
# Single device sync (on-demand)
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def sync_single_device(self, device_id: int):
    """On-demand sync for a single device."""
    try:
        device = Device.objects.get(pk=device_id, data_source__in=["DEYE", "SOLARMAN"])
    except Device.DoesNotExist:
        return f"Device {device_id} not found or not cloud-connected"

    try:
        client = get_client(device.data_source)
        reading = client.get_realtime_data(
            device.serial_number,
            _parse_provider_device_id(device.provider_device_id),
        )
        record = _store_telemetry(device, reading)
        return f"Synced device {device.serial_number}: telemetry_id={record.id}"
    except ProviderClientError as exc:
        logger.error(f"On-demand sync failed for device {device_id}: {exc}")
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Historical data backfill
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def backfill_device_history(
    self,
    device_id: int,
    start_date: str,
    end_date: str,
    granularity: int = 1,
):
    """
    Pull historical data from the provider API and bulk-insert.

    Args:
        device_id: Internal Device ID
        start_date: ISO format date string (YYYY-MM-DD)
        end_date: ISO format date string (YYYY-MM-DD)
        granularity: 1=raw, 2=daily, 3=monthly, 4=yearly
    """
    try:
        device = Device.objects.get(pk=device_id, data_source__in=["DEYE", "SOLARMAN"])
    except Device.DoesNotExist:
        return f"Device {device_id} not found or not cloud-connected"

    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)

    # Enforce 90-day max for high-granularity
    if granularity == 1 and (end - start).days > 90:
        end = start + timedelta(days=90)

    try:
        client = get_client(device.data_source)
        readings = client.get_historical_data(
            device_sn=device.serial_number,
            start=start,
            end=end,
            granularity=granularity,
        )
    except ProviderClientError as exc:
        logger.error(f"History backfill failed for device {device_id}: {exc}")
        raise self.retry(exc=exc)

    records = []
    for reading in readings:
        records.append(
            TelemetryReading(
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
        )

    TelemetryReading.objects.bulk_create(records, batch_size=500, ignore_conflicts=True)

    return f"Backfilled {len(records)} records for device {device.serial_number}"


# ---------------------------------------------------------------------------
# Alert sync
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def sync_alerts_all(self):
    """
    Periodic task: sync alerts for all stations across all providers.
    Triggers push notifications for new critical/warning alerts.
    """
    for source in ["DEYE", "SOLARMAN"]:
        devices = Device.objects.filter(data_source=source)
        if not devices.exists():
            continue

        station_ids = set(
            devices.exclude(provider_station_id="")
            .values_list("provider_station_id", flat=True)
        )

        if not station_ids:
            continue

        try:
            client = get_client(source)
        except ProviderClientError as exc:
            logger.error(f"Cannot create {source} client for alerts: {exc}")
            continue

        end = date.today()
        start = end - timedelta(days=1)  # Check last 24h

        for station_id in station_ids:
            try:
                alerts = client.get_alerts(station_id, start, end)
                _process_alerts(alerts, source)
            except ProviderClientError as exc:
                logger.error(f"Alert sync failed for station {station_id}: {exc}")

    return "Alert sync complete"


def _process_alerts(alerts: list[NormalizedAlert], source: str) -> None:
    """Process normalized alerts: create records and trigger notifications."""
    for alert in alerts:
        # Find matching device
        try:
            device = Device.objects.get(serial_number=alert.device_sn)
        except Device.DoesNotExist:
            logger.warning(f"Alert for unknown device {alert.device_sn}, skipping.")
            continue

        # Upsert alert (avoid duplicates by code + device + time)
        obj, created = DeviceAlert.objects.get_or_create(
            device=device,
            source=source,
            alert_code=alert.alert_code,
            occurred_at=alert.occurred_at,
            defaults={
                "alert_name": alert.alert_name,
                "severity": alert.severity,
                "is_active": alert.is_active,
                "raw_data": alert.raw_data,
            },
        )

        if created and alert.severity in ("WARNING", "CRITICAL"):
            _send_alert_notification(device, obj)


def _send_alert_notification(device: Device, alert: DeviceAlert) -> None:
    """Send push notification for a new alert."""
    from users.models import User

    title = f"⚠️ {alert.get_severity_display()} Alert — {device.serial_number}"
    body = f"{alert.alert_name} (Code: {alert.alert_code})"

    # Notify all users in the device's organization with OWNER or OPERATOR role
    recipients = User.objects.filter(
        organization=device.organization,
        role__in=["OWNER", "OPERATOR"],
    )

    for user in recipients:
        NotificationLog.objects.create(
            alert=alert,
            notification_type="ALERT",
            title=title,
            body=body,
            recipient_user_id=user.pk,
            delivered=False,  # Will be updated by FCM delivery
        )

    # Mark notification as sent on the alert
    alert.notification_sent = True
    alert.save(update_fields=["notification_sent"])

    # TODO: Integrate Firebase Cloud Messaging (FCM) for actual push delivery
    # from integrations.services.notifications import send_fcm_push
    # send_fcm_push(title, body, [u.fcm_token for u in recipients if u.fcm_token])

    logger.info(f"Alert notification queued for {recipients.count()} users: {title}")
