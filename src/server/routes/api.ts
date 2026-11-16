import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/database.ts';
import {
  clearSessionCookie,
  hashPassword,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
  type AuthenticatedRequest,
} from '../auth/auth.ts';
import {
  getCachedBatteryOptimization,
  getCachedPrediction,
  recomputeAIModelsFromDb,
  resetEnergySimulation,
  runEnergySimulation,
} from '../services/simulationService.ts';
import { optimizeBatterySchedule } from '../ai/batteryOptimization.ts';
import type { DashboardSummary, DataSourceLabel, WeatherCondition } from '../../types/energy.ts';
import { statewideRouter } from './statewideRoutes.ts';
import { advancedRouter } from './advancedRoutes.ts';
import { apiRateLimiter, auditMutationMiddleware } from '../middleware/reliability.ts';

export const apiRouter = Router();
apiRouter.use(apiRateLimiter);

// ---------------------------------------------------------------------------
// Authentication Routes
// ---------------------------------------------------------------------------
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, email, name, role, college, district, password_hash, created_at FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as
    | {
        id: number;
        email: string;
        name: string;
        role: string;
        college?: string;
        district?: string;
        password_hash: string;
        created_at: string;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid administrator credentials.' });
    return;
  }

  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  setSessionCookie(res, token, req);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      college: user.college ?? 'BLDEACET Vijayapura',
      district: user.district ?? 'Vijayapura',
      created_at: user.created_at,
    },
    token,
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const cookieToken = req.cookies?.energysync_session as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const session = verifySessionToken(cookieToken || bearerToken);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }
  const db = getDb();
  const user = db
    .prepare('SELECT id, email, name, role, college, district, created_at FROM users WHERE id = ?')
    .get(session.userId);
  if (!user) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, user });
});

apiRouter.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword, newName } = req.body as {
    currentPassword?: string;
    newPassword?: string;
    newName?: string;
  };
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Current password and a new password (min 8 chars) are required.' });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, password_hash, name FROM users WHERE id = ?')
    .get(req.user!.userId) as { id: number; password_hash: string; name: string } | undefined;

  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    res.status(403).json({ error: 'Current password is incorrect.' });
    return;
  }

  const newHash = hashPassword(newPassword);
  const updatedName = newName && newName.trim().length > 1 ? newName.trim() : user.name;
  db.prepare('UPDATE users SET password_hash = ?, name = ? WHERE id = ?').run(
    newHash,
    updatedName,
    user.id
  );

  res.json({ ok: true, message: 'Administrator credentials updated securely.' });
});

// ---------------------------------------------------------------------------
// Public Health & OpenAPI Docs
// ---------------------------------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    const buildingsCount = (db.prepare('SELECT COUNT(*) as cnt FROM buildings').get() as { cnt: number }).cnt;
    const energyCount = (db.prepare('SELECT COUNT(*) as cnt FROM energy_consumption').get() as { cnt: number }).cnt;
    res.json({
      status: 'ok',
      database: 'connected',
      buildings: buildingsCount,
      energy_records: energyCount,
      simulation_mode: process.env.SIMULATION_MODE !== 'false',
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Database health check failed',
    });
  }
});

// ---------------------------------------------------------------------------
// Protected Application Endpoints (requireAuth or explicit public docs)
// ---------------------------------------------------------------------------
apiRouter.get('/docs', (_req: Request, res: Response) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'ENERGYSYNC AI — Smart Campus Energy & Storage API',
      version: '1.0.0',
      description:
        'REST API for campus telemetry, Random Forest demand forecasting, Isolation Forest anomaly detection, solar management, and battery storage optimization.',
    },
    paths: {
      '/api/dashboard': { get: { summary: 'Get aggregated dashboard KPIs, flow & hourly series' } },
      '/api/buildings': { get: { summary: 'List campus buildings with consumption summary' } },
      '/api/energy/consumption': { get: { summary: 'Query building-wise & historical energy consumption' } },
      '/api/energy/data': { post: { summary: 'Ingest real ESP32/smart-meter or simulated energy reading' } },
      '/api/energy/prediction': { get: { summary: 'Get Random Forest 24h demand prediction & MAE/RMSE' } },
      '/api/energy/anomalies': { get: { summary: 'Get Isolation Forest wastage alerts' } },
      '/api/occupancy': { get: { summary: 'Get classroom occupancy & appliance status' } },
      '/api/occupancy/update': { post: { summary: 'Update room PIR occupancy or equipment relays' } },
      '/api/solar': { get: { summary: 'Get solar PV generation & utilization breakdown' } },
      '/api/battery': { get: { summary: 'Get battery bank SOC & telemetry' } },
      '/api/battery/schedule': { post: { summary: 'Run constrained battery storage optimization' } },
      '/api/optimization': { get: { summary: 'Get optimization summary and recommendations' } },
      '/api/optimization/recommend': { post: { summary: 'Approve, reject, or generate AI recommendations' } },
      '/api/reports': { get: { summary: 'Get daily, weekly, monthly, solar & wastage analytics' } },
      '/api/reports/export': { get: { summary: 'Download CSV energy report' } },
      '/api/simulation/run': { post: { summary: 'Run full simulation scenario & retrain ML pipeline' } },
      '/api/simulation/reset': { post: { summary: 'Reset demonstration dataset to baseline' } },
    },
  });
});

