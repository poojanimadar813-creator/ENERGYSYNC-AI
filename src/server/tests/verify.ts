import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getDb } from '../db/database.ts';
import { seedDatabaseIfEmpty, runEnergySimulation } from '../services/simulationService.ts';
import { optimizeBatterySchedule } from '../ai/batteryOptimization.ts';
import { hashPassword, verifyPassword } from '../auth/auth.ts';
import { apiRouter } from '../routes/api.ts';

async function runTests() {
  console.log('=== ENERGYSYNC AI Verification Suite ===');

  // 1. Auth hashing check
  const pwHash = hashPassword('EnergySync@2026');
  assert.equal(verifyPassword('EnergySync@2026', pwHash), true, 'Valid password must verify');
  assert.equal(verifyPassword('WrongPass', pwHash), false, 'Invalid password must fail');
  console.log('[PASS] Salted scrypt password hashing');

  // 2. Database schema & seeding check
  seedDatabaseIfEmpty();
  const db = getDb();
  const tables = [
    'users',
    'buildings',
    'energy_consumption',
    'occupancy',
    'solar_generation',
    'battery_status',
    'energy_alerts',
    'ai_predictions',
    'optimization_recommendations',
  ];
  for (const tbl of tables) {
    const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${tbl}`).get() as { cnt: number };
    assert.ok(row.cnt > 0, `Table ${tbl} should be populated`);
  }
  console.log('[PASS] All 9 SQLite tables initialized and populated');

  // 3. ML Models & Simulation run check
  const simOut = runEnergySimulation({
    weather_condition: 'Clear Sunny',
    is_holiday: false,
    inject_anomaly: true,
  });
  assert.ok(simOut.prediction.mae > 0 && simOut.prediction.mae < 150, 'Random Forest MAE should be bounded');
  assert.ok(simOut.prediction.rmse >= simOut.prediction.mae, 'RMSE must be >= MAE');
  assert.equal(simOut.prediction.hourly_forecast.length, 24, 'Forecast must cover 24 hours');
  assert.ok(simOut.anomalies_detected >= 1, 'Isolation Forest must detect injected wastage anomalies');
  console.log(
    `[PASS] Random Forest (MAE=${simOut.prediction.mae} kWh, RMSE=${simOut.prediction.rmse} kWh) & Isolation Forest (${simOut.anomalies_detected} anomalies)`
  );

  // 4. Battery Optimizer Physical Constraints Check
  const demand24 = Array.from({ length: 24 }, (_, h) => (h >= 9 && h <= 18 ? 110 : 35));
  const solar24 = Array.from({ length: 24 }, (_, h) =>
    h >= 7 && h <= 17 ? Math.round(95 * Math.sin(((h - 6) * Math.PI) / 12)) : 0
  );
  const batRes = optimizeBatterySchedule({
    hourly_demand_kwh: demand24,
    hourly_solar_kwh: solar24,
    capacity_kwh: 200,
    initial_soc_pct: 50,
    min_soc_pct: 15,
    max_soc_pct: 95,
    max_charge_kw: 45,
    max_discharge_kw: 45,
    efficiency_pct: 94,
  });

  for (const hr of batRes.schedule) {
    assert.ok(hr.optimized_soc_pct >= 14.9 && hr.optimized_soc_pct <= 95.1, 'SOC must respect min/max bounds');
    assert.ok(Math.abs(hr.battery_flow_kw) <= 45.01, 'Power flow must respect max charge/discharge kW');
  }
  assert.ok(
    batRes.summary.optimized_cost_inr <= batRes.summary.baseline_cost_inr,
    'Optimized schedule cost must be <= naive baseline cost'
  );
  console.log(
    `[PASS] Battery Optimizer constraints & savings (Baseline ₹${batRes.summary.baseline_cost_inr} -> Optimized ₹${batRes.summary.optimized_cost_inr})`
  );

  // 5. Express API Integration Check
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Unauthenticated access should return 401
    const unauthRes = await fetch(`${baseUrl}/api/dashboard`);
    assert.equal(unauthRes.status, 401, 'Protected route must reject unauthenticated calls');

    // Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@bldea-energysync.edu',
        password: 'EnergySync@2026',
      }),
    });
    assert.equal(loginRes.status, 200, 'Admin login should succeed');
    const loginData = (await loginRes.json()) as {
      token: string;
      user: { role: string; college?: string; district?: string };
    };
    assert.ok(loginData.user.college, 'User should include college');
    assert.ok(loginData.user.district, 'User should include district');
    const authHeaders = { Authorization: `Bearer ${loginData.token}`, 'Content-Type': 'application/json' };

    const endpoints = [
      '/api/dashboard',
      '/api/buildings',
      '/api/energy/consumption',
      '/api/energy/prediction',
      '/api/energy/anomalies',
      '/api/occupancy',
      '/api/solar',
      '/api/battery',
      '/api/optimization',
      '/api/reports',
      '/api/docs',
      '/api/state/dashboard',
      '/api/state/colleges',
      '/api/state/districts',
      '/api/state/analytics',
      '/api/state/reports',
    ];
    for (const ep of endpoints) {
      const r = await fetch(`${baseUrl}${ep}`, { headers: authHeaders });
      assert.equal(r.status, 200, `GET ${ep} must return 200`);
    }

    // Add College check (then clean up test record)
    const addColRes = await fetch(`${baseUrl}/api/state/colleges`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'TEST-KA-01',
        name: 'Test Karnataka Engineering Campus',
        district_id: 1,
        city: 'Vijayapura',
        solar_capacity_kwp: 110,
        battery_capacity_kwh: 180,
      }),
    });
    assert.equal(addColRes.status, 201, 'POST /api/state/colleges must create college');
    db.prepare("DELETE FROM colleges WHERE code = 'TEST-KA-01'").run();

    // CSV Export checks (Campus & Statewide)
    const csvRes = await fetch(`${baseUrl}/api/reports/export?type=battery`, { headers: authHeaders });
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes('optimized_action'), 'CSV export must contain battery schedule headers');

    const stateCsvRes = await fetch(`${baseUrl}/api/state/reports/export?scope=districts`, {
      headers: authHeaders,
    });
    assert.equal(stateCsvRes.status, 200);
    const stateCsvText = await stateCsvRes.text();
    assert.ok(stateCsvText.includes('district_code'), 'Statewide CSV must contain district headers');

    // Advanced endpoints & Rate Limiter headers
    const advancedGets = [
      '/api/advanced/digital-twin',
      '/api/advanced/peak-load',
      '/api/advanced/maintenance',
      '/api/advanced/weather-forecast?weather=Clear%20Sunny&temp=32&cloud=15',
      '/api/advanced/notifications',
      '/api/advanced/carbon',
      '/api/advanced/leaderboard',
      '/api/advanced/reliability',
      '/api/advanced/privacy-check',
    ];
    for (const ep of advancedGets) {
      const r = await fetch(`${baseUrl}${ep}`, { headers: authHeaders });
      assert.equal(r.status, 200, `GET ${ep} must return 200`);
      assert.ok(r.headers.get('X-RateLimit-Limit'), `GET ${ep} must include X-RateLimit-Limit header`);
    }

    // Sensor bounds validation (should return 400 on invalid weather temp)
    const badWeather = await fetch(`${baseUrl}/api/advanced/weather-forecast?weather=Clear%20Sunny&temp=95&cloud=10`, {
      headers: authHeaders,
    });
    assert.equal(badWeather.status, 400, 'Out-of-bounds weather temperature must be rejected with 400');

    // Green Leaderboard normalization check (must expose kwh_per_student and composite_green_score)
    const lbRes = await fetch(`${baseUrl}/api/advanced/leaderboard`, { headers: authHeaders });
    const lbJson = (await lbRes.json()) as {
      leaderboard: Array<{ kwh_per_student: number; composite_green_score: number; rank: number }>;
    };
    assert.ok(lbJson.leaderboard.length > 0 && lbJson.leaderboard[0].kwh_per_student > 0);
    assert.ok(lbJson.leaderboard[0].rank === 1);

    // Peak load shift toggle & restore
    const peakRes = await fetch(`${baseUrl}/api/advanced/peak-load`, { headers: authHeaders });
    const peakJson = (await peakRes.json()) as {
      flexible_loads: Array<{ id: number; status: 'Deferred' | 'Scheduled Peak' }>;
    };
    const firstLoad = peakJson.flexible_loads[0];
    const toggledStatus = firstLoad.status === 'Deferred' ? 'Scheduled Peak' : 'Deferred';
    const shiftRes = await fetch(`${baseUrl}/api/advanced/peak-load/shift`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id: firstLoad.id, status: toggledStatus }),
    });
    assert.equal(shiftRes.status, 200, 'Peak load shift toggle must return 200');
    await fetch(`${baseUrl}/api/advanced/peak-load/shift`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id: firstLoad.id, status: firstLoad.status }),
    });

    // Backup & verify snapshot
    const backupRes = await fetch(`${baseUrl}/api/advanced/backup`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(backupRes.status, 201, 'SQLite backup creation must return 201');
    const backupJson = (await backupRes.json()) as { snapshot: { filename: string } };
    const verifyRes = await fetch(`${baseUrl}/api/advanced/backup/verify`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ filename: backupJson.snapshot.filename }),
    });
    assert.equal(verifyRes.status, 200, 'SQLite backup verification must return 200');

    // Offline buffer + validation + auto-sync
    const badBuffer = await fetch(`${baseUrl}/api/advanced/offline-buffer`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ device_id: 'BAD-NODE', building_id: 1, consumption_kwh: 9999 }),
    });
    assert.equal(badBuffer.status, 400, 'Out-of-bounds buffered kWh must be rejected with 400');

    const okBuffer = await fetch(`${baseUrl}/api/advanced/offline-buffer`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        device_id: 'TEST-ESP32',
        building_id: 1,
        consumption_kwh: 24.5,
        occupancy_count: 35,
        temperature_c: 29,
      }),
    });
    assert.equal(okBuffer.status, 201, 'Valid offline buffer insert must return 201');
    const syncRes = await fetch(`${baseUrl}/api/advanced/sync-buffer`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(syncRes.status, 200, 'Buffer sync must return 200');

    // Reliability migrations & audit log presence check
    const relRes = await fetch(`${baseUrl}/api/advanced/reliability`, { headers: authHeaders });
    const relJson = (await relRes.json()) as {
      migrations: Array<{ version: string }>;
      audit_logs: Array<{ action: string }>;
      model_metrics_history: Array<{ mae: number }>;
    };
    assert.ok(relJson.migrations.length >= 3, 'Versioned migrations must be recorded');
    assert.ok(relJson.audit_logs.length > 0, 'Audit logs must record actions');
    assert.ok(relJson.model_metrics_history.length > 0, 'Model metrics history must be tracked');

    console.log('[PASS] All Campus, Karnataka Statewide & Advanced Reliability API endpoints verified');
  } finally {
    server.close();
  }

  console.log('=== ALL TESTS PASSED ===');
}

runTests().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
