from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from devices.models import Device
from telemetry.models import TelemetryReading
from integrations.clients import get_client
from integrations.clients.base import ProviderClientError


def _parse_provider_device_id(value: str | int | None) -> int | None:
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError, AttributeError):
        return None
    return parsed if parsed > 0 else None


class Command(BaseCommand):
    help = "Pull realtime telemetry from cloud API (Deye/Solarman) for a device."

    def add_arguments(self, parser):
        parser.add_argument("--device-id", type=int, required=True, help="Internal Device ID")

    def handle(self, *args, **options):
        device_id = options["device_id"]

        try:
            device = Device.objects.get(id=device_id)
        except Device.DoesNotExist as exc:
            raise CommandError(f"Device with id={device_id} does not exist") from exc

        if device.data_source not in ("DEYE", "SOLARMAN"):
            raise CommandError(
                f"Device {device.serial_number} has data_source={device.data_source}. "
                "Only DEYE and SOLARMAN are supported."
            )

        try:
            client = get_client(device.data_source)
            reading = client.get_realtime_data(
                device.serial_number,
                _parse_provider_device_id(device.provider_device_id),
            )
        except ProviderClientError as exc:
            raise CommandError(str(exc)) from exc

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

        self.stdout.write(
            self.style.SUCCESS(
                f"Stored telemetry id={record.id} for device={device.serial_number} "
                f"(source={reading.source}): power_w={record.power_w}, "
                f"energy_today_kwh={record.energy_today_kwh}, battery_soc={record.battery_soc}"
            )
        )
