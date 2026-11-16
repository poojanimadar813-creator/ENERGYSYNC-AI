import { getDb } from '../db/database.ts';
import type {
  CollegeRecord,
  DistrictAnalyticsRow,
  DistrictRecord,
  StateDashboardSummary,
  StatewideReportsSummary,
} from '../../types/energy.ts';

const INITIAL_KARNATAKA_DISTRICTS = [
  {
    code: 'KA-VJP',
    name: 'Vijayapura',
    zone: 'Kittur Karnataka',
    nodal_officer: 'Dr. R. S. Kulkarni',
    target_savings_pct: 22.0,
    tariff_zone: 'HESCOM Institutional HT-2',
  },
  {
    code: 'KA-BLR',
    name: 'Bengaluru Urban',
    zone: 'South Karnataka',
    nodal_officer: 'Er. Ananya Deshpande',
    target_savings_pct: 20.0,
    tariff_zone: 'BESCOM Institutional HT-2',
  },
  {
    code: 'KA-BGM',
    name: 'Belagavi',
    zone: 'Kittur Karnataka',
    nodal_officer: 'Prof. S. M. Patil',
    target_savings_pct: 19.5,
    tariff_zone: 'HESCOM Institutional HT-2',
  },
  {
    code: 'KA-DWR',
    name: 'Dharwad',
    zone: 'Kittur Karnataka',
    nodal_officer: 'Dr. Kavitha Joshi',
    target_savings_pct: 21.0,
    tariff_zone: 'HESCOM Institutional HT-2',
  },
  {
    code: 'KA-MYS',
    name: 'Mysuru',
    zone: 'South Karnataka',
    nodal_officer: 'Er. Pradeep Gowda',
    target_savings_pct: 18.5,
    tariff_zone: 'CESC Mysuru HT-2',
  },
  {
    code: 'KA-KLB',
    name: 'Kalaburagi',
    zone: 'Kalyana Karnataka',
    nodal_officer: 'Prof. M. A. Quadri',
    target_savings_pct: 24.0,
    tariff_zone: 'GESCOM Institutional HT-2',
  },
  {
    code: 'KA-DKD',
    name: 'Dakshina Kannada',
    zone: 'Coastal Karnataka',
    nodal_officer: 'Dr. Nitin Shetty',
    target_savings_pct: 17.5,
    tariff_zone: 'MESCOM Institutional HT-2',
  },
  {
    code: 'KA-TMK',
    name: 'Tumakuru',
    zone: 'Central Karnataka',
    nodal_officer: 'Er. Shilpa Rao',
    target_savings_pct: 20.5,
    tariff_zone: 'BESCOM Institutional HT-2',
  },
];

