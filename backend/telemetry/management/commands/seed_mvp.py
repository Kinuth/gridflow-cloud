from django.core.management.base import BaseCommand
from django.utils import timezone
from organizations.models import Organization
from devices.models import Device
from telemetry.models import TelemetryReading
import random


class Command(BaseCommand):
    help = "Seed demo organization, devices and telemetry for the MVP"

    def handle(self, *args, **options):
        org, _ = Organization.objects.get_or_create(name="MVP Demo Org", org_type="SME")

        devices = []
        for i in range(1, 4):
            sn = f"MVP-DEV-{i:03d}"
            device, _ = Device.objects.get_or_create(
                serial_number=sn,
                defaults={
                    'device_type': 'INVERTER',
                    'organization': org,
                    'auth_token': f'mvp-token-{i}',
                    'status': 'ONLINE' if i % 2 == 1 else 'OFFLINE',
                    'data_source': 'MANUAL',
                },
            )
            devices.append(device)

        now = timezone.now()
        for device in devices:
            # create 12 hourly readings
            for h in range(12):
                ts = now - timezone.timedelta(hours=12 - h)
                TelemetryReading.objects.create(
                    device=device,
                    timestamp=ts,
                    source='MANUAL',
                    power_w=random.uniform(100, 3000),
                    energy_today_kwh=random.uniform(0, 20),
                    energy_total_kwh=random.uniform(100, 5000),
                    battery_soc=random.uniform(10, 100),
                    battery_power_w=random.uniform(-500, 500),
                    grid_power_w=random.uniform(-1000, 1000),
                    load_power_w=random.uniform(50, 2000),
                    pv1_power_w=random.uniform(0, 1500),
                    pv2_power_w=random.uniform(0, 1500),
                    pv_total_power_w=random.uniform(0, 3000),
                    voltage_ac=random.uniform(220, 240),
                    frequency_hz=50.0 + random.uniform(-0.2, 0.2),
                    temperature_c=random.uniform(10, 45),
                    raw_response={},
                )

        self.stdout.write(self.style.SUCCESS("Seeded MVP demo org, devices, and telemetry."))
        # assign existing demo user to the org if present
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            u = User.objects.filter(username='mvpuser').first()
            if u:
                u.organization = org
                u.save()
                self.stdout.write(self.style.SUCCESS(f"Assigned user 'mvpuser' to organization {org.name}"))
        except Exception:
            pass
