from django.urls import path

from .views import (
    DashboardSummaryView,
    DeviceAlertListView,
    TelemetryLatestView,
    TelemetryListView,
    TelemetrySyncView,
)

urlpatterns = [
    # Telemetry
    path(
        "devices/<int:device_id>/telemetry/",
        TelemetryListView.as_view(),
        name="device-telemetry-list",
    ),
    path(
        "devices/<int:device_id>/telemetry/sync/",
        TelemetrySyncView.as_view(),
        name="device-telemetry-sync",
    ),
    path(
        "devices/<int:device_id>/telemetry/latest/",
        TelemetryLatestView.as_view(),
        name="device-telemetry-latest",
    ),
    # Alerts
    path(
        "devices/<int:device_id>/alerts/",
        DeviceAlertListView.as_view(),
        name="device-alert-list",
    ),
    # Dashboard
    path(
        "dashboard/summary/",
        DashboardSummaryView.as_view(),
        name="dashboard-summary",
    ),
]
