from rest_framework import serializers

from .models import DeviceAlert, NotificationLog, TelemetryReading


class TelemetryReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelemetryReading
        fields = [
            "id",
            "device",
            "timestamp",
            "source",
            "power_w",
            "energy_today_kwh",
            "energy_total_kwh",
            "battery_soc",
            "battery_power_w",
            "grid_power_w",
            "load_power_w",
            "pv1_power_w",
            "pv2_power_w",
            "pv_total_power_w",
            "voltage_ac",
            "frequency_hz",
            "temperature_c",
        ]
        read_only_fields = ["id", "timestamp"]


class TelemetryReadingDetailSerializer(TelemetryReadingSerializer):
    """Includes raw_response for debugging."""

    class Meta(TelemetryReadingSerializer.Meta):
        fields = TelemetryReadingSerializer.Meta.fields + ["raw_response"]


class DeviceAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceAlert
        fields = [
            "id",
            "device",
            "source",
            "alert_code",
            "alert_name",
            "severity",
            "occurred_at",
            "resolved_at",
            "is_active",
            "notification_sent",
        ]
        read_only_fields = fields


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = [
            "id",
            "alert",
            "notification_type",
            "title",
            "body",
            "recipient_user_id",
            "sent_at",
            "delivered",
        ]
        read_only_fields = fields


# Backward-compatible alias
TelemetrySerializer = TelemetryReadingSerializer