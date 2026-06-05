from django.db import models
from devices.models import Device


class TelemetryReading(models.Model):
    """
    A single telemetry snapshot from a solar device.

    Stores both the normalized fields (for querying / dashboards) and the
    raw API response (for debugging and future field extraction).
    This table is intended to be a TimescaleDB hypertable, partitioned on `timestamp`.
    """

    SOURCE_CHOICES = (
        ("DEYE", "Deye Cloud"),
        ("SOLARMAN", "Solarman"),
        ("MANUAL", "Manual / Local"),
    )

    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name="telemetry_readings"
    )
    timestamp = models.DateTimeField(
        db_index=True,
        help_text="When this reading was captured (UTC).",
    )
    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default="MANUAL",
        help_text="Which provider this reading came from.",
    )

    # --- Core power metrics ---
    power_w = models.FloatField(
        null=True, blank=True, help_text="Total active output power in Watts."
    )
    energy_today_kwh = models.FloatField(
        null=True, blank=True, help_text="Energy generated today in kWh."
    )
    energy_total_kwh = models.FloatField(
        null=True, blank=True, help_text="Lifetime energy generated in kWh."
    )

    # --- Battery ---
    battery_soc = models.FloatField(
        null=True, blank=True, help_text="Battery State of Charge (0-100%)."
    )
    battery_power_w = models.FloatField(
        null=True,
        blank=True,
        help_text="Battery charge/discharge power in Watts (positive=charging).",
    )

    # --- Grid ---
    grid_power_w = models.FloatField(
        null=True,
        blank=True,
        help_text="Grid import/export power in Watts (positive=importing).",
    )

    # --- Load ---
    load_power_w = models.FloatField(
        null=True, blank=True, help_text="Total load consumption in Watts."
    )

    # --- PV strings ---
    pv1_power_w = models.FloatField(
        null=True, blank=True, help_text="PV string 1 power in Watts."
    )
    pv2_power_w = models.FloatField(
        null=True, blank=True, help_text="PV string 2 power in Watts."
    )
    pv_total_power_w = models.FloatField(
        null=True, blank=True, help_text="Total PV input power in Watts."
    )

    # --- Electrical ---
    voltage_ac = models.FloatField(
        null=True, blank=True, help_text="AC output voltage in Volts."
    )
    frequency_hz = models.FloatField(
        null=True, blank=True, help_text="AC output frequency in Hz."
    )
    temperature_c = models.FloatField(
        null=True, blank=True, help_text="Inverter temperature in °C."
    )

    # --- Raw response for debugging ---
    raw_response = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full API response preserved for debugging.",
    )

    class Meta:
        indexes = [
            models.Index(fields=["device", "timestamp"]),
            models.Index(fields=["device", "-timestamp"]),
            models.Index(fields=["source", "timestamp"]),
        ]
        ordering = ["-timestamp"]
        # Keeping both names for backward compatibility
        db_table = "telemetry_telemetryreading"

    def __str__(self):
        return f"Telemetry for {self.device.serial_number} at {self.timestamp}"

    # Backward compatibility alias
    @property
    def energy_kwh(self):
        return self.energy_total_kwh


class DeviceAlert(models.Model):
    """
    Alerts and alarms from solar API providers.
    Supports both Deye Cloud and Solarman alert formats.
    """

    SEVERITY_CHOICES = (
        ("INFO", "Info"),
        ("WARNING", "Warning"),
        ("CRITICAL", "Critical"),
    )
    SOURCE_CHOICES = (
        ("DEYE", "Deye Cloud"),
        ("SOLARMAN", "Solarman"),
    )

    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name="alerts"
    )
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    alert_code = models.CharField(
        max_length=100,
        help_text="Provider-specific alert/error code.",
    )
    alert_name = models.CharField(
        max_length=255,
        help_text="Human-readable alert name.",
    )
    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_CHOICES,
        default="WARNING",
    )
    occurred_at = models.DateTimeField(
        help_text="When the alert was triggered.",
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the alert was resolved (null = still active).",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this alert is currently active.",
    )
    notification_sent = models.BooleanField(
        default=False,
        help_text="Whether a push notification was sent for this alert.",
    )
    raw_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full alert payload from provider API.",
    )

    class Meta:
        indexes = [
            models.Index(fields=["device", "-occurred_at"]),
            models.Index(fields=["is_active", "device"]),
            models.Index(fields=["severity", "is_active"]),
        ]
        ordering = ["-occurred_at"]

    def __str__(self):
        status = "ACTIVE" if self.is_active else "RESOLVED"
        return f"[{self.severity}] {self.alert_name} — {status}"


class NotificationLog(models.Model):
    """
    Log of push notifications sent to users.
    Tracks delivery status for alert-triggered notifications.
    """

    TYPE_CHOICES = (
        ("ALERT", "Device Alert"),
        ("DEVICE_OFFLINE", "Device Offline"),
        ("SYNC_FAILURE", "Sync Failure"),
    )

    alert = models.ForeignKey(
        DeviceAlert,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    body = models.TextField()
    recipient_user_id = models.IntegerField(
        help_text="User ID who received this notification.",
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    delivered = models.BooleanField(default=False)
    fcm_message_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Firebase Cloud Messaging message ID.",
    )

    class Meta:
        ordering = ["-sent_at"]
        indexes = [
            models.Index(fields=["recipient_user_id", "-sent_at"]),
        ]

    def __str__(self):
        return f"{self.notification_type}: {self.title}"
