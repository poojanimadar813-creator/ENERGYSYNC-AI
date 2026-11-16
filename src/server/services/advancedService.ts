import { getDb } from '../db/database.ts';
import { getCachedBatteryOptimization, getCachedPrediction, recomputeAIModelsFromDb } from './simulationService.ts';
import { getRateLimiterStats, listDatabaseBackups } from '../middleware/reliability.ts';
import type {
  CarbonSummary,
  CollegeRecord,
  DataSourceLabel,
  DigitalTwinBuilding,
  DigitalTwinState,
  FlexibleLoadItem,
  GreenLeaderboardEntry,
  MaintenanceDiagnostic,
  PeakLoadPlan,
  SmartNotification,
  SystemReliabilityOverview,
  WeatherCondition,
  WeatherForecastResult,
} from '../../types/energy.ts';

const GRID_EMISSION_FACTOR_KG_PER_KWH = 0.82; // CEA India Grid Emission Factor

export function seedAdvancedIfEmpty(): void {
  const db = getDb();

  // Seed college normalization metadata for Green Campus Leaderboard
  const collegeNorms: Record<
    string,
    { students: number; wastage_red: number; bat_eff: number; delta: number }
  > = {
    'BLDEA-VJP': { students: 3200, wastage_red: 22.4, bat_eff: 94.2, delta: 12.6 },
    'RVCE-BLR': { students: 5600, wastage_red: 19.8, bat_eff: 93.8, delta: 10.4 },
    'BMSCE-BLR': { students: 5100, wastage_red: 17.2, bat_eff: 92.6, delta: 8.9 },
    'KLETECH-DWR': { students: 4800, wastage_red: 23.1, bat_eff: 94.5, delta: 13.8 },
    'KLSGIT-BGM': { students: 3400, wastage_red: 18.4, bat_eff: 92.1, delta: 9.2 },
    'NIE-MYS': { students: 3600, wastage_red: 20.5, bat_eff: 93.4, delta: 11.1 },
    'PDACE-KLB': { students: 2900, wastage_red: 24.6, bat_eff: 94.8, delta: 14.2 },
    'NITK-DKD': { students: 6200, wastage_red: 21.0, bat_eff: 93.9, delta: 11.7 },
    'SIT-TMK': { students: 3300, wastage_red: 15.8, bat_eff: 91.5, delta: 7.4 },
  };
  const updCollege = db.prepare(
    `UPDATE colleges SET student_count = ?, wastage_reduction_pct = ?, battery_efficiency_pct = ?, improvement_delta_pct = ? WHERE code = ?`
  );
  for (const [code, meta] of Object.entries(collegeNorms)) {
    updCollege.run(meta.students, meta.wastage_red, meta.bat_eff, meta.delta, code);
  }

  // Seed flexible peak-shift loads if empty
  const shiftCount = (db.prepare('SELECT COUNT(*) as cnt FROM load_shifts').get() as { cnt: number }).cnt;
  if (shiftCount === 0) {
    const insShift = db.prepare(
      `INSERT INTO load_shifts (load_name, source_building, power_kw, duration_hours, from_hour, to_hour, estimated_savings_inr, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insShift.run('AI/ML GPU Cluster Training Batch', 'Computer & AI Laboratories', 18.5, 3, 19, 12, 165.0, 'Scheduled Peak');
    insShift.run('Campus Overhead Water Pumping & RO', 'Academic Classrooms Block A', 11.0, 2, 18, 13, 105.6, 'Scheduled Peak');
    insShift.run('HVAC Thermal Pre-Cooling Cycle', 'IEEE Seminar & Auditorium Hall', 14.0, 2, 14, 10, 84.0, 'Deferred');
    insShift.run('CAD & Simulation Lab Workstation Updates', 'Computer & AI Laboratories', 8.5, 2, 20, 2, 81.6, 'Scheduled Peak');
  }

  // Seed Predictive Maintenance diagnostics if empty
  const maintCount = (db.prepare('SELECT COUNT(*) as cnt FROM maintenance_issues').get() as { cnt: number }).cnt;
  if (maintCount === 0) {
    const insMaint = db.prepare(
      `INSERT INTO maintenance_issues (asset_code, asset_name, asset_type, health_score_pct, risk_level, diagnostic_signal, recommended_action, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insMaint.run(
      'SOLAR-INV-02',
      'North Wing String Inverter #2 (55 kWp)',
      'Solar Inverter',
      78.5,
      'Medium',
      'Irradiance-normalized Performance Ratio dropped 9.4% below twin string #1 between 11:00–14:00.',
      'Inspect DC combiner MC4 connectors and schedule PV panel dust cleaning on North Wing array.',
      'Open'
    );
    insMaint.run(
      'BESS-RACK-B2',
      'LiFePO4 Battery Module Rack B2 (100 kWh)',
      'Battery Bank',
      84.2,
      'Medium',
      'Cell balancing delta reached 42 mV during 40 kW evening peak discharge cycle.',
      'Run automated passive cell-balancing cycle during 02:00–05:00 off-peak standby.',
      'Open'
    );
    insMaint.run(
      'HVAC-CHILL-LAB',
      'Innovation Block Split Chiller Compressor',
      'HVAC System',
      71.0,
      'High',
      'Isolation Forest flagged repeated short-cycling (+28% reactive draw) with ambient temp 31°C.',
      'Clean condenser coils, verify refrigerant pressure, and calibrate thermostat deadband.',
      'Open'
    );
    insMaint.run(
      'METER-SEM-01',
      'Seminar Hall Smart Sub-Meter (SCT-013)',
      'Smart Meter',
      95.4,
      'Low',
      'Nominal telemetry; minor packet jitter (1.8%) observed during afternoon transfer.',
      'Verify Wi-Fi RSSI signal at East Wing ESP32 gateway during routine check.',
      'Scheduled'
    );
  }

  // Seed Smart Notifications from real SQLite state if empty
  const notifCount = (db.prepare('SELECT COUNT(*) as cnt FROM notifications').get() as { cnt: number }).cnt;
  if (notifCount === 0) {
    syncSmartNotifications();
  }

  // Record initial model performance history point if empty
  const histCount = (db.prepare('SELECT COUNT(*) as cnt FROM model_metrics_history').get() as { cnt: number }).cnt;
  if (histCount === 0) {
    recordLatestModelMetrics();
  }
}

export function recordLatestModelMetrics(): void {
  const db = getDb();
  const pred = getCachedPrediction() ?? recomputeAIModelsFromDb().prediction;
  const sim = db.prepare('SELECT weather_condition FROM simulation_state WHERE id = 1').get() as
    | { weather_condition: string }
    | undefined;

  db.prepare(
    `INSERT INTO model_metrics_history (model_name, mae, rmse, r2_score, train_samples, test_samples, weather_condition)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    pred.model_name,
    pred.mae,
    pred.rmse,
    pred.r2_score,
    pred.train_samples,
    pred.test_samples,
    sim?.weather_condition ?? 'Clear Sunny'
  );
}

export function syncSmartNotifications(): void {
  const db = getDb();
  const sim = db.prepare('SELECT data_source FROM simulation_state WHERE id = 1').get() as
    | { data_source: DataSourceLabel }
    | undefined;
  const source = sim?.data_source ?? 'SIMULATED DATA';

  const alerts = db
    .prepare(
      `SELECT ea.*, b.name as building_name FROM energy_alerts ea
       JOIN buildings b ON b.id = ea.building_id
       WHERE ea.status = 'Active'
       ORDER BY ea.anomaly_score DESC LIMIT 3`
    )
    .all() as Array<{
    building_name: string;
    detected_kwh: number;
    expected_kwh: number;
    severity: string;
    reason: string;
  }>;

  const lowBat = db
    .prepare('SELECT MIN(soc_percent) as min_soc FROM battery_status')
    .get() as { min_soc: number | null };

  const maintHigh = db
    .prepare("SELECT asset_name, diagnostic_signal FROM maintenance_issues WHERE status = 'Open' LIMIT 1")
    .get() as { asset_name: string; diagnostic_signal: string } | undefined;

  const insertNotif = db.prepare(
    `INSERT INTO notifications (title, category, severity, message, is_read, data_source)
     VALUES (?, ?, ?, ?, 0, ?)`
  );

  for (const a of alerts) {
    const exists = db
      .prepare('SELECT id FROM notifications WHERE title = ?')
      .get(`Excessive Draw: ${a.building_name}`);
    if (!exists) {
      insertNotif.run(
        `Excessive Draw: ${a.building_name}`,
        'Excessive Consumption',
        a.severity === 'High' ? 'High' : 'Medium',
        `${a.reason} (${a.detected_kwh} kWh vs ${a.expected_kwh} kWh expected).`,
        source
      );
    }
  }

  if ((lowBat?.min_soc ?? 50) <= 22) {
    const exists = db.prepare("SELECT id FROM notifications WHERE category = 'Low Battery'").get();
    if (!exists) {
      insertNotif.run(
        'Battery Reserve Approaching Minimum SOC',
        'Low Battery',
        'Medium',
        `Scheduled evening discharge brings BESS close to ${lowBat.min_soc?.toFixed(1)}% SOC reserve threshold.`,
        source
      );
    }
  }

  if (maintHigh) {
    const exists = db.prepare("SELECT id FROM notifications WHERE category = 'Anomaly Pattern'").get();
    if (!exists) {
      insertNotif.run(
        `Equipment Behavior Alert: ${maintHigh.asset_name}`,
        'Anomaly Pattern',
        'Medium',
        maintHigh.diagnostic_signal,
        source
      );
    }
  }

  const offlineNodeExists = db
    .prepare("SELECT id FROM notifications WHERE category = 'Device Offline'")
    .get();
  if (!offlineNodeExists) {
    insertNotif.run(
      'ESP32 Gateway Heartbeat Check (Seminar Hall Node)',
      'Device Offline',
      'Low',
      'Simulated sensor node SEM-01 buffered 1 interval during brief Wi-Fi handshake; ready for automatic sync.',
      source
    );
  }
}

export function getDigitalTwinState(): DigitalTwinState {
  const db = getDb();
  const sim = db.prepare('SELECT weather_condition, data_source FROM simulation_state WHERE id = 1').get() as {
    weather_condition: WeatherCondition;
    data_source: DataSourceLabel;
  };
  const latestDateRow = db
    .prepare('SELECT MAX(substr(timestamp, 1, 10)) as latest_date FROM energy_consumption')
    .get() as { latest_date: string | null };
  const todayDate = latestDateRow?.latest_date ?? new Date().toISOString().slice(0, 10);
  const currentHour = new Date().getHours();

  const solarNow = (db
    .prepare('SELECT * FROM solar_generation WHERE hour = ? LIMIT 1')
    .get(currentHour) || { generated_kwh: 0 }) as { generated_kwh: number };
  const solarTotalRow = db
    .prepare('SELECT COALESCE(SUM(generated_kwh), 0) as total FROM solar_generation')
    .get() as { total: number };

  const batNow = (db
    .prepare('SELECT * FROM battery_status ORDER BY id ASC LIMIT 1 OFFSET ?')
    .get(Math.min(23, currentHour)) ||
    db.prepare('SELECT * FROM battery_status ORDER BY id DESC LIMIT 1').get()) as {
    capacity_kwh: number;
    soc_percent: number;
    stored_kwh: number;
    action: string;
    power_kw: number;
    efficiency_pct: number;
    min_soc_pct: number;
  };

  const buildingsRaw = db
    .prepare(
      `SELECT
         b.*,
         ROUND(COALESCE(SUM(CASE WHEN substr(ec.timestamp, 1, 10) = ? THEN ec.consumption_kwh ELSE 0 END), 0), 2) as today_kwh,
         ROUND(COALESCE(MAX(CASE WHEN substr(ec.timestamp, 1, 10) = ? AND ec.hour = ? THEN ec.consumption_kwh ELSE NULL END), AVG(ec.consumption_kwh)), 2) as current_kw
       FROM buildings b
       LEFT JOIN energy_consumption ec ON ec.building_id = b.id
       GROUP BY b.id
       ORDER BY b.id ASC`
    )
    .all(todayDate, todayDate, currentHour) as Array<{
    id: number;
    code: string;
    name: string;
    category: string;
    location_zone: string;
    floor_area_sqm: number;
    capacity_kw: number;
    today_kwh: number;
    current_kw: number;
  }>;

  const totalCampusToday = buildingsRaw.reduce((a, b) => a + b.today_kwh, 0) || 1;

  const buildings: DigitalTwinBuilding[] = buildingsRaw.map((b) => {
    const rooms = db
      .prepare('SELECT * FROM occupancy WHERE building_id = ?')
      .all(b.id) as Array<{
      status: string;
      occupant_count: number;
      lights_on: number;
      fans_on: number;
      ac_on: number;
      computers_on: number;
    }>;

    const activeAlerts = (
      db
        .prepare("SELECT COUNT(*) as cnt FROM energy_alerts WHERE building_id = ? AND status = 'Active'")
        .get(b.id) as { cnt: number }
    ).cnt;

    const eq = rooms.reduce(
      (acc, r) => {
        acc.lights_on += r.lights_on;
        acc.fans_on += r.fans_on;
        acc.ac_on += r.ac_on;
        acc.computers_on += r.computers_on;
        acc.occupants += r.occupant_count;
        if (r.status === 'Occupied') acc.occRooms += 1;
        return acc;
      },
      { lights_on: 0, fans_on: 0, ac_on: 0, computers_on: 0, occupants: 0, occRooms: 0 }
    );

    const loadRatio = b.current_kw / Math.max(1, b.capacity_kw);
    const status: DigitalTwinBuilding['status'] =
      activeAlerts > 0 ? 'Wastage Alert' : loadRatio > 0.65 ? 'Elevated Load' : 'Nominal';

    return {
      id: b.id,
      code: b.code,
      name: b.name,
      category: b.category,
      location_zone: b.location_zone,
      floor_area_sqm: b.floor_area_sqm,
      capacity_kw: b.capacity_kw,
      current_kw: Number((b.current_kw ?? 0).toFixed(2)),
      today_kwh: b.today_kwh,
      solar_allocated_kwh: Number(
        ((b.today_kwh / totalCampusToday) * solarTotalRow.total).toFixed(1)
      ),
      active_alerts: activeAlerts,
      rooms_monitored: rooms.length,
      occupied_rooms: eq.occRooms,
      total_occupants: eq.occupants,
      equipment: {
        lights_on: eq.lights_on,
        fans_on: eq.fans_on,
        ac_on: eq.ac_on,
        computers_on: eq.computers_on,
      },
      status,
    };
  });

  const usableCap = Number((batNow.capacity_kwh * (1 - batNow.min_soc_pct / 100)).toFixed(1));

  return {
    timestamp: new Date().toISOString(),
    data_source: sim.data_source,
    solar_array: {
      capacity_kwp: 115,
      current_output_kw: Number((solarNow.generated_kwh ?? 0).toFixed(2)),
      daily_generated_kwh: Number(solarTotalRow.total.toFixed(1)),
      weather_condition: sim.weather_condition,
      inverter_efficiency_pct: 96.4,
    },
    battery_bank: {
      capacity_kwh: batNow.capacity_kwh,
      usable_capacity_kwh: usableCap,
      soc_pct: batNow.soc_percent,
      stored_kwh: batNow.stored_kwh,
      action: batNow.action,
      power_kw: batNow.power_kw,
      health_pct: 97.2,
    },
    buildings,
  };
}

export function getPeakLoadPlan(): PeakLoadPlan {
  const db = getDb();
  const opt = getCachedBatteryOptimization() ?? recomputeAIModelsFromDb().optimization;
  const loads = db.prepare('SELECT * FROM load_shifts ORDER BY id ASC').all() as Array<{
    id: number;
    load_name: string;
    source_building: string;
    power_kw: number;
    duration_hours: number;
    from_hour: number;
    to_hour: number;
    estimated_savings_inr: number;
    status: 'Deferred' | 'Scheduled Peak';
  }>;

  const shiftedAdjustments = new Array(24).fill(0);
  let totalShiftableKw = 0;
  let totalSavingsInr = 0;

  const flexibleLoads: FlexibleLoadItem[] = loads.map((l) => {
    totalShiftableKw += l.power_kw;
    if (l.status === 'Deferred') {
      totalSavingsInr += l.estimated_savings_inr;
      for (let d = 0; d < Math.ceil(l.duration_hours); d++) {
        const fh = (l.from_hour + d) % 24;
        const th = (l.to_hour + d) % 24;
        shiftedAdjustments[fh] -= l.power_kw;
        shiftedAdjustments[th] += l.power_kw;
      }
    }
    return {
      ...l,
      energy_kwh: Number((l.power_kw * l.duration_hours).toFixed(1)),
    };
  });

  let peakBefore = 0;
  let peakAfter = 0;
  const hourlyProfile = opt.schedule.map((s) => {
    const baselineKw = s.demand_kwh;
    const shiftedKw = Number(Math.max(6, baselineKw + shiftedAdjustments[s.hour]).toFixed(2));
    if (baselineKw > peakBefore) peakBefore = baselineKw;
    if (shiftedKw > peakAfter) peakAfter = shiftedKw;
    return {
      hour: s.hour,
      label: s.label,
      baseline_kw: baselineKw,
      shifted_kw: shiftedKw,
      tariff_inr: s.tariff_inr,
    };
  });

  return {
    peak_window: '11:00–15:00 & 18:00–22:00 (₹9.60/kWh Peak Tariff)',
    recommended_offpeak_window: '10:30–14:30 (Solar Surplus) & 00:00–05:00 (₹4.80/kWh)',
    peak_demand_kw: Number(peakBefore.toFixed(1)),
    post_shift_peak_kw: Number(peakAfter.toFixed(1)),
    total_shiftable_kw: Number(totalShiftableKw.toFixed(1)),
    total_estimated_savings_inr: Number(totalSavingsInr.toFixed(1)),
    hourly_profile: hourlyProfile,
    flexible_loads: flexibleLoads,
  };
}

export function computeWeatherAdjustedForecast(params: {
  weather_condition: WeatherCondition;
  temperature_c: number;
  cloud_cover_pct: number;
}): WeatherForecastResult {
  const pred = getCachedPrediction() ?? recomputeAIModelsFromDb().prediction;

  const cloudFactor = Math.max(0.18, 1 - (params.cloud_cover_pct / 100) * 0.72);
  const weatherMult =
    params.weather_condition === 'Clear Sunny'
      ? 1.0
      : params.weather_condition === 'Partly Cloudy'
        ? 0.76
        : 0.42;
  const solarScale = cloudFactor * weatherMult;

  // HVAC thermal load sensitivity: ~2.1% load increase per °C above 26°C baseline
  const tempDelta = params.temperature_c - 27.5;
  const hvacTempMultiplier = Math.max(0.86, 1 + tempDelta * 0.021);

  let peakIrr = 0;
  let totalDemand = 0;
  let totalSolar = 0;

  const hourly = pred.hourly_forecast.map((pt) => {
    const h = pt.hour;
    const bell = h >= 6 && h <= 18 ? Math.sin(((h - 6) * Math.PI) / 12) : 0;
    const hourTemp = Number((params.temperature_c - 4.5 + 6.5 * bell).toFixed(1));
    const irr = Number((940 * bell * solarScale).toFixed(1));
    if (irr > peakIrr) peakIrr = irr;

    const adjSolar = Number((92 * bell * solarScale).toFixed(2));
    const adjDemand = Number(
      (pt.predicted_kwh * (h >= 8 && h <= 20 ? hvacTempMultiplier : 0.98)).toFixed(2)
    );
    const netGrid = Number(Math.max(0, adjDemand - adjSolar).toFixed(2));

    totalDemand += adjDemand;
    totalSolar += adjSolar;

    return {
      hour: h,
      label: pt.label,
      temperature_c: hourTemp,
      irradiance_wm2: irr,
      predicted_demand_kwh: adjDemand,
      predicted_solar_kwh: adjSolar,
      net_grid_kwh: netGrid,
    };
  });

  const renewableShare =
    totalDemand > 0 ? Math.min(100, Number(((totalSolar / totalDemand) * 100).toFixed(1))) : 0;

  return {
    weather_condition: params.weather_condition,
    temperature_c: params.temperature_c,
    cloud_cover_pct: params.cloud_cover_pct,
    peak_irradiance_wm2: peakIrr,
    predicted_daily_demand_kwh: Number(totalDemand.toFixed(1)),
    predicted_solar_kwh: Number(totalSolar.toFixed(1)),
    renewable_share_pct: renewableShare,
    hourly,
  };
}

export function getCarbonSummary(): CarbonSummary {
  const db = getDb();
  const solarRows = db
    .prepare(
      `SELECT
         COALESCE(SUM(generated_kwh), 0) as gen,
         COALESCE(SUM(consumed_direct_kwh), 0) as direct,
         COALESCE(SUM(battery_charged_kwh), 0) as bat_ch,
         COALESCE(SUM(grid_import_kwh), 0) as grid
       FROM solar_generation`
    )
    .get() as { gen: number; direct: number; bat_ch: number; grid: number };

  const renewableUsed = Number((solarRows.direct + solarRows.bat_ch).toFixed(1));
  const totalCampusEnergy = Number((renewableUsed + solarRows.grid).toFixed(1));
  const campusRePct =
    totalCampusEnergy > 0 ? Number(((renewableUsed / totalCampusEnergy) * 100).toFixed(1)) : 0;

  const baselineEmissions = Number((totalCampusEnergy * GRID_EMISSION_FACTOR_KG_PER_KWH).toFixed(1));
  const actualEmissions = Number((solarRows.grid * GRID_EMISSION_FACTOR_KG_PER_KWH).toFixed(1));
  const co2Avoided = Number(Math.max(0, baselineEmissions - actualEmissions).toFixed(1));
  const treesMonthly = Math.round((co2Avoided * 30) / 1.8);

  const stateTotals = db
    .prepare(
      `SELECT
         COALESCE(SUM(daily_demand_kwh), 0) as demand,
         COALESCE(SUM(solar_generation_kwh), 0) as solar
       FROM colleges`
    )
    .get() as { demand: number; solar: number };

  const stateRePct =
    stateTotals.demand > 0
      ? Number(((stateTotals.solar / stateTotals.demand) * 100).toFixed(1))
      : 0;
  const stateCo2AvoidedDay = Number((stateTotals.solar * GRID_EMISSION_FACTOR_KG_PER_KWH).toFixed(1));

  return {
    grid_emission_factor_kg_per_kwh: GRID_EMISSION_FACTOR_KG_PER_KWH,
    campus: {
      total_energy_kwh: totalCampusEnergy,
      renewable_energy_used_kwh: renewableUsed,
      grid_energy_kwh: Number(solarRows.grid.toFixed(1)),
      renewable_pct: campusRePct,
      baseline_emissions_kg: baselineEmissions,
      actual_emissions_kg: actualEmissions,
      co2_avoided_kg: co2Avoided,
      equivalent_trees_monthly: treesMonthly,
    },
    statewide: {
      total_energy_kwh: Number(stateTotals.demand.toFixed(1)),
      renewable_energy_kwh: Number(stateTotals.solar.toFixed(1)),
      renewable_pct: stateRePct,
      co2_avoided_kg: stateCo2AvoidedDay,
      co2_avoided_tonnes_annual: Number(((stateCo2AvoidedDay * 365) / 1000).toFixed(1)),
    },
    formulas: {
      energy_kwh: 'E (kWh) = P (kW) × t (hours)',
      renewable_pct: 'RE% = (Renewable Energy Used / Total Energy Used) × 100',
      energy_cost: 'Cost (₹) = Grid Energy (kWh) × Time-of-Use Tariff (₹/kWh)',
      battery_soc_pct: 'SOC% = (Stored Energy / Usable Battery Capacity) × 100 (adjusted for η_ch, η_dis & reserve)',
      carbon_avoided_kg: 'CO₂ Avoided (kg) = Renewable Energy Used (kWh) × 0.82 kg CO₂/kWh',
    },
  };
}

export function getGreenLeaderboard(): GreenLeaderboardEntry[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, d.name as district_name
       FROM colleges c
       JOIN districts d ON d.id = c.district_id`
    )
    .all() as Array<
    CollegeRecord & {
      student_count: number;
      wastage_reduction_pct: number;
      battery_efficiency_pct: number;
      improvement_delta_pct: number;
    }
  >;

  const scored = rows.map((c) => {
    const students = Math.max(200, c.student_count || 2200);
    const kwhPerStudent = Number((c.daily_demand_kwh / students).toFixed(3));
    const renewablePct = Math.min(
      100,
      Number(((c.solar_generation_kwh / Math.max(1, c.daily_demand_kwh)) * 100).toFixed(1))
    );
    const co2Avoided = Number((c.solar_generation_kwh * GRID_EMISSION_FACTOR_KG_PER_KWH).toFixed(1));

    // Normalized Green Score (rewards low kWh/student, high RE%, wastage reduction, BESS efficiency, and positive YoY delta)
    const intensityScore = Math.max(0, Math.min(25, (1 - kwhPerStudent / 1.1) * 28));
    const reScore = Math.min(30, renewablePct * 0.72);
    const wastageScore = Math.min(20, c.wastage_reduction_pct * 0.8);
    const batScore = Math.min(15, ((c.battery_efficiency_pct - 80) / 16) * 15);
    const improvementScore = Math.min(10, c.improvement_delta_pct * 0.68);
    const composite = Number(
      (intensityScore + reScore + wastageScore + batScore + improvementScore).toFixed(1)
    );

    return {
      rank: 0,
      college_id: c.id,
      code: c.code,
      name: c.name,
      district_name: c.district_name ?? 'Karnataka',
      city: c.city,
      student_count: students,
      kwh_per_student: kwhPerStudent,
      renewable_pct: renewablePct,
      wastage_reduction_pct: c.wastage_reduction_pct,
      battery_efficiency_pct: c.battery_efficiency_pct,
      co2_avoided_kg_per_day: co2Avoided,
      improvement_delta_pct: c.improvement_delta_pct,
      composite_green_score: composite,
    };
  });

  scored.sort((a, b) => b.composite_green_score - a.composite_green_score);
  return scored.map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export function getNotificationsList(): SmartNotification[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM notifications ORDER BY is_read ASC, id DESC LIMIT 30')
    .all() as SmartNotification[];
}

export function getMaintenanceList(): MaintenanceDiagnostic[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM maintenance_issues ORDER BY health_score_pct ASC')
    .all() as MaintenanceDiagnostic[];
}

export function getReliabilityOverview(): SystemReliabilityOverview {
  const db = getDb();
  const migrations = db
    .prepare('SELECT version, description, applied_at FROM schema_migrations ORDER BY version ASC')
    .all() as SystemReliabilityOverview['migrations'];
  const offline_buffer = db
    .prepare('SELECT * FROM offline_buffer ORDER BY id DESC LIMIT 20')
    .all() as SystemReliabilityOverview['offline_buffer'];
  const model_metrics_history = db
    .prepare('SELECT * FROM model_metrics_history ORDER BY id DESC LIMIT 15')
    .all() as SystemReliabilityOverview['model_metrics_history'];
  const audit_logs = db
    .prepare('SELECT id, actor_email, actor_role, action, resource, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 25')
    .all() as SystemReliabilityOverview['audit_logs'];

  return {
    migrations,
    backups: listDatabaseBackups(),
    rate_limiter: getRateLimiterStats(),
    offline_buffer,
    model_metrics_history,
    audit_logs,
    data_privacy: {
      college_isolation_enforced: true,
      password_hashing: 'Salted crypto.scryptSync (64-byte key)',
      token_signing: 'HMAC-SHA256 HttpOnly SameSite=None/Lax + Bearer',
      validated_sensor_bounds: 'kWh [0..500], Temp [-10..65°C], SOC [0..100%]',
    },
  };
}