// Require auth for all operational endpoints below
apiRouter.use(requireAuth);
apiRouter.use(auditMutationMiddleware);

// Mount Karnataka Statewide Smart Energy Network endpoints
apiRouter.use('/state', statewideRouter);

// Mount Advanced Features & Reliability endpoints
apiRouter.use('/advanced', advancedRouter);

// ---------------------------------------------------------------------------
// GET /api/dashboard
// ---------------------------------------------------------------------------
apiRouter.get('/dashboard', (_req: Request, res: Response) => {
  const db = getDb();
  const sim = db.prepare('SELECT * FROM simulation_state WHERE id = 1').get() as {
    scenario_name: string;
    weather_condition: WeatherCondition;
    is_holiday: number;
    last_run_at: string;
    run_count: number;
    data_source: DataSourceLabel;
  };

  const latestDateRow = db
    .prepare('SELECT MAX(substr(timestamp, 1, 10)) as latest_date FROM energy_consumption')
    .get() as { latest_date: string | null };
  const todayDate = latestDateRow?.latest_date ?? new Date().toISOString().slice(0, 10);

  const totalAllTimeRow = db
    .prepare('SELECT COALESCE(SUM(consumption_kwh), 0) as total FROM energy_consumption')
    .get() as { total: number };
  const todayConsumptionRow = db
    .prepare(
      `SELECT COALESCE(SUM(consumption_kwh), 0) as total
       FROM energy_consumption WHERE substr(timestamp, 1, 10) = ?`
    )
    .get(todayDate) as { total: number };

  const monthlyMultiplier = 2.05; // 15 days stored -> extrapolate 30-day cycle alongside measured 15d sum
  const monthlyKwh = Number((totalAllTimeRow.total * monthlyMultiplier).toFixed(1));

  const solarTotals = db
    .prepare(
      `SELECT
         COALESCE(SUM(generated_kwh), 0) as gen,
         COALESCE(SUM(consumed_direct_kwh), 0) as direct,
         COALESCE(SUM(battery_charged_kwh), 0) as bat_ch,
         COALESCE(SUM(grid_import_kwh), 0) as grid
       FROM solar_generation`
    )
    .get() as { gen: number; direct: number; bat_ch: number; grid: number };

  const solarUtilPct =
    solarTotals.gen > 0
      ? Math.min(100, Number((((solarTotals.direct + solarTotals.bat_ch) / solarTotals.gen) * 100).toFixed(1)))
      : 0;

  let prediction = getCachedPrediction();
  let optimization = getCachedBatteryOptimization();
  if (!prediction || !optimization) {
    const rescan = recomputeAIModelsFromDb();
    prediction = rescan.prediction;
    optimization = rescan.optimization;
  }

  const currentHour = new Date().getHours();
  const currentBatRow = (db
    .prepare('SELECT * FROM battery_status ORDER BY id ASC LIMIT 1 OFFSET ?')
    .get(Math.min(23, currentHour)) ||
    db.prepare('SELECT * FROM battery_status ORDER BY id DESC LIMIT 1').get()) as
    | {
        soc_percent: number;
        stored_kwh: number;
        capacity_kwh: number;
        power_kw: number;
      }
    | undefined;

  const activeAlertsCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM energy_alerts WHERE status = 'Active'").get() as {
      cnt: number;
    }
  ).cnt;

  const hourlyRows = db
    .prepare(
      `SELECT
         ec.hour,
         ROUND(SUM(ec.consumption_kwh), 2) as consumption_kwh
       FROM energy_consumption ec
       WHERE substr(ec.timestamp, 1, 10) = ?
       GROUP BY ec.hour
       ORDER BY ec.hour ASC`
    )
    .all(todayDate) as Array<{ hour: number; consumption_kwh: number }>;

  const hourlySeries = optimization.schedule.map((s) => {
    const actualMatch = hourlyRows.find((r) => r.hour === s.hour);
    const predMatch = prediction!.hourly_forecast.find((p) => p.hour === s.hour);
    return {
      hour: s.hour,
      label: s.label,
      consumption_kwh: actualMatch ? actualMatch.consumption_kwh : s.demand_kwh,
      predicted_kwh: predMatch ? predMatch.predicted_kwh : s.demand_kwh,
      solar_kwh: s.solar_kwh,
      grid_kwh: s.optimized_grid_kwh,
      battery_soc_pct: s.optimized_soc_pct,
    };
  });

  const buildingRows = db
    .prepare(
      `SELECT
         b.id,
         b.code,
         b.name,
         b.category,
         b.baseline_daily_kwh,
         ROUND(COALESCE(SUM(ec.consumption_kwh), 0), 2) as today_kwh,
         ROUND(COALESCE(MAX(ec.consumption_kwh), 0), 2) as peak_kw
       FROM buildings b
       LEFT JOIN energy_consumption ec ON ec.building_id = b.id AND substr(ec.timestamp, 1, 10) = ?
       GROUP BY b.id
       ORDER BY today_kwh DESC`
    )
    .all(todayDate) as Array<{
    id: number;
    code: string;
    name: string;
    category: string;
    baseline_daily_kwh: number;
    today_kwh: number;
    peak_kw: number;
  }>;

  const buildingBreakdown = buildingRows.map((b) => ({
    ...b,
    efficiency_delta_pct: Number(
      (((b.baseline_daily_kwh - b.today_kwh) / Math.max(1, b.baseline_daily_kwh)) * 100).toFixed(1)
    ),
  }));

  const recentAlerts = db
    .prepare(
      `SELECT ea.*, b.name as building_name
       FROM energy_alerts ea
       JOIN buildings b ON b.id = ea.building_id
       ORDER BY ea.anomaly_score DESC
       LIMIT 5`
    )
    .all() as DashboardSummary['recent_alerts'];

  const topRecommendations = db
    .prepare(
      `SELECT r.*, b.name as building_name
       FROM optimization_recommendations r
       LEFT JOIN buildings b ON b.id = r.building_id
       ORDER BY CASE r.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, r.estimated_savings_inr DESC
       LIMIT 4`
    )
    .all() as DashboardSummary['top_recommendations'];

  const currentFlowHour = optimization.schedule[Math.min(23, currentHour)] ?? optimization.schedule[12];

  const payload: DashboardSummary = {
    campus_name: 'BLDEACET Vijayapura — IEEE Smart Microgrid Prototype',
    simulation_state: {
      scenario_name: sim.scenario_name,
      weather_condition: sim.weather_condition,
      is_holiday: Boolean(sim.is_holiday),
      last_run_at: sim.last_run_at,
      run_count: sim.run_count,
      data_source: sim.data_source,
    },
    kpis: {
      total_consumption_kwh: Number(totalAllTimeRow.total.toFixed(1)),
      today_consumption_kwh: Number(todayConsumptionRow.total.toFixed(1)),
      monthly_consumption_kwh: monthlyKwh,
      estimated_daily_cost_inr: optimization.summary.optimized_cost_inr,
      solar_generation_today_kwh: Number(solarTotals.gen.toFixed(1)),
      solar_utilization_pct: solarUtilPct,
      battery_soc_pct: currentBatRow?.soc_percent ?? 55,
      battery_stored_kwh: currentBatRow?.stored_kwh ?? 110,
      battery_capacity_kwh: currentBatRow?.capacity_kwh ?? 200,
      grid_usage_today_kwh: optimization.summary.optimized_grid_kwh,
      estimated_savings_inr: Number(
        (
          optimization.summary.estimated_cost_savings_inr +
          (solarTotals.direct + solarTotals.bat_ch) * 6.9
        ).toFixed(0)
      ),
      estimated_savings_kwh: Number(
        (
          solarTotals.direct +
          solarTotals.bat_ch +
          Math.max(0, optimization.summary.baseline_grid_kwh - optimization.summary.optimized_grid_kwh)
        ).toFixed(1)
      ),
      active_alerts_count: activeAlertsCount,
    },
    energy_flow: {
      solar_generated_kw: currentFlowHour.solar_kwh,
      solar_direct_kw: currentFlowHour.solar_direct_kwh,
      excess_solar_to_battery_kw: currentFlowHour.solar_to_battery_kwh,
      battery_discharge_kw: currentFlowHour.battery_to_load_kwh,
      grid_import_kw: currentFlowHour.optimized_grid_kwh,
      campus_demand_kw: currentFlowHour.demand_kwh,
    },
    hourly_series: hourlySeries,
    building_breakdown: buildingBreakdown,
    recent_alerts: recentAlerts,
    top_recommendations: topRecommendations,
  };

  res.json(payload);
});

