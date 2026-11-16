import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/database.ts';
import {
  getDistrictAnalyticsRows,
  getDistrictsList,
  getStateDashboardSummary,
  getStatewideReportsSummary,
  syncPrimaryCampusToStatewide,
} from '../services/statewideService.ts';
import type { CollegeRecord } from '../../types/energy.ts';

export const statewideRouter = Router();

// GET /api/state/dashboard
statewideRouter.get('/dashboard', (_req: Request, res: Response) => {
  const summary = getStateDashboardSummary();
  res.json(summary);
});

// GET /api/state/colleges
statewideRouter.get('/colleges', (req: Request, res: Response) => {
  syncPrimaryCampusToStatewide();
  const db = getDb();
  const districtId = req.query.district_id ? Number(req.query.district_id) : null;
  const status = typeof req.query.status === 'string' && req.query.status !== 'All' ? req.query.status : null;
  const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  let rows = db
    .prepare(
      `SELECT c.*, d.name as district_name, d.code as district_code
       FROM colleges c
       JOIN districts d ON d.id = c.district_id
       ORDER BY c.name ASC`
    )
    .all() as CollegeRecord[];

  if (districtId) {
    rows = rows.filter((r) => r.district_id === districtId);
  }
  if (status) {
    rows = rows.filter((r) => r.status === status);
  }
  if (search) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        r.code.toLowerCase().includes(search) ||
        r.city.toLowerCase().includes(search) ||
        (r.district_name ?? '').toLowerCase().includes(search)
    );
  }

  res.json({ colleges: rows });
});

