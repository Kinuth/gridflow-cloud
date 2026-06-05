from rest_framework import serializers

from .models import ProviderCredential, SyncLog


class ProviderCredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderCredential
        fields = [
            "id",
            "provider",
            "base_url",
            "is_active",
            "last_used_at",
            "token_expires_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "cached_token",
            "token_expires_at",
            "last_used_at",
            "created_at",
            "updated_at",
        ]


class SyncLogSerializer(serializers.ModelSerializer):
    provider = serializers.CharField(source="credential.provider", read_only=True)

    class Meta:
        model = SyncLog
        fields = [
            "id",
            "provider",
            "started_at",
            "finished_at",
            "status",
            "devices_synced",
            "devices_failed",
            "error_message",
        ]
        read_only_fields = fields