// ---------------------------------------------------------------------------
// GET /api/buildings
// ---------------------------------------------------------------------------
apiRouter.get('/buildings', (_req: Request, res: Response) => {
  const db = getDb();
  const latestDateRow = db
    .prepare('SELECT MAX(substr(timestamp, 1, 10)) as latest_date FROM energy_consumption')
    .get() as { latest_date: string | null };
  const todayDate = latestDateRow?.latest_date ?? new Date().toISOString().slice(0, 10);

  const buildings = db
    .prepare(
      `SELECT
         b.*,
         ROUND(COALESCE(SUM(CASE WHEN substr(ec.timestamp, 1, 10) = ? THEN ec.consumption_kwh ELSE 0 END), 0), 2) as today_kwh,
         ROUND(COALESCE(MAX(CASE WHEN substr(ec.timestamp, 1, 10) = ? THEN ec.consumption_kwh ELSE 0 END), 0), 2) as peak_kw,
         ROUND(COALESCE(AVG(ec.consumption_kwh), 0), 2) as avg_hourly_kwh,
         ROUND(COALESCE(SUM(ec.consumption_kwh), 0), 2) as historical_total_kwh
       FROM buildings b
       LEFT JOIN energy_consumption ec ON ec.building_id = b.id
       GROUP BY b.id
       ORDER BY b.id ASC`
    )
    .all(todayDate, todayDate);

  res.json({ buildings, today_date: todayDate });
});

