from django.contrib import admin
from .models import ProviderCredential, SyncLog


@admin.register(ProviderCredential)
class ProviderCredentialAdmin(admin.ModelAdmin):
    list_display = ("provider", "base_url", "is_active", "last_used_at", "updated_at")
    list_filter = ("provider", "is_active")
    readonly_fields = ("cached_token", "token_expires_at", "last_used_at", "created_at", "updated_at")

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        # Mask token in admin
        return fields


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ("credential", "started_at", "finished_at", "status", "devices_synced", "devices_failed")
    list_filter = ("status", "credential__provider")
    readonly_fields = ("started_at",)
