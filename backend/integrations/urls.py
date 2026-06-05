from django.urls import path

from .views import (
    BackfillHistoryView,
    DiscoverDevicesView,
    DiscoverStationsView,
    ManualSyncView,
    ProviderCredentialDetailView,
    ProviderCredentialListView,
    SyncLogListView,
)

urlpatterns = [
    # Provider credentials
    path(
        "credentials/",
        ProviderCredentialListView.as_view(),
        name="provider-credential-list",
    ),
    path(
        "credentials/<int:pk>/",
        ProviderCredentialDetailView.as_view(),
        name="provider-credential-detail",
    ),
    # Discovery
    path(
        "discover/stations/",
        DiscoverStationsView.as_view(),
        name="discover-stations",
    ),
    path(
        "discover/devices/",
        DiscoverDevicesView.as_view(),
        name="discover-devices",
    ),
    # Sync
    path(
        "sync/<int:device_id>/",
        ManualSyncView.as_view(),
        name="manual-sync",
    ),
    path(
        "backfill/<int:device_id>/",
        BackfillHistoryView.as_view(),
        name="backfill-history",
    ),
    # Logs
    path(
        "logs/",
        SyncLogListView.as_view(),
        name="sync-log-list",
    ),
]
