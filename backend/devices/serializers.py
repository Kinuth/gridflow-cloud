from rest_framework import serializers
import secrets

from .models import Device


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            "id",
            "serial_number",
            "device_type",
            "organization",
            "auth_token",
            "status",
            "data_source",
            "provider_device_id",
            "provider_station_id",
            "last_synced_at",
            "installed_at",
        ]
        read_only_fields = ["id", "auth_token", "last_synced_at"]

    def create(self, validated_data):
        validated_data.setdefault("auth_token", secrets.token_hex(32))
        return super().create(validated_data)