const INITIAL_KARNATAKA_COLLEGES = [
  {
    code: 'BLDEA-VJP',
    name: 'BLDEACET Vijayapura',
    district_code: 'KA-VJP',
    city: 'Vijayapura',
    campus_type: 'Engineering & Innovation Hub',
    connected_buildings: 5,
    solar_capacity_kwp: 115,
    battery_capacity_kwh: 200,
    daily_demand_kwh: 1580,
    solar_generation_kwh: 515,
    battery_soc_pct: 64,
    grid_import_kwh: 960,
    estimated_savings_inr: 3920,
    active_alerts: 3,
    status: 'Active',
  },
  {
    code: 'RVCE-BLR',
    name: 'R.V. College of Engineering',
    district_code: 'KA-BLR',
    city: 'Bengaluru',
    campus_type: 'Autonomous Engineering University',
    connected_buildings: 9,
    solar_capacity_kwp: 240,
    battery_capacity_kwh: 380,
    daily_demand_kwh: 3120,
    solar_generation_kwh: 980,
    battery_soc_pct: 71,
    grid_import_kwh: 1890,
    estimated_savings_inr: 7650,
    active_alerts: 2,
    status: 'Active',
  },
  {
    code: 'BMSCE-BLR',
    name: 'BMS College of Engineering',
    district_code: 'KA-BLR',
    city: 'Bengaluru',
    campus_type: 'Engineering Campus',
    connected_buildings: 7,
    solar_capacity_kwp: 185,
    battery_capacity_kwh: 300,
    daily_demand_kwh: 2640,
    solar_generation_kwh: 740,
    battery_soc_pct: 68,
    grid_import_kwh: 1710,
    estimated_savings_inr: 5980,
    active_alerts: 1,
    status: 'Active',
  },
  {
    code: 'KLETECH-DWR',
    name: 'KLE Technological University',
    district_code: 'KA-DWR',
    city: 'Hubballi',
    campus_type: 'Technical University',
    connected_buildings: 8,
    solar_capacity_kwp: 210,
    battery_capacity_kwh: 320,
    daily_demand_kwh: 2410,
    solar_generation_kwh: 895,
    battery_soc_pct: 74,
    grid_import_kwh: 1320,
    estimated_savings_inr: 6840,
    active_alerts: 2,
    status: 'Active',
  },
  {
    code: 'KLSGIT-BGM',
    name: 'KLS Gogte Institute of Technology',
    district_code: 'KA-BGM',
    city: 'Belagavi',
    campus_type: 'Engineering Campus',
    connected_buildings: 6,
    solar_capacity_kwp: 140,
    battery_capacity_kwh: 220,
    daily_demand_kwh: 1790,
    solar_generation_kwh: 590,
    battery_soc_pct: 61,
    grid_import_kwh: 1085,
    estimated_savings_inr: 4410,
    active_alerts: 1,
    status: 'Active',
  },
  {
    code: 'NIE-MYS',
    name: 'National Institute of Engineering',
    district_code: 'KA-MYS',
    city: 'Mysuru',
    campus_type: 'Engineering Campus',
    connected_buildings: 6,
    solar_capacity_kwp: 160,
    battery_capacity_kwh: 250,
    daily_demand_kwh: 1920,
    solar_generation_kwh: 670,
    battery_soc_pct: 66,
    grid_import_kwh: 1120,
    estimated_savings_inr: 5120,
    active_alerts: 1,
    status: 'Active',
  },
  {
    code: 'PDACE-KLB',
    name: 'PDA College of Engineering',
    district_code: 'KA-KLB',
    city: 'Kalaburagi',
    campus_type: 'Engineering Campus',
    connected_buildings: 5,
    solar_capacity_kwp: 150,
    battery_capacity_kwh: 240,
    daily_demand_kwh: 1650,
    solar_generation_kwh: 685,
    battery_soc_pct: 78,
    grid_import_kwh: 840,
    estimated_savings_inr: 5490,
    active_alerts: 0,
    status: 'Active',
  },
  {
    code: 'NITK-DKD',
    name: 'NITK Surathkal Microgrid Node',
    district_code: 'KA-DKD',
    city: 'Mangaluru',
    campus_type: 'National Institute',
    connected_buildings: 10,
    solar_capacity_kwp: 310,
    battery_capacity_kwh: 480,
    daily_demand_kwh: 3480,
    solar_generation_kwh: 1180,
    battery_soc_pct: 69,
    grid_import_kwh: 2050,
    estimated_savings_inr: 8920,
    active_alerts: 2,
    status: 'Active',
  },
  {
    code: 'SIT-TMK',
    name: 'Siddaganga Institute of Technology',
    district_code: 'KA-TMK',
    city: 'Tumakuru',
    campus_type: 'Engineering Campus',
    connected_buildings: 6,
    solar_capacity_kwp: 135,
    battery_capacity_kwh: 200,
    daily_demand_kwh: 1690,
    solar_generation_kwh: 560,
    battery_soc_pct: 58,
    grid_import_kwh: 1030,
    estimated_savings_inr: 4180,
    active_alerts: 1,
    status: 'Onboarding',
  },
];

