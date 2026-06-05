#!/bin/bash
set -e

echo "=== GridFlow Cloud Backend — Entrypoint ==="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
while ! python -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.connect(('${DATABASE_HOST:-db}', ${DATABASE_PORT:-5432}))
    s.close()
    exit(0)
except:
    exit(1)
" 2>/dev/null; do
    echo "  PostgreSQL not ready, retrying in 2s..."
    sleep 2
done
echo "PostgreSQL is ready!"

# Run migrations
echo "Running migrations..."
python manage.py migrate --noinput

# Create the periodic Celery Beat schedules
echo "Setting up periodic tasks..."
python manage.py shell -c "
from django_celery_beat.models import PeriodicTask, IntervalSchedule
import json

# Sync all devices every 5 minutes
schedule_5m, _ = IntervalSchedule.objects.get_or_create(
    every=5, period=IntervalSchedule.MINUTES
)
PeriodicTask.objects.update_or_create(
    name='sync_all_devices',
    defaults={
        'task': 'integrations.tasks.sync_all_devices',
        'interval': schedule_5m,
        'enabled': True,
    }
)

# Sync alerts every 15 minutes
schedule_15m, _ = IntervalSchedule.objects.get_or_create(
    every=15, period=IntervalSchedule.MINUTES
)
PeriodicTask.objects.update_or_create(
    name='sync_alerts_all',
    defaults={
        'task': 'integrations.tasks.sync_alerts_all',
        'interval': schedule_15m,
        'enabled': True,
    }
)

print('Periodic tasks configured.')
" 2>/dev/null || echo "Periodic task setup skipped (may already exist)."

echo "Starting: $@"
exec "$@"
