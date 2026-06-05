#!/usr/bin/env bash
set -euo pipefail

# Simple dev wrapper to run backend and frontend concurrently.
# Usage: ./dev.sh

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Activate virtualenv if present
if [ -f "$REPO_ROOT/.venv/bin/activate" ]; then
  source "$REPO_ROOT/.venv/bin/activate"
elif [ -f "$REPO_ROOT/.venv/Scripts/activate" ]; then
  source "$REPO_ROOT/.venv/Scripts/activate"
fi

trap 'kill 0' INT TERM EXIT

echo "Starting Django backend on http://127.0.0.1:8000"
python "$REPO_ROOT/backend/manage.py" runserver 127.0.0.1:8000 &
BACKEND_PID=$!

echo "Starting Vite frontend in frontend-web"
cd "$REPO_ROOT/frontend-web"
npm run dev &
FRONT_PID=$!

wait $BACKEND_PID $FRONT_PID
