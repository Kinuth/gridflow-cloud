"""
Celery application configuration for GridFlow Cloud Backend.

Autodiscovers tasks from all installed Django apps.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "gridflow_cloud_backend.settings")

app = Celery("gridflow_cloud_backend")

# Read config from Django settings, all celery-related keys should have a `CELERY_` prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Autodiscover tasks.py in each installed app.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Diagnostic task that prints the current request info."""
    print(f"Request: {self.request!r}")
