import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/database.ts';
import type { AuthenticatedRequest } from '../auth/auth.ts';
import {
  computeWeatherAdjustedForecast,
  getCarbonSummary,
  getDigitalTwinState,
  getGreenLeaderboard,
  getMaintenanceList,
  getNotificationsList,
  getPeakLoadPlan,
  getReliabilityOverview,
  syncSmartNotifications,
} from '../services/advancedService.ts';
import {
  createDatabaseBackup,
  recordAuditLog,
  verifyBackupSnapshot,
} from '../middleware/reliability.ts';
import { recomputeAIModelsFromDb } from '../services/simulationService.ts';
import type { WeatherCondition } from '../../types/energy.ts';

export const advancedRouter = Router();

// 1. Smart Campus Digital Twin
advancedRouter.get('/digital-twin', (_req: Request, res: Response) => {
  res.json(getDigitalTwinState());
});

// 2. Smart Peak Load Management
advancedRouter.get('/peak-load', (_req: Request, res: Response) => {
  res.json(getPeakLoadPlan());
});

advancedRouter.post('/peak-load/shift', (req: Request, res: Response) => {
  const { id, status } = req.body as { id?: number; status?: 'Deferred' | 'Scheduled Peak' };
  if (!id || !status || !['Deferred', 'Scheduled Peak'].includes(status)) {
    res.status(400).json({ error: 'Valid load shift id and status (Deferred | Scheduled Peak) required.' });
    return;
  }
  const db = getDb();
  const info = db.prepare('UPDATE load_shifts SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Flexible load item not found.' });
    return;
  }
  res.json({ ok: true, plan: getPeakLoadPlan() });
});

// 3. Predictive Maintenance
advancedRouter.get('/maintenance', (_req: Request, res: Response) => {
  res.json({ diagnostics: getMaintenanceList() });
});

advancedRouter.post('/maintenance/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status?: 'Open' | 'Scheduled' | 'Resolved' };
  if (!status || !['Open', 'Scheduled', 'Resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid maintenance status.' });
    return;
  }
  const db = getDb();
  const info = db.prepare('UPDATE maintenance_issues SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Maintenance record not found.' });
    return;
  }
  res.json({ ok: true, diagnostics: getMaintenanceList() });
});

// 4. Weather-Based Energy Prediction
advancedRouter.get('/weather-forecast', (req: Request, res: Response) => {
  const weather = (req.query.weather as WeatherCondition) || 'Clear Sunny';
  const temp = Number(req.query.temp) || 30;
  const cloud = Number(req.query.cloud) >= 0 ? Number(req.query.cloud) : 15;

  if (!['Clear Sunny', 'Partly Cloudy', 'Monsoon Overcast'].includes(weather)) {
    res.status(400).json({ error: 'Invalid weather condition.' });
    return;
  }
  if (temp < -10 || temp > 65 || cloud < 0 || cloud > 100) {
    res.status(400).json({ error: 'Temperature [-10..65] and cloud cover [0..100] out of valid sensor bounds.' });
    return;
  }

  res.json(
    computeWeatherAdjustedForecast({
      weather_condition: weather,
      temperature_c: temp,
      cloud_cover_pct: cloud,
    })
  );
});

// 5. Smart Notification System
advancedRouter.get('/notifications', (_req: Request, res: Response) => {
  syncSmartNotifications();
  const notifications = getNotificationsList();
  const unreadCount = notifications.filter((n) => n.is_read === 0).length;
  res.json({ notifications, unread_count: unreadCount });
});

advancedRouter.post('/notifications/read', (req: Request, res: Response) => {
  const { id, all } = req.body as { id?: number; all?: boolean };
  const db = getDb();
  if (all) {
    db.prepare('UPDATE notifications SET is_read = 1').run();
  } else if (id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  }
  const notifications = getNotificationsList();
  res.json({
    ok: true,
    notifications,
    unread_count: notifications.filter((n) => n.is_read === 0).length,
  });
});

// 6. Carbon Footprint Calculator & Energy Formulas
advancedRouter.get('/carbon', (_req: Request, res: Response) => {
  res.json(getCarbonSummary());
});

// 7. Karnataka Green Campus Leaderboard
advancedRouter.get('/leaderboard', (_req: Request, res: Response) => {
  res.json({
    methodology:
      'Ranked by normalized kWh/student intensity, Renewable Energy %, wastage reduction, battery efficiency, CO₂ avoided, and period-over-period improvement.',
    leaderboard: getGreenLeaderboard(),
  });
});

