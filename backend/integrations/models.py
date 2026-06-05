"""
Models for solar API provider integrations.

Platform-wide credentials are stored in Django settings (env vars).
This model stores cached tokens and per-provider configuration.
"""

from django.db import models


class ProviderChoices(models.TextChoices):
    DEYE = "DEYE", "Deye Cloud"
    SOLARMAN = "SOLARMAN", "Solarman"


class ProviderCredential(models.Model):
    """
    Platform-wide provider credential and token cache.

    Since all organizations share a single set of Deye/Solarman credentials,
    this model primarily serves as:
    1. A token cache (avoids re-authenticating on every API call)
    2. A per-provider configuration store (base URL, active flag)
    3. An audit trail of when credentials were last used

    Actual secrets (app_id, app_secret, password) live in env vars / Django settings.
    """

    provider = models.CharField(
        max_length=20,
        choices=ProviderChoices.choices,
        unique=True,
        help_text="Cloud API provider (DEYE or SOLARMAN).",
    )
    base_url = models.URLField(
        help_text="Base URL for API calls (region-specific for Deye).",
    )
    cached_token = models.TextField(
        blank=True,
        default="",
        help_text="Cached access token from the provider API.",
    )
    token_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the cached token expires.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Disable to stop syncing from this provider without deleting.",
    )
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of the last successful API call.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Provider Credential"
        verbose_name_plural = "Provider Credentials"

    def __str__(self):
        return f"{self.get_provider_display()} ({'active' if self.is_active else 'inactive'})"


class SyncLog(models.Model):
    """
    Audit log for every sync operation.
    Tracks success/failure, duration, and device count.
    """

    class Status(models.TextChoices):
        SUCCESS = "SUCCESS", "Success"
        PARTIAL = "PARTIAL", "Partial Success"
        FAILED = "FAILED", "Failed"

    credential = models.ForeignKey(
        ProviderCredential,
        on_delete=models.CASCADE,
        related_name="sync_logs",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.SUCCESS,
    )
    devices_synced = models.PositiveIntegerField(default=0)
    devices_failed = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["credential", "-started_at"]),
        ]

    def __str__(self):
        return f"Sync {self.credential.provider} @ {self.started_at:%Y-%m-%d %H:%M} — {self.status}"