export function seedStatewideIfEmpty(): void {
  const db = getDb();

  // Backfill college & district on primary admin account if missing
  db.prepare(
    `UPDATE users SET college = COALESCE(college, 'BLDEACET Vijayapura'), district = COALESCE(district, 'Vijayapura') WHERE college IS NULL OR district IS NULL`
  ).run();

  const distCount = (db.prepare('SELECT COUNT(*) as cnt FROM districts').get() as { cnt: number }).cnt;
  if (distCount === 0) {
    const insertDist = db.prepare(
      `INSERT INTO districts (code, name, zone, nodal_officer, target_savings_pct, tariff_zone)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const d of INITIAL_KARNATAKA_DISTRICTS) {
      insertDist.run(d.code, d.name, d.zone, d.nodal_officer, d.target_savings_pct, d.tariff_zone);
    }
  }

  const colCount = (db.prepare('SELECT COUNT(*) as cnt FROM colleges').get() as { cnt: number }).cnt;
  if (colCount === 0) {
    const distRows = db.prepare('SELECT id, code FROM districts').all() as Array<{
      id: number;
      code: string;
    }>;
    const distMap = new Map(distRows.map((d) => [d.code, d.id]));
    const insertCol = db.prepare(
      `INSERT INTO colleges (
         code, name, district_id, city, campus_type, connected_buildings,
         solar_capacity_kwp, battery_capacity_kwh, daily_demand_kwh,
         solar_generation_kwh, battery_soc_pct, grid_import_kwh,
         estimated_savings_inr, active_alerts, status, data_source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SIMULATED DATA')`
    );

    for (const c of INITIAL_KARNATAKA_COLLEGES) {
      const distId = distMap.get(c.district_code);
      if (!distId) continue;
      insertCol.run(
        c.code,
        c.name,
        distId,
        c.city,
        c.campus_type,
        c.connected_buildings,
        c.solar_capacity_kwp,
        c.battery_capacity_kwh,
        c.daily_demand_kwh,
        c.solar_generation_kwh,
        c.battery_soc_pct,
        c.grid_import_kwh,
        c.estimated_savings_inr,
        c.active_alerts,
        c.status
      );
    }
  }
}

/**
 * Syncs BLDEACET Vijayapura's statewide row with live local campus SQLite telemetry
 * so any local simulation run/reset reflects immediately in Karnataka Statewide views.
 */
export function syncPrimaryCampusToStatewide(): void {
  const db = getDb();
  const latestDateRow = db
    .prepare('SELECT MAX(substr(timestamp, 1, 10)) as latest_date FROM energy_consumption')
    .get() as { latest_date: string | null };
  if (!latestDateRow?.latest_date) return;

  const todayDemand = (
    db
      .prepare(
        `SELECT COALESCE(SUM(consumption_kwh), 0) as total FROM energy_consumption WHERE substr(timestamp, 1, 10) = ?`
      )
      .get(latestDateRow.latest_date) as { total: number }
  ).total;

  const solarSums = db
    .prepare(
      `SELECT
         COALESCE(SUM(generated_kwh), 0) as gen,
         COALESCE(SUM(consumed_direct_kwh), 0) as direct,
         COALESCE(SUM(battery_charged_kwh), 0) as bat_ch,
         COALESCE(SUM(grid_import_kwh), 0) as grid
       FROM solar_generation`
    )
    .get() as { gen: number; direct: number; bat_ch: number; grid: number };

  const activeAlerts = (
    db.prepare("SELECT COUNT(*) as cnt FROM energy_alerts WHERE status = 'Active'").get() as {
      cnt: number;
    }
  ).cnt;

  const currentBat = db
    .prepare('SELECT soc_percent FROM battery_status ORDER BY id DESC LIMIT 1')
    .get() as { soc_percent: number } | undefined;

  const estSavingsInr = Number(((solarSums.direct + solarSums.bat_ch) * 6.9 + 420).toFixed(0));

  db.prepare(
    `UPDATE colleges
     SET daily_demand_kwh = ?, solar_generation_kwh = ?, grid_import_kwh = ?,
         battery_soc_pct = ?, estimated_savings_inr = ?, active_alerts = ?
     WHERE code = 'BLDEA-VJP'`
  ).run(
    Number(todayDemand.toFixed(1)),
    Number(solarSums.gen.toFixed(1)),
    Number(solarSums.grid.toFixed(1)),
    Number((currentBat?.soc_percent ?? 62).toFixed(1)),
    estSavingsInr,
    activeAlerts
  );
}

export function getStateDashboardSummary(): StateDashboardSummary {
  syncPrimaryCampusToStatewide();
  const db = getDb();

  const colleges = db
    .prepare(
      `SELECT c.*, d.name as district_name, d.code as district_code
       FROM colleges c
       JOIN districts d ON d.id = c.district_id
       ORDER BY c.estimated_savings_inr DESC`
    )
    .all() as CollegeRecord[];

  const districtBreakdown = db
    .prepare(
      `SELECT
         d.id,
         d.code,
         d.name,
         d.zone,
         COUNT(c.id) as college_count,
         ROUND(COALESCE(SUM(c.daily_demand_kwh), 0), 1) as daily_demand_kwh,
         ROUND(COALESCE(SUM(c.solar_generation_kwh), 0), 1) as solar_generation_kwh,
         ROUND(COALESCE(SUM(c.grid_import_kwh), 0), 1) as grid_import_kwh,
         ROUND(COALESCE(SUM(c.estimated_savings_inr), 0), 0) as estimated_savings_inr
       FROM districts d
       LEFT JOIN colleges c ON c.district_id = d.id
       GROUP BY d.id
       ORDER BY daily_demand_kwh DESC`
    )
    .all() as Array<{
    id: number;
    code: string;
    name: string;
    zone: string;
    college_count: number;
    daily_demand_kwh: number;
    solar_generation_kwh: number;
    grid_import_kwh: number;
    estimated_savings_inr: number;
  }>;

  const kpis = colleges.reduce(
    (acc, c) => {
      acc.total_colleges += 1;
      if (c.status === 'Active') acc.active_colleges += 1;
      acc.total_daily_demand_kwh += c.daily_demand_kwh;
      acc.total_solar_generation_kwh += c.solar_generation_kwh;
      acc.total_solar_capacity_kwp += c.solar_capacity_kwp;
      acc.total_battery_capacity_kwh += c.battery_capacity_kwh;
      acc.soc_sum += c.battery_soc_pct;
      acc.total_grid_import_kwh += c.grid_import_kwh;
      acc.total_estimated_savings_inr += c.estimated_savings_inr;
      acc.total_active_alerts += c.active_alerts;
      return acc;
    },
    {
      total_colleges: 0,
      active_colleges: 0,
      total_daily_demand_kwh: 0,
      total_solar_generation_kwh: 0,
      total_solar_capacity_kwp: 0,
      total_battery_capacity_kwh: 0,
      soc_sum: 0,
      total_grid_import_kwh: 0,
      total_estimated_savings_inr: 0,
      total_active_alerts: 0,
    }
  );

  const coveredDistricts = districtBreakdown.filter((d) => d.college_count > 0).length;

  return {
    network_name: 'Karnataka Statewide Smart Energy Management Network',
    kpis: {
      total_colleges: kpis.total_colleges,
      active_colleges: kpis.active_colleges,
      covered_districts: coveredDistricts,
      total_daily_demand_kwh: Number(kpis.total_daily_demand_kwh.toFixed(1)),
      total_solar_generation_kwh: Number(kpis.total_solar_generation_kwh.toFixed(1)),
      total_solar_capacity_kwp: Number(kpis.total_solar_capacity_kwp.toFixed(1)),
      total_battery_capacity_kwh: Number(kpis.total_battery_capacity_kwh.toFixed(1)),
      avg_battery_soc_pct:
        kpis.total_colleges > 0
          ? Number((kpis.soc_sum / kpis.total_colleges).toFixed(1))
          : 0,
      total_grid_import_kwh: Number(kpis.total_grid_import_kwh.toFixed(1)),
      total_estimated_savings_inr: Math.round(kpis.total_estimated_savings_inr),
      total_active_alerts: kpis.total_active_alerts,
    },
    district_breakdown: districtBreakdown.map((d) => ({
      ...d,
      solar_offset_pct:
        d.daily_demand_kwh > 0
          ? Number(((d.solar_generation_kwh / d.daily_demand_kwh) * 100).toFixed(1))
          : 0,
    })),
    top_colleges: colleges.slice(0, 6),
  };
}

export function getDistrictsList(): DistrictRecord[] {
  syncPrimaryCampusToStatewide();
  const db = getDb();
  return db
    .prepare(
      `SELECT
         d.*,
         COUNT(c.id) as college_count,
         ROUND(COALESCE(SUM(c.solar_capacity_kwp), 0), 1) as total_solar_kwp,
         ROUND(COALESCE(SUM(c.daily_demand_kwh), 0), 1) as total_daily_demand_kwh,
         ROUND(COALESCE(SUM(c.solar_generation_kwh), 0), 1) as total_solar_gen_kwh,
         ROUND(COALESCE(SUM(c.estimated_savings_inr), 0), 0) as total_savings_inr
       FROM districts d
       LEFT JOIN colleges c ON c.district_id = d.id
       GROUP BY d.id
       ORDER BY d.name ASC`
    )
    .all() as DistrictRecord[];
}

export function getDistrictAnalyticsRows(): DistrictAnalyticsRow[] {
  syncPrimaryCampusToStatewide();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         d.id as district_id,
         d.code as district_code,
         d.name as district_name,
         d.zone,
         d.target_savings_pct,
         COUNT(c.id) as college_count,
         ROUND(COALESCE(SUM(c.solar_capacity_kwp), 0), 1) as solar_capacity_kwp,
         ROUND(COALESCE(SUM(c.daily_demand_kwh), 0), 1) as daily_demand_kwh,
         ROUND(COALESCE(SUM(c.solar_generation_kwh), 0), 1) as solar_generation_kwh,
         ROUND(COALESCE(SUM(c.grid_import_kwh), 0), 1) as grid_import_kwh,
         ROUND(COALESCE(SUM(c.estimated_savings_inr), 0), 0) as estimated_savings_inr,
         ROUND(COALESCE(AVG(c.battery_soc_pct), 0), 1) as avg_battery_soc_pct,
         COALESCE(SUM(c.active_alerts), 0) as active_alerts
       FROM districts d
       LEFT JOIN colleges c ON c.district_id = d.id
       GROUP BY d.id
       ORDER BY daily_demand_kwh DESC`
    )
    .all() as Array<Omit<DistrictAnalyticsRow, 'solar_share_pct'>>;

  return rows.map((r) => ({
    ...r,
    solar_share_pct:
      r.daily_demand_kwh > 0
        ? Number(((r.solar_generation_kwh / r.daily_demand_kwh) * 100).toFixed(1))
        : 0,
  }));
}

export function getStatewideReportsSummary(): StatewideReportsSummary {
  const districtSummary = getDistrictAnalyticsRows();
  const db = getDb();
  const collegeSummary = db
    .prepare(
      `SELECT c.*, d.name as district_name, d.code as district_code
       FROM colleges c
       JOIN districts d ON d.id = c.district_id
       ORDER BY d.name ASC, c.name ASC`
    )
    .all() as CollegeRecord[];

  const dailyDemand = collegeSummary.reduce((a, b) => a + b.daily_demand_kwh, 0);
  const solarGen = collegeSummary.reduce((a, b) => a + b.solar_generation_kwh, 0);
  const gridImp = collegeSummary.reduce((a, b) => a + b.grid_import_kwh, 0);
  const dailySav = collegeSummary.reduce((a, b) => a + b.estimated_savings_inr, 0);

  return {
    generated_at: new Date().toISOString(),
    totals: {
      colleges: collegeSummary.length,
      districts: districtSummary.filter((d) => d.college_count > 0).length,
      daily_demand_kwh: Number(dailyDemand.toFixed(1)),
      solar_generation_kwh: Number(solarGen.toFixed(1)),
      grid_import_kwh: Number(gridImp.toFixed(1)),
      estimated_daily_savings_inr: Math.round(dailySav),
      estimated_monthly_savings_inr: Math.round(dailySav * 30),
    },
    district_summary: districtSummary,
    college_summary: collegeSummary,
  };
}
