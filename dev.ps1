param()
# Simple PowerShell dev wrapper to run backend and frontend.
# Usage: .\dev.ps1

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Activate venv if present (Activate.ps1)
$activate = Join-Path $repoRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $activate) {
    & $activate
}

Write-Host "Starting Django backend on http://127.0.0.1:8000"
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "${repoRoot}\backend\manage.py runserver 127.0.0.1:8000"

Write-Host "Starting Vite frontend in frontend-web"
Start-Process -NoNewWindow -WorkingDirectory "${repoRoot}\frontend-web" -FilePath "npm" -ArgumentList "run","dev"

Write-Host "Dev servers started. Use Ctrl+C in this window to stop background processes."