// ---------------------------------------------------------------------------
// GET /api/energy/consumption
// ---------------------------------------------------------------------------
apiRouter.get('/energy/consumption', (req: Request, res: Response) => {
  const db = getDb();
  const buildingId = req.query.building_id ? Number(req.query.building_id) : null;
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));

  const latestDateRow = db
    .prepare('SELECT MAX(substr(timestamp, 1, 10)) as latest_date FROM energy_consumption')
    .get() as { latest_date: string | null };
  const todayDate = latestDateRow?.latest_date ?? new Date().toISOString().slice(0, 10);

  const todayHourly = buildingId
    ? db
        .prepare(
          `SELECT ec.*, b.name as building_name, b.code as building_code
           FROM energy_consumption ec
           JOIN buildings b ON b.id = ec.building_id
           WHERE ec.building_id = ? AND substr(ec.timestamp, 1, 10) = ?
           ORDER BY ec.hour ASC`
        )
        .all(buildingId, todayDate)
    : db
        .prepare(
          `SELECT
             ec.hour,
             ROUND(SUM(ec.consumption_kwh), 2) as consumption_kwh,
             SUM(ec.occupancy_count) as occupancy_count,
             ROUND(AVG(ec.temperature_c), 1) as temperature_c,
             MAX(ec.solar_generation_kwh) as solar_generation_kwh,
             MAX(ec.data_source) as data_source
           FROM energy_consumption ec
           WHERE substr(ec.timestamp, 1, 10) = ?
           GROUP BY ec.hour
           ORDER BY ec.hour ASC`
        )
        .all(todayDate);

  const dailyHistory = buildingId
    ? db
        .prepare(
          `SELECT
             substr(timestamp, 1, 10) as date,
             ROUND(SUM(consumption_kwh), 2) as total_kwh,
             ROUND(MAX(consumption_kwh), 2) as peak_kw
           FROM energy_consumption
           WHERE building_id = ?
           GROUP BY substr(timestamp, 1, 10)
           ORDER BY date DESC
           LIMIT ?`
        )
        .all(buildingId, days)
    : db
        .prepare(
          `SELECT
             substr(timestamp, 1, 10) as date,
             ROUND(SUM(consumption_kwh), 2) as total_kwh,
             ROUND(MAX(consumption_kwh), 2) as peak_kw
           FROM energy_consumption
           GROUP BY substr(timestamp, 1, 10)
           ORDER BY date DESC
           LIMIT ?`
        )
        .all(days);

  res.json({
    today_date: todayDate,
    building_id: buildingId,
    today_hourly: todayHourly,
    daily_history: (dailyHistory as Array<unknown>).reverse(),
  });
});