// 8. System Reliability, Backup & Recovery, Offline Buffer Sync, Audit Logs, Privacy Check
advancedRouter.get('/reliability', (_req: Request, res: Response) => {
  res.json(getReliabilityOverview());
});

advancedRouter.post('/backup', async (req: AuthenticatedRequest, res: Response) => {
  const snapshot = await createDatabaseBackup();
  recordAuditLog({
    actorEmail: req.user?.email ?? 'admin',
    actorRole: req.user?.role ?? 'Administrator',
    action: 'BACKUP',
    resource: '/api/advanced/backup',
    details: `Created SQLite snapshot ${snapshot.filename} (${snapshot.size_kb} KB)`,
    ipAddress: req.ip,
  });
  res.status(201).json({ ok: true, snapshot });
});

advancedRouter.post('/backup/verify', (req: Request, res: Response) => {
  const { filename } = req.body as { filename?: string };
  if (!filename) {
    res.status(400).json({ error: 'Snapshot filename required.' });
    return;
  }
  try {
    const verification = verifyBackupSnapshot(filename);
    res.json({ ok: true, verification });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Snapshot not found.' });
  }
});

// Offline Buffering & Automatic Synchronization
advancedRouter.post('/offline-buffer', (req: Request, res: Response) => {
  const { device_id, building_id, consumption_kwh, occupancy_count = 10, temperature_c = 28 } =
    req.body as {
      device_id?: string;
      building_id?: number;
      consumption_kwh?: number;
      occupancy_count?: number;
      temperature_c?: number;
    };

  if (
    !device_id ||
    !building_id ||
    typeof consumption_kwh !== 'number' ||
    consumption_kwh < 0 ||
    consumption_kwh > 500 ||
    temperature_c < -10 ||
    temperature_c > 65
  ) {
    res.status(400).json({
      error: 'Sensor validation failed: consumption_kwh must be 0..500 and temperature_c -10..65.',
    });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO offline_buffer (device_id, building_id, consumption_kwh, occupancy_count, temperature_c, synced)
       VALUES (?, ?, ?, ?, ?, 0)`
    )
    .run(device_id.trim(), Number(building_id), consumption_kwh, Math.max(0, occupancy_count), temperature_c);

  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

advancedRouter.post('/sync-buffer', (_req: Request, res: Response) => {
  const db = getDb();
  const pending = db
    .prepare('SELECT * FROM offline_buffer WHERE synced = 0 ORDER BY id ASC')
    .all() as Array<{
    id: number;
    building_id: number;
    consumption_kwh: number;
    occupancy_count: number;
    temperature_c: number;
    captured_at: string;
  }>;

  if (pending.length === 0) {
    res.json({ ok: true, synced_count: 0, message: 'No pending buffered readings to synchronize.' });
    return;
  }

  const now = new Date();
  const hour = now.getHours();
  const insEnergy = db.prepare(
    `INSERT INTO energy_consumption
     (building_id, timestamp, hour, day_of_week, month, consumption_kwh, occupancy_count, temperature_c, solar_generation_kwh, data_source, is_holiday)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'LIVE SENSOR DATA', 0)`
  );
  const markSynced = db.prepare(
    `UPDATE offline_buffer SET synced = 1, synced_at = datetime('now') WHERE id = ?`
  );

  const tx = db.transaction(() => {
    for (const row of pending) {
      const ts = `${now.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00`;
      insEnergy.run(
        row.building_id,
        ts,
        hour,
        now.getDay(),
        now.getMonth() + 1,
        row.consumption_kwh,
        row.occupancy_count,
        row.temperature_c
      );
      markSynced.run(row.id);
    }
  });
  tx();
  recomputeAIModelsFromDb();

  res.json({
    ok: true,
    synced_count: pending.length,
    message: `Synchronized ${pending.length} buffered sensor reading(s) into live SQLite telemetry.`,
  });
});

// Data Privacy & College Isolation Check
advancedRouter.get('/privacy-check', (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const userCollege = (
    db.prepare('SELECT college, district FROM users WHERE id = ?').get(req.user!.userId) as
      | { college?: string; district?: string }
      | undefined
  )?.college;

  const scopedCollege = userCollege
    ? db.prepare('SELECT id, code, name, city FROM colleges WHERE name = ?').get(userCollege)
    : null;

  res.json({
    authenticated_actor: req.user!.email,
    role: req.user!.role,
    assigned_college: userCollege ?? 'BLDEACET Vijayapura',
    scoped_college_record: scopedCollege,
    cross_college_write_isolated: req.user!.role === 'Administrator',
  });
});