// POST /api/state/colleges
statewideRouter.post('/colleges', (req: Request, res: Response) => {
  const {
    code,
    name,
    district_id,
    city,
    campus_type = 'Engineering College',
    connected_buildings = 4,
    solar_capacity_kwp = 100,
    battery_capacity_kwh = 160,
    daily_demand_kwh = 1450,
    status = 'Active',
  } = req.body as {
    code?: string;
    name?: string;
    district_id?: number;
    city?: string;
    campus_type?: string;
    connected_buildings?: number;
    solar_capacity_kwp?: number;
    battery_capacity_kwh?: number;
    daily_demand_kwh?: number;
    status?: 'Active' | 'Onboarding' | 'Maintenance';
  };

  if (!code || !name || !district_id || !city) {
    res.status(400).json({ error: 'College code, name, district, and city are required.' });
    return;
  }

  const db = getDb();
  const district = db.prepare('SELECT id, name FROM districts WHERE id = ?').get(Number(district_id)) as
    | { id: number; name: string }
    | undefined;
  if (!district) {
    res.status(404).json({ error: 'Selected Karnataka district does not exist.' });
    return;
  }

  const cleanCode = code.trim().toUpperCase();
  const existing = db.prepare('SELECT id FROM colleges WHERE code = ?').get(cleanCode);
  if (existing) {
    res.status(409).json({ error: `College code "${cleanCode}" is already registered.` });
    return;
  }

  const solarGen = Number((Number(solar_capacity_kwp) * 4.25).toFixed(1));
  const demand = Math.max(100, Number(daily_demand_kwh));
  const gridImport = Number(Math.max(0, demand - solarGen * 0.92).toFixed(1));
  const estSavings = Math.round(solarGen * 6.9 + Number(battery_capacity_kwh) * 2.1);

  const info = db
    .prepare(
      `INSERT INTO colleges (
         code, name, district_id, city, campus_type, connected_buildings,
         solar_capacity_kwp, battery_capacity_kwh, daily_demand_kwh,
         solar_generation_kwh, battery_soc_pct, grid_import_kwh,
         estimated_savings_inr, active_alerts, status, data_source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 65, ?, ?, 0, ?, 'SIMULATED DATA')`
    )
    .run(
      cleanCode,
      name.trim(),
      district.id,
      city.trim(),
      campus_type.trim(),
      Math.max(1, Number(connected_buildings) || 4),
      Math.max(0, Number(solar_capacity_kwp) || 0),
      Math.max(0, Number(battery_capacity_kwh) || 0),
      demand,
      solarGen,
      gridImport,
      estSavings,
      ['Active', 'Onboarding', 'Maintenance'].includes(status) ? status : 'Active'
    );

  const created = db
    .prepare(
      `SELECT c.*, d.name as district_name, d.code as district_code
       FROM colleges c JOIN districts d ON d.id = c.district_id
       WHERE c.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json({ ok: true, college: created });
});

// PATCH /api/state/colleges/:id
statewideRouter.patch('/colleges/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status?: 'Active' | 'Onboarding' | 'Maintenance' };
  if (!status || !['Active', 'Onboarding', 'Maintenance'].includes(status)) {
    res.status(400).json({ error: 'Valid status (Active | Onboarding | Maintenance) is required.' });
    return;
  }

  const db = getDb();
  const info = db.prepare('UPDATE colleges SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'College not found.' });
    return;
  }

  const updated = db
    .prepare(
      `SELECT c.*, d.name as district_name, d.code as district_code
       FROM colleges c JOIN districts d ON d.id = c.district_id
       WHERE c.id = ?`
    )
    .get(id);

  res.json({ ok: true, college: updated });
});

// GET /api/state/districts
statewideRouter.get('/districts', (_req: Request, res: Response) => {
  res.json({ districts: getDistrictsList() });
});

// POST /api/state/districts
statewideRouter.post('/districts', (req: Request, res: Response) => {
  const {
    code,
    name,
    zone = 'Central Karnataka',
    nodal_officer = 'District Nodal Energy Officer',
    target_savings_pct = 20,
    tariff_zone = 'HESCOM / BESCOM Institutional HT-2',
  } = req.body as {
    code?: string;
    name?: string;
    zone?: string;
    nodal_officer?: string;
    target_savings_pct?: number;
    tariff_zone?: string;
  };

  if (!code || !name) {
    res.status(400).json({ error: 'District code and name are required.' });
    return;
  }

  const db = getDb();
  const cleanCode = code.trim().toUpperCase();
  const dup = db
    .prepare('SELECT id FROM districts WHERE code = ? OR LOWER(name) = LOWER(?)')
    .get(cleanCode, name.trim());
  if (dup) {
    res.status(409).json({ error: 'A district with this code or name already exists.' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO districts (code, name, zone, nodal_officer, target_savings_pct, tariff_zone)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      cleanCode,
      name.trim(),
      zone.trim(),
      nodal_officer.trim(),
      Math.min(60, Math.max(5, Number(target_savings_pct) || 20)),
      tariff_zone.trim()
    );

  const created = db.prepare('SELECT * FROM districts WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ok: true, district: created });
});

// PATCH /api/state/districts/:id
statewideRouter.patch('/districts/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { nodal_officer, target_savings_pct } = req.body as {
    nodal_officer?: string;
    target_savings_pct?: number;
  };

  const db = getDb();
  const current = db.prepare('SELECT * FROM districts WHERE id = ?').get(id) as
    | { id: number; nodal_officer: string; target_savings_pct: number }
    | undefined;
  if (!current) {
    res.status(404).json({ error: 'District not found.' });
    return;
  }

  const nextOfficer = nodal_officer?.trim() || current.nodal_officer;
  const nextTarget =
    typeof target_savings_pct === 'number'
      ? Math.min(60, Math.max(5, target_savings_pct))
      : current.target_savings_pct;

  db.prepare('UPDATE districts SET nodal_officer = ?, target_savings_pct = ? WHERE id = ?').run(
    nextOfficer,
    nextTarget,
    id
  );

  const updated = db.prepare('SELECT * FROM districts WHERE id = ?').get(id);
  res.json({ ok: true, district: updated });
});

// GET /api/state/analytics
statewideRouter.get('/analytics', (_req: Request, res: Response) => {
  const rows = getDistrictAnalyticsRows();
  res.json({ districts: rows });
});

// GET /api/state/reports
statewideRouter.get('/reports', (_req: Request, res: Response) => {
  res.json(getStatewideReportsSummary());
});

// GET /api/state/reports/export
statewideRouter.get('/reports/export', (req: Request, res: Response) => {
  const scope = (req.query.scope as string) === 'districts' ? 'districts' : 'colleges';
  const summary = getStatewideReportsSummary();

  let csv = '';
  if (scope === 'districts') {
    csv = [
      'district_code,district_name,zone,colleges,solar_capacity_kwp,daily_demand_kwh,solar_generation_kwh,grid_import_kwh,solar_share_pct,estimated_savings_inr,target_savings_pct,active_alerts',
      ...summary.district_summary.map(
        (d) =>
          `${d.district_code},"${d.district_name}","${d.zone}",${d.college_count},${d.solar_capacity_kwp},${d.daily_demand_kwh},${d.solar_generation_kwh},${d.grid_import_kwh},${d.solar_share_pct},${d.estimated_savings_inr},${d.target_savings_pct},${d.active_alerts}`
      ),
    ].join('\n');
  } else {
    csv = [
      'college_code,college_name,district,city,status,buildings,solar_kwp,battery_kwh,daily_demand_kwh,solar_generation_kwh,grid_import_kwh,battery_soc_pct,estimated_savings_inr,active_alerts,data_source',
      ...summary.college_summary.map(
        (c) =>
          `${c.code},"${c.name}","${c.district_name ?? ''}","${c.city}",${c.status},${c.connected_buildings},${c.solar_capacity_kwp},${c.battery_capacity_kwh},${c.daily_demand_kwh},${c.solar_generation_kwh},${c.grid_import_kwh},${c.battery_soc_pct},${c.estimated_savings_inr},${c.active_alerts},${c.data_source}`
      ),
    ].join('\n');
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="karnataka_statewide_${scope}_${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(csv);
});
