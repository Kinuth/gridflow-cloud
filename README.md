# GridFlow Solar Cloud Platform

A human‑centered, AI‑assisted remote monitoring and billing platform for solar PV systems — designed for **households, SMEs, and C&I customers**.

The platform integrates **real‑time inverter telemetry** from **Deye Cloud** and **Solarman** APIs, supports **PAYGo payments**, and **PPA monthly billing**, providing a unified view of all solar assets.

---

## ✨ Key Features

| Feature | Status |
|---------|--------|
| Real‑time solar inverter telemetry (Deye + Solarman) | ✅ |
| Dual provider integration with unified data model | ✅ |
| Device online/offline monitoring | ✅ |
| Energy generation & consumption dashboards | ✅ |
| Historical data backfill (30–90 days) | ✅ |
| Device alerts with push notifications | ✅ |
| PAYGo billing for households & SMEs | ✅ |
| Monthly PPA billing & invoicing for C&I | ✅ |
| Role‑based authentication (Owner, Operator, Viewer, Admin) | ✅ |
| Background sync via Celery (every 5 min) | ✅ |
| Redis caching for real-time dashboard | ✅ |
| Docker Compose deployment | ✅ |
| Web + Mobile support | ✅ |

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    External Cloud APIs                        │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │   Deye Cloud API    │    │     Solarman API             │ │
│  │   (EU Region)       │    │     (Global)                 │ │
│  └─────────┬───────────┘    └──────────────┬───────────────┘ │
└────────────┼───────────────────────────────┼─────────────────┘
             │                               │
             ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│              Django Backend (DRF)                             │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Integration Layer                        │    │
│  │  BaseProviderClient → DeyeCloudClient                │    │
│  │                     → SolarmanClient                  │    │
│  │  NormalizedTelemetry (unified data format)           │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ Celery Worker   │  │ Celery Beat  │  │  REST API      │   │
│  │ (sync tasks)    │  │ (scheduler)  │  │  (DRF views)   │   │
│  └────────┬───────┘  └──────┬───────┘  └────────┬───────┘   │
│           │                 │                    │            │
│  ┌────────▼─────────────────▼────────────────────▼───────┐   │
│  │         PostgreSQL + TimescaleDB                       │   │
│  │         Redis (cache + broker)                         │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
             │                               │
             ▼                               ▼
      React Web App                   Mobile App (RN)
```

---

## 🧰 Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| **Django 5.2** | Web framework |
| **Django REST Framework** | REST API |
| **PostgreSQL 16 + TimescaleDB** | Relational + time-series database |
| **Redis 7** | Cache + message broker |
| **Celery 5** | Background task processing |
| **Gunicorn** | WSGI HTTP server |
| **Docker** | Containerized deployment |

### External APIs
| Provider | Base URL | Purpose |
|----------|----------|---------|
| **Deye Cloud** | `eu1-developer.deyecloud.com/v1.0` | Inverter telemetry, station management |
| **Solarman** | `api.solarmanpv.com` | Device monitoring, historical data |

### Frontend
- **Web**: React (TypeScript) with Recharts / Chart.js
- **Mobile**: React Native + Expo

---

## 📁 Repository Structure

```
gridflow-cloud/
├── backend/
│   ├── gridflow_cloud_backend/     # Django project settings
│   │   ├── settings.py             # PostgreSQL, Redis, Celery, API config
│   │   ├── celery.py               # Celery app configuration
│   │   ├── urls.py                 # Root URL routing
│   │   └── wsgi.py
│   ├── users/                      # User management (custom User model)
│   ├── organizations/              # Organization/tenant management
│   ├── devices/                    # Device registry (inverters, loggers)
│   ├── telemetry/                  # Telemetry readings, alerts, notifications
│   │   ├── models.py               # TelemetryReading, DeviceAlert, NotificationLog
│   │   ├── views.py                # List, sync, latest, alerts, dashboard
│   │   └── urls.py
│   ├── integrations/               # Solar API integration layer
│   │   ├── clients/
│   │   │   ├── base.py             # Abstract BaseProviderClient
│   │   │   ├── deye.py             # Deye Cloud API client
│   │   │   └── solarman.py         # Solarman API client
│   │   ├── normalizers.py          # NormalizedTelemetry, NormalizedAlert
│   │   ├── models.py               # ProviderCredential, SyncLog
│   │   ├── tasks.py                # Celery tasks (sync, backfill, alerts)
│   │   ├── views.py                # Discovery, manual sync, credentials
│   │   └── urls.py
│   ├── core/                       # Shared permissions, utilities
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── requirements.txt
│   └── .env.example
├── frontend-web/                   # React web app
├── frontend-mobile/                # React Native mobile app
├── docker-compose.yml              # Full stack orchestration
├── API_DOCUMENTATION.md            # Complete API reference
├── README.md
└── LICENSE
```

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Deye Cloud developer account ([sign up](https://www.deyecloud.com/login))
- Solarman developer account (contact `service@solarmanpv.com`)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/gridflow-cloud.git
cd gridflow-cloud

# Copy environment template
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials:
```env
DEYE_APP_ID=your-deye-app-id
DEYE_APP_SECRET=your-deye-app-secret
DEYE_EMAIL=your-deye-email
DEYE_PASSWORD=your-deye-password

