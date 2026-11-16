# ENERGYSYNC AI

**Predict. Monitor. Optimize. Save Energy.**  
Engineering prototype for the **IEEE Energy & Storage Innovation Challenge 2026 — BLDEACET Vijayapura**.

## Overview

ENERGYSYNC AI is a full-stack smart campus energy management and renewable storage optimization platform. It combines a persistent **SQLite** database, an **Express + TypeScript** REST API, genuine machine learning engines (**Random Forest Regression** and **Isolation Forest**), a constrained **Battery Storage Dispatch Optimizer**, and an interactive **React + Chart.js** dashboard.

### Core Engineering Proof Points

1. **AI Demand Forecasting (`src/server/ai/energyPrediction.ts`)**:  
   Trains a 36-tree **Random Forest Regressor** on 7 campus telemetry features (`hour`, `day_of_week`, `month`, `historical_consumption_kwh`, `occupancy_rate`, `temperature_c`, `solar_generation_kwh`) using an 80/20 chronological split and reports out-of-sample **MAE**, **RMSE**, and **R²**.
2. **AI Wastage Detection (`src/server/ai/anomalyDetection.ts`)**:  
   Builds an **Isolation Forest** (64 randomized iTrees) over consumption, occupancy, hour, baseline deviation, and holiday flags to detect empty-classroom load, after-hours equipment, unexpected lab surges, and holiday power draw.
3. **Battery Storage Optimization (`src/server/ai/batteryOptimization.ts`)**:  
   Executes a 24-hour constrained dispatch solver respecting battery capacity, SOC min/max bounds (15%–95%), max charge/discharge kW, and round-trip efficiency. Compares a naive baseline strategy against tariff-aware peak shaving.

---

## Demonstration Credentials

- **Email**: `admin@bldea-energysync.edu`
- **Password**: `EnergySync@2026`

Passwords are stored using salted `crypto.scryptSync` hashes (`src/server/auth/auth.ts`) and can be updated inside the **Settings** tab.

---

## Local Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Run automated verification & ML/API tests
npm test

# 3. Start full-stack server (Express API + Vite frontend on port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## REST API Endpoints

All telemetry endpoints are authenticated via HTTP-only signed session cookies or `Authorization: Bearer <token>`.

### GET Endpoints
- `GET /api/dashboard` — Aggregated KPIs, microgrid energy flow, 24h series, building breakdown
- `GET /api/buildings` — 5 campus zones with daily/historical metrics
- `GET /api/energy/consumption` — Building-wise and campus-wide hourly/daily time series
- `GET /api/energy/prediction` — Random Forest 24h forecast, MAE, RMSE, R², and feature importance
- `GET /api/energy/anomalies` — Isolation Forest wastage alerts
- `GET /api/occupancy` — Classroom occupancy & appliance relay state
- `GET /api/solar` — Solar PV generation, direct consumption, battery allocation & grid fallback
- `GET /api/battery` — Hourly battery telemetry & optimization comparison
- `GET /api/optimization` — Battery summary & AI energy-saving recommendations
- `GET /api/reports` — Daily, building comparison, solar, battery, and wastage reports
- `GET /api/reports/export?type=consumption|battery|anomalies` — CSV file download
- `GET /api/docs` — OpenAPI 3.0.3 endpoint catalog

### POST Endpoints
- `POST /api/auth/login` / `POST /api/auth/logout` / `POST /api/auth/change-password`
- `POST /api/energy/data` — Ingest live ESP32/smart meter or simulated consumption readings
- `POST /api/occupancy/update` — Update PIR occupancy or classroom equipment relays
- `POST /api/battery/schedule` — Recompute battery optimization with custom physical constraints
- `POST /api/optimization/recommend` — Approve, reject, reset, or regenerate AI recommendations
- `POST /api/simulation/run` — Execute new simulation scenario and retrain ML pipeline
- `POST /api/simulation/reset` — Restore baseline demonstration dataset

### Karnataka Statewide & Advanced Sustainability Endpoints
- `GET /api/state/dashboard`, `/api/state/colleges`, `/api/state/districts`, `/api/state/analytics`, `/api/state/reports`
- `POST /api/state/colleges`, `/api/state/districts` — Register campuses and districts across Karnataka
- `GET /api/advanced/digital-twin` — Virtual building, rooftop PV, BESS, and equipment telemetry twin
- `GET /api/advanced/peak-load` & `POST /api/advanced/peak-load/shift` — Peak tariff shaving & flexible load deferral
- `GET /api/advanced/maintenance` & `POST /api/advanced/maintenance/:id` — Predictive maintenance diagnostics
- `GET /api/advanced/weather-forecast` — Weather-adjusted solar and HVAC demand forecasting
- `GET /api/advanced/notifications` & `POST /api/advanced/notifications/read` — Smart alert notifications
- `GET /api/advanced/carbon` — CO₂ footprint calculations & verified physics equations (`E = P × t`, `RE%`, `Cost`, `SOC%`)
- `GET /api/advanced/leaderboard` — Normalized Karnataka Green Campus Leaderboard (`kWh/student`, `RE%`, wastage reduction, battery efficiency, CO₂ avoided, improvement delta)
- `GET /api/advanced/reliability`, `POST /api/advanced/backup`, `POST /api/advanced/backup/verify`, `POST /api/advanced/offline-buffer`, `POST /api/advanced/sync-buffer`, `GET /api/advanced/privacy-check` — SQLite backups, offline sensor buffering & auto-sync, schema migrations, ML drift history, API rate limiting (`300 req/60s`), and audit logs

---

## Future ESP32 & Physical IoT Hardware Integration

All initial telemetry is explicitly tagged **`SIMULATED DATA`**. To connect physical campus hardware without modifying the core platform:

1. **Hardware Nodes**:
   - **MCU**: ESP32-WROOM-32 (Wi-Fi HTTPS client)
   - **Current Sensing**: SCT-013-030 Non-Invasive AC Current Sensor
   - **Voltage Sensing**: ZMPT101B AC Voltage Sensor Module
   - **Occupancy Sensing**: HC-SR501 PIR Motion Sensor
2. **Firmware Payload**:
   Send periodic JSON POST requests to `/api/energy/data` and `/api/occupancy/update` with `"data_source": "LIVE SENSOR DATA"`:

```json
POST /api/energy/data
{
  "building_id": 1,
  "consumption_kwh": 24.6,
  "occupancy_count": 48,
  "temperature_c": 29.4,
  "data_source": "LIVE SENSOR DATA"
}
```
