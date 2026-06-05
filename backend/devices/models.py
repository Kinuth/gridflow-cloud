from django.db import models
from organizations.models import Organization


class Device(models.Model):
    DEVICE_TYPE = (
        ("INVERTER", "Hybrid Inverter"),
        ("LOGGER", "Data logger"),
    )
    STATUS = (
        ("ONLINE", "Online"),
        ("OFFLINE", "Offline"),
    )
    DATA_SOURCE_CHOICES = (
        ("DEYE", "Deye Cloud"),
        ("SOLARMAN", "Solarman"),
        ("MANUAL", "Manual / Local"),
    )

    serial_number = models.CharField(max_length=255, unique=True)
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPE)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="devices"
    )
    auth_token = models.CharField(max_length=64, unique=True)  # for edge authentication
    status = models.CharField(max_length=20, choices=STATUS, default="OFFLINE")

    # --- Provider integration fields ---
    data_source = models.CharField(
        max_length=20,
        choices=DATA_SOURCE_CHOICES,
        default="MANUAL",
        help_text="Which cloud API provides telemetry for this device.",
    )
    provider_device_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="External device ID from the provider API.",
    )
    provider_station_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="External station/plant ID from the provider API.",
    )
    last_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of the last successful telemetry sync.",
    )

    installed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["data_source", "status"]),
        ]

    def __str__(self):
        return self.serial_number