SOLARMAN_APP_ID=your-solarman-app-id
SOLARMAN_APP_SECRET=your-solarman-app-secret
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

This starts:
- **PostgreSQL + TimescaleDB** on port 5432
- **Redis** on port 6379
- **Django API** on port 8000
- **Celery Worker** (background sync)
- **Celery Beat** (periodic scheduler)

### 3. Create Admin User

```bash
docker compose exec web python manage.py createsuperuser
```

### 4. Verify

```bash
# Check all services are running
docker compose ps

# View API root
curl http://localhost:8000/api/

# Check Django admin
open http://localhost:8000/admin/
```

---

## 🛠️ Local Development (without Docker)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start PostgreSQL and Redis separately, then:
cp .env.example .env  # Edit with your local DB/Redis URLs

python manage.py migrate
python manage.py runserver
```

In separate terminals:
```bash
celery -A gridflow_cloud_backend worker --loglevel=info
celery -A gridflow_cloud_backend beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

---

## 🔌 Solar API Integration

### Supported Providers
The platform uses a **provider abstraction layer** that normalizes data from different cloud APIs into a unified format:

| Provider | Auth Method | Realtime | Historical | Alerts | Batch |
|----------|------------|----------|------------|--------|-------|
| **Deye Cloud** | JWT (SHA256 password) | ✅ Up to 10 devices | ✅ 4 granularities | ✅ | ✅ |
| **Solarman** | OAuth2 + HMAC-SHA256 | ✅ Single device | ✅ 4 time types | ✅ | ❌ |

### Data Flow
1. **Celery Beat** triggers `sync_all_devices` every 5 minutes
2. Devices are grouped by `data_source` (DEYE / SOLARMAN)
3. The appropriate **ProviderClient** fetches data from the cloud API
4. Responses are **normalized** to `NormalizedTelemetry`
5. Data is stored in **PostgreSQL (TimescaleDB)** and cached in **Redis**
6. **Alerts** trigger push notifications to device owners/operators

---

## 🔑 Core KPIs

1. **Live telemetry latency < 10 seconds** (from API to dashboard)
2. Device uptime (% reporting time)
3. Payment success rate
4. Revenue collected vs billed
5. Customer downtime incidents

---

## 📊 API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for the complete REST API reference.

### Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/devices/` | GET | List devices |
| `/api/devices/<id>/telemetry/` | GET | Get telemetry readings |
| `/api/devices/<id>/telemetry/sync/` | POST | Trigger manual sync |
| `/api/devices/<id>/telemetry/latest/` | GET | Get cached latest reading |
| `/api/devices/<id>/alerts/` | GET | Get device alerts |
| `/api/dashboard/summary/` | GET | Aggregated dashboard |
| `/api/integrations/discover/stations/` | POST | Discover cloud stations |
| `/api/integrations/discover/devices/` | POST | Discover cloud devices |
| `/api/integrations/sync/<id>/` | POST | Queue background sync |
| `/api/integrations/backfill/<id>/` | POST | Backfill historical data |

---

## 🧑‍🤝‍🧑 Collaboration

- Feature‑based branches
- Shared API contract (this documentation)
- Automated linting & tests via CI
- Protected `main` branch with PR reviews

---

## 📄 License

This project is licensed under the [AGPL-3.0 License](./LICENSE).