// ---------------------------------------------------------------------------
// POST /api/energy/data (IoT / Smart Meter Ingestion)
// ---------------------------------------------------------------------------
apiRouter.post('/energy/data', (req: Request, res: Response) => {
  const {
    building_id,
    consumption_kwh,
    occupancy_count = 0,
    temperature_c = 28,
    solar_generation_kwh = 0,
    hour,
    data_source = 'LIVE SENSOR DATA',
  } = req.body as {
    building_id?: number;
    consumption_kwh?: number;
    occupancy_count?: number;
    temperature_c?: number;
    solar_generation_kwh?: number;
    hour?: number;
    data_source?: DataSourceLabel;
  };

  if (!building_id || typeof consumption_kwh !== 'number' || consumption_kwh < 0 || consumption_kwh > 500) {
    res.status(400).json({ error: 'Valid building_id and consumption_kwh (0..500) are required.' });
    return;
  }

  const db = getDb();
  const building = db.prepare('SELECT id, name FROM buildings WHERE id = ?').get(building_id) as
    | { id: number; name: string }
    | undefined;
  if (!building) {
    res.status(404).json({ error: 'Building not found.' });
    return;
  }

  const now = new Date();
  const targetHour = typeof hour === 'number' && hour >= 0 && hour <= 23 ? hour : now.getHours();
  const ts = `${now.toISOString().slice(0, 10)}T${String(targetHour).padStart(2, '0')}:00:00`;
  const sourceLabel: DataSourceLabel =
    data_source === 'LIVE SENSOR DATA' ? 'LIVE SENSOR DATA' : 'SIMULATED DATA';

  const result = db
    .prepare(
      `INSERT INTO energy_consumption
       (building_id, timestamp, hour, day_of_week, month, consumption_kwh, occupancy_count, temperature_c, solar_generation_kwh, data_source, is_holiday)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(
      building_id,
      ts,
      targetHour,
      now.getDay(),
      now.getMonth() + 1,
      Number(consumption_kwh.toFixed(2)),
      Math.max(0, Math.round(occupancy_count)),
      Number(temperature_c),
      Math.max(0, Number(solar_generation_kwh)),
      sourceLabel
    );

  recomputeAIModelsFromDb();

  res.status(201).json({
    ok: true,
    id: result.lastInsertRowid,
    building_name: building.name,
    data_source: sourceLabel,
  });
});

// ---------------------------------------------------------------------------
// GET /api/energy/prediction
// ---------------------------------------------------------------------------
apiRouter.get('/energy/prediction', (_req: Request, res: Response) => {
  let pred = getCachedPrediction();
  if (!pred) {
    pred = recomputeAIModelsFromDb().prediction;
  }
  res.json(pred);
});

// ---------------------------------------------------------------------------
// GET /api/energy/anomalies & POST /api/alerts/:id/resolve
// ---------------------------------------------------------------------------
apiRouter.get('/energy/anomalies', (_req: Request, res: Response) => {
  const db = getDb();
  const alerts = db
    .prepare(
      `SELECT ea.*, b.name as building_name, b.category as building_category
       FROM energy_alerts ea
       JOIN buildings b ON b.id = ea.building_id
       ORDER BY CASE ea.status WHEN 'Active' THEN 1 WHEN 'Acknowledged' THEN 2 ELSE 3 END, ea.anomaly_score DESC`
    )
    .all();

  const summary = db
    .prepare(
      `SELECT
         COUNT(*) as total_alerts,
         SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_alerts,
         SUM(CASE WHEN severity = 'High' THEN 1 ELSE 0 END) as high_severity,
         ROUND(COALESCE(SUM(MAX(0, detected_kwh - expected_kwh)), 0), 2) as total_wastage_kwh
       FROM energy_alerts`
    )
    .get();

  res.json({ alerts, summary });
});

apiRouter.post('/alerts/:id/resolve', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status = 'Resolved' } = req.body as { status?: 'Active' | 'Acknowledged' | 'Resolved' };
  if (!['Active', 'Acknowledged', 'Resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid status value.' });
    return;
  }
  const db = getDb();
  const info = db.prepare('UPDATE energy_alerts SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Alert not found.' });
    return;
  }
  res.json({ ok: true, id, status });
});

// ---------------------------------------------------------------------------
// GET /api/occupancy & POST /api/occupancy/update
// ---------------------------------------------------------------------------
apiRouter.get('/occupancy', (_req: Request, res: Response) => {
  const db = getDb();
  const rooms = db
    .prepare(
      `SELECT o.*, b.name as building_name, b.code as building_code
       FROM occupancy o
       JOIN buildings b ON b.id = o.building_id
       ORDER BY o.room_code ASC`
    )
    .all();
  res.json({
    rooms,
    iot_ready_protocol: {
      mcu: 'ESP32-WROOM-32',
      sensors: ['HC-SR501 PIR Occupancy', 'SCT-013 Current Transformer', 'ZMPT101B AC Voltage'],
      endpoint: 'POST /api/occupancy/update',
    },
  });
});

apiRouter.post('/occupancy/update', (req: Request, res: Response) => {
  const {
    room_code,
    occupant_count,
    lights_on,
    fans_on,
    ac_on,
    computers_on,
    data_source,
  } = req.body as {
    room_code?: string;
    occupant_count?: number;
    lights_on?: number;
    fans_on?: number;
    ac_on?: number;
    computers_on?: number;
    data_source?: DataSourceLabel;
  };

  if (!room_code) {
    res.status(400).json({ error: 'room_code is required.' });
    return;
  }

  const db = getDb();
  const room = db.prepare('SELECT * FROM occupancy WHERE room_code = ?').get(room_code) as
    | {
        id: number;
        room_code: string;
        occupant_count: number;
        capacity: number;
        lights_on: number;
        fans_on: number;
        ac_on: number;
        computers_on: number;
        data_source: DataSourceLabel;
      }
    | undefined;

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  const nextOcc =
    typeof occupant_count === 'number' ? Math.max(0, Math.min(room.capacity, Math.round(occupant_count))) : room.occupant_count;
  const nextLights = typeof lights_on === 'number' ? (lights_on ? 1 : 0) : room.lights_on;
  const nextFans = typeof fans_on === 'number' ? (fans_on ? 1 : 0) : room.fans_on;
  const nextAc = typeof ac_on === 'number' ? (ac_on ? 1 : 0) : room.ac_on;
  const nextComputers =
    typeof computers_on === 'number' ? Math.max(0, Math.round(computers_on)) : room.computers_on;

  const hasAppliancesOn = nextLights === 1 || nextFans === 1 || nextAc === 1 || nextComputers > 2;
  const nextStatus = nextOcc > 0 ? 'Occupied' : hasAppliancesOn ? 'Standby' : 'Empty';
  const nextLoadKw = Number(
    (nextLights * 1.4 + nextFans * 0.9 + nextAc * 4.8 + nextComputers * 0.22 + (nextOcc > 0 ? 0.5 : 0)).toFixed(2)
  );
  const nextSource: DataSourceLabel =
    data_source === 'LIVE SENSOR DATA' ? 'LIVE SENSOR DATA' : room.data_source;

  db.prepare(
    `UPDATE occupancy
     SET status = ?, occupant_count = ?, lights_on = ?, fans_on = ?, ac_on = ?, computers_on = ?, current_load_kw = ?, data_source = ?, updated_at = datetime('now')
     WHERE room_code = ?`
  ).run(
    nextStatus,
    nextOcc,
    nextLights,
    nextFans,
    nextAc,
    nextComputers,
    nextLoadKw,
    nextSource,
    room_code
  );

  const updated = db
    .prepare(
      `SELECT o.*, b.name as building_name
       FROM occupancy o JOIN buildings b ON b.id = o.building_id
       WHERE o.room_code = ?`
    )
    .get(room_code);

  res.json({ ok: true, room: updated });
});

// ---------------------------------------------------------------------------
// GET /api/solar
// ---------------------------------------------------------------------------
apiRouter.get('/solar', (_req: Request, res: Response) => {
  const db = getDb();
  const hourly = db.prepare('SELECT * FROM solar_generation ORDER BY hour ASC').all() as Array<{
    hour: number;
    weather_condition: WeatherCondition;
    irradiance_wm2: number;
    generated_kwh: number;
    consumed_direct_kwh: number;
    excess_kwh: number;
    battery_charged_kwh: number;
    grid_import_kwh: number;
    data_source: DataSourceLabel;
  }>;

  const sim = db.prepare('SELECT weather_condition, data_source FROM simulation_state WHERE id = 1').get() as {
    weather_condition: WeatherCondition;
    data_source: DataSourceLabel;
  };

  const totals = hourly.reduce(
    (acc, r) => {
      acc.total_generated_kwh += r.generated_kwh;
      acc.total_consumed_direct_kwh += r.consumed_direct_kwh;
      acc.total_excess_kwh += r.excess_kwh;
      acc.total_battery_charged_kwh += r.battery_charged_kwh;
      acc.total_grid_import_kwh += r.grid_import_kwh;
      return acc;
    },
    {
      total_generated_kwh: 0,
      total_consumed_direct_kwh: 0,
      total_excess_kwh: 0,
      total_battery_charged_kwh: 0,
      total_grid_import_kwh: 0,
    }
  );

  const utilized = totals.total_consumed_direct_kwh + totals.total_battery_charged_kwh;
  const utilizationPct =
    totals.total_generated_kwh > 0
      ? Math.min(100, Number(((utilized / totals.total_generated_kwh) * 100).toFixed(1)))
      : 0;

  res.json({
    weather_condition: sim.weather_condition,
    data_source: sim.data_source,
    pv_array_capacity_kwp: 115,
    totals: {
      total_generated_kwh: Number(totals.total_generated_kwh.toFixed(2)),
      total_consumed_direct_kwh: Number(totals.total_consumed_direct_kwh.toFixed(2)),
      total_excess_kwh: Number(totals.total_excess_kwh.toFixed(2)),
      total_battery_charged_kwh: Number(totals.total_battery_charged_kwh.toFixed(2)),
      total_grid_import_kwh: Number(totals.total_grid_import_kwh.toFixed(2)),
      solar_utilization_pct: utilizationPct,
    },
    hourly,
  });
});

// ---------------------------------------------------------------------------
// GET /api/battery & POST /api/battery/schedule
// ---------------------------------------------------------------------------
apiRouter.get('/battery', (_req: Request, res: Response) => {
  const db = getDb();
  const statusRows = db.prepare('SELECT * FROM battery_status ORDER BY id ASC').all();
  let optimization = getCachedBatteryOptimization();
  if (!optimization) {
    optimization = recomputeAIModelsFromDb().optimization;
  }
  res.json({
    hardware_notice:
      'Calculated battery dispatch model. Physical inverter relays remain isolated unless connected via verified Modbus/ESP32 controller.',
    hourly_telemetry: statusRows,
    optimization,
  });
});

apiRouter.post('/battery/schedule', (req: Request, res: Response) => {
  const {
    capacity_kwh,
    initial_soc_pct,
    min_soc_pct,
    max_soc_pct,
    max_charge_kw,
    max_discharge_kw,
    efficiency_pct,
  } = req.body as Record<string, number | undefined>;

  const db = getDb();
  const sim = db
    .prepare('SELECT tariff_offpeak_inr, tariff_standard_inr, tariff_peak_inr, data_source FROM simulation_state WHERE id = 1')
    .get() as {
    tariff_offpeak_inr: number;
    tariff_standard_inr: number;
    tariff_peak_inr: number;
    data_source: DataSourceLabel;
  };

  let pred = getCachedPrediction();
  if (!pred) pred = recomputeAIModelsFromDb().prediction;

  const demand24 = pred.hourly_forecast.map((p) => p.actual_kwh ?? p.predicted_kwh);
  const solar24 = pred.hourly_forecast.map((p) => p.solar_kwh);

  const result = optimizeBatterySchedule({
    hourly_demand_kwh: demand24,
    hourly_solar_kwh: solar24,
    capacity_kwh,
    initial_soc_pct,
    min_soc_pct,
    max_soc_pct,
    max_charge_kw,
    max_discharge_kw,
    efficiency_pct,
    tariff_offpeak_inr: sim.tariff_offpeak_inr,
    tariff_standard_inr: sim.tariff_standard_inr,
    tariff_peak_inr: sim.tariff_peak_inr,
    data_source: sim.data_source,
  });

  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /api/optimization & POST /api/optimization/recommend
// ---------------------------------------------------------------------------
apiRouter.get('/optimization', (_req: Request, res: Response) => {
  const db = getDb();
  const recommendations = db
    .prepare(
      `SELECT r.*, b.name as building_name
       FROM optimization_recommendations r
       LEFT JOIN buildings b ON b.id = r.building_id
       ORDER BY CASE r.status WHEN 'Pending' THEN 1 WHEN 'Approved' THEN 2 ELSE 3 END, r.estimated_savings_inr DESC`
    )
    .all();

  let optimization = getCachedBatteryOptimization();
  if (!optimization) {
    optimization = recomputeAIModelsFromDb().optimization;
  }

  res.json({
    recommendations,
    battery_optimization_summary: optimization.summary,
  });
});

apiRouter.post('/optimization/recommend', (req: Request, res: Response) => {
  const { id, action } = req.body as {
    id?: number;
    action?: 'Approve' | 'Reject' | 'Reset' | 'Generate';
  };
  const db = getDb();

  if (action === 'Generate') {
    db.prepare('DELETE FROM optimization_recommendations').run();
    recomputeAIModelsFromDb();
    const recommendations = db
      .prepare(
        `SELECT r.*, b.name as building_name
         FROM optimization_recommendations r
         LEFT JOIN buildings b ON b.id = r.building_id`
      )
      .all();
    res.json({ ok: true, recommendations });
    return;
  }

  if (!id || !action || !['Approve', 'Reject', 'Reset'].includes(action)) {
    res.status(400).json({ error: 'Valid recommendation id and action (Approve | Reject | Reset | Generate) required.' });
    return;
  }

  const nextStatus = action === 'Approve' ? 'Approved' : action === 'Reject' ? 'Rejected' : 'Pending';
  const info = db
    .prepare('UPDATE optimization_recommendations SET status = ? WHERE id = ?')
    .run(nextStatus, id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'Recommendation not found.' });
    return;
  }

  const updated = db
    .prepare(
      `SELECT r.*, b.name as building_name
       FROM optimization_recommendations r
       LEFT JOIN buildings b ON b.id = r.building_id
       WHERE r.id = ?`
    )
    .get(id);

  res.json({ ok: true, recommendation: updated });
});

// ---------------------------------------------------------------------------
// GET /api/reports & GET /api/reports/export (CSV)
// ---------------------------------------------------------------------------
apiRouter.get('/reports', (_req: Request, res: Response) => {
  const db = getDb();
  const dailyReport = db
    .prepare(
      `SELECT
         substr(timestamp, 1, 10) as date,
         ROUND(SUM(consumption_kwh), 2) as consumption_kwh,
         ROUND(MAX(consumption_kwh), 2) as peak_kw,
         ROUND(AVG(solar_generation_kwh) * 13, 2) as est_solar_kwh
       FROM energy_consumption
       GROUP BY substr(timestamp, 1, 10)
       ORDER BY date DESC
       LIMIT 15`
    )
    .all();

  const buildingComparison = db
    .prepare(
      `SELECT
         b.code,
         b.name,
         b.category,
         b.baseline_daily_kwh,
         ROUND(SUM(ec.consumption_kwh) / COUNT(DISTINCT substr(ec.timestamp, 1, 10)), 2) as avg_daily_kwh,
         ROUND(SUM(ec.consumption_kwh), 2) as period_total_kwh,
         ROUND(MAX(ec.consumption_kwh), 2) as max_hourly_kw
       FROM buildings b
       JOIN energy_consumption ec ON ec.building_id = b.id
       GROUP BY b.id
       ORDER BY period_total_kwh DESC`
    )
    .all();

  const wastageSummary = db
    .prepare(
      `SELECT
         b.name as building_name,
         COUNT(ea.id) as alert_count,
         ROUND(SUM(MAX(0, ea.detected_kwh - ea.expected_kwh)), 2) as wastage_kwh
       FROM energy_alerts ea
       JOIN buildings b ON b.id = ea.building_id
       GROUP BY b.id`
    )
    .all();

  const opt = getCachedBatteryOptimization() ?? recomputeAIModelsFromDb().optimization;
  const solarRows = db.prepare('SELECT * FROM solar_generation').all() as Array<{
    generated_kwh: number;
    consumed_direct_kwh: number;
    battery_charged_kwh: number;
    grid_import_kwh: number;
  }>;
  const solarSum = solarRows.reduce(
    (acc, r) => {
      acc.generated_kwh += r.generated_kwh;
      acc.direct_kwh += r.consumed_direct_kwh;
      acc.battery_charged_kwh += r.battery_charged_kwh;
      acc.grid_import_kwh += r.grid_import_kwh;
      return acc;
    },
    { generated_kwh: 0, direct_kwh: 0, battery_charged_kwh: 0, grid_import_kwh: 0 }
  );

  res.json({
    daily_report: (dailyReport as Array<unknown>).reverse(),
    building_comparison: buildingComparison,
    wastage_report: wastageSummary,
    solar_contribution: {
      generated_kwh: Number(solarSum.generated_kwh.toFixed(2)),
      direct_kwh: Number(solarSum.direct_kwh.toFixed(2)),
      battery_charged_kwh: Number(solarSum.battery_charged_kwh.toFixed(2)),
      grid_import_kwh: Number(solarSum.grid_import_kwh.toFixed(2)),
    },
    battery_performance: opt.summary,
  });
});

apiRouter.get('/reports/export', (req: Request, res: Response) => {
  const reportType = (req.query.type as string) || 'consumption';
  const db = getDb();

  let csv = '';
  let filename = `energysync_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;

  if (reportType === 'anomalies') {
    const rows = db
      .prepare(
        `SELECT ea.timestamp, b.name as building_name, ea.detected_kwh, ea.expected_kwh, ea.anomaly_score, ea.severity, ea.status, ea.reason, ea.suggested_action, ea.data_source
         FROM energy_alerts ea JOIN buildings b ON b.id = ea.building_id ORDER BY ea.anomaly_score DESC`
      )
      .all() as Array<Record<string, string | number>>;
    csv = [
      'timestamp,building_name,detected_kwh,expected_kwh,anomaly_score,severity,status,reason,suggested_action,data_source',
      ...rows.map(
        (r) =>
          `"${r.timestamp}","${r.building_name}",${r.detected_kwh},${r.expected_kwh},${r.anomaly_score},${r.severity},${r.status},"${String(r.reason).replace(/"/g, '""')}","${String(r.suggested_action).replace(/"/g, '""')}",${r.data_source}`
      ),
    ].join('\n');
  } else if (reportType === 'battery') {
    const opt = getCachedBatteryOptimization() ?? recomputeAIModelsFromDb().optimization;
    csv = [
      'hour,demand_kwh,solar_kwh,tariff_inr,tariff_tier,baseline_action,baseline_soc_pct,baseline_cost_inr,optimized_action,battery_flow_kw,optimized_soc_pct,optimized_grid_kwh,optimized_cost_inr',
      ...opt.schedule.map(
        (s) =>
          `${s.label},${s.demand_kwh},${s.solar_kwh},${s.tariff_inr},${s.tariff_tier},${s.baseline_action},${s.baseline_soc_pct},${s.baseline_cost_inr},${s.optimized_action},${s.battery_flow_kw},${s.optimized_soc_pct},${s.optimized_grid_kwh},${s.optimized_cost_inr}`
      ),
    ].join('\n');
  } else {
    const rows = db
      .prepare(
        `SELECT ec.timestamp, b.code, b.name as building_name, ec.hour, ec.consumption_kwh, ec.occupancy_count, ec.temperature_c, ec.solar_generation_kwh, ec.is_holiday, ec.data_source
         FROM energy_consumption ec JOIN buildings b ON b.id = ec.building_id
         ORDER BY ec.timestamp DESC LIMIT 500`
      )
      .all() as Array<Record<string, string | number>>;
    csv = [
      'timestamp,building_code,building_name,hour,consumption_kwh,occupancy_count,temperature_c,solar_generation_kwh,is_holiday,data_source',
      ...rows.map(
        (r) =>
          `${r.timestamp},${r.code},"${r.building_name}",${r.hour},${r.consumption_kwh},${r.occupancy_count},${r.temperature_c},${r.solar_generation_kwh},${r.is_holiday},${r.data_source}`
      ),
    ].join('\n');
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// ---------------------------------------------------------------------------
// POST /api/simulation/run & POST /api/simulation/reset & Settings
// ---------------------------------------------------------------------------
apiRouter.post('/simulation/run', (req: Request, res: Response) => {
  const { scenario_name, weather_condition, is_holiday, inject_anomaly } = req.body as {
    scenario_name?: string;
    weather_condition?: WeatherCondition;
    is_holiday?: boolean;
    inject_anomaly?: boolean;
  };

  if (
    weather_condition &&
    !['Clear Sunny', 'Partly Cloudy', 'Monsoon Overcast'].includes(weather_condition)
  ) {
    res.status(400).json({ error: 'Invalid weather_condition.' });
    return;
  }

  const outcome = runEnergySimulation({
    scenario_name,
    weather_condition,
    is_holiday,
    inject_anomaly,
  });

  res.json({
    ok: true,
    message: 'Simulation executed across SQLite telemetry, Random Forest, Isolation Forest, and Battery Optimizer.',
    mae: outcome.prediction.mae,
    rmse: outcome.prediction.rmse,
    anomalies_detected: outcome.anomalies_detected,
    estimated_cost_savings_inr: outcome.optimization.summary.estimated_cost_savings_inr,
  });
});

apiRouter.post('/simulation/reset', (_req: Request, res: Response) => {
  const outcome = resetEnergySimulation();
  res.json({
    ok: true,
    message: 'Demonstration dataset and ML pipeline restored to baseline state.',
    mae: outcome.prediction.mae,
    rmse: outcome.prediction.rmse,
    anomalies_detected: outcome.anomalies_detected,
  });
});

apiRouter.get('/settings', (_req: Request, res: Response) => {
  const db = getDb();
  const sim = db.prepare('SELECT * FROM simulation_state WHERE id = 1').get();
  res.json({ simulation_state: sim });
});

apiRouter.post('/settings', (req: Request, res: Response) => {
  const { weather_condition, is_holiday, tariff_offpeak_inr, tariff_standard_inr, tariff_peak_inr } =
    req.body as {
      weather_condition?: WeatherCondition;
      is_holiday?: boolean;
      tariff_offpeak_inr?: number;
      tariff_standard_inr?: number;
      tariff_peak_inr?: number;
    };

  const db = getDb();
  const current = db.prepare('SELECT * FROM simulation_state WHERE id = 1').get() as {
    weather_condition: WeatherCondition;
    is_holiday: number;
    tariff_offpeak_inr: number;
    tariff_standard_inr: number;
    tariff_peak_inr: number;
  };

  const nextWeather = weather_condition ?? current.weather_condition;
  const nextHoliday = typeof is_holiday === 'boolean' ? (is_holiday ? 1 : 0) : current.is_holiday;
  const nextOff = typeof tariff_offpeak_inr === 'number' ? Math.max(1, tariff_offpeak_inr) : current.tariff_offpeak_inr;
  const nextStd = typeof tariff_standard_inr === 'number' ? Math.max(1, tariff_standard_inr) : current.tariff_standard_inr;
  const nextPeak = typeof tariff_peak_inr === 'number' ? Math.max(1, tariff_peak_inr) : current.tariff_peak_inr;

  db.prepare(
    `UPDATE simulation_state
     SET weather_condition = ?, is_holiday = ?, tariff_offpeak_inr = ?, tariff_standard_inr = ?, tariff_peak_inr = ?
     WHERE id = 1`
  ).run(nextWeather, nextHoliday, nextOff, nextStd, nextPeak);

  recomputeAIModelsFromDb();
  const updated = db.prepare('SELECT * FROM simulation_state WHERE id = 1').get();
  res.json({ ok: true, simulation_state: updated });
});
