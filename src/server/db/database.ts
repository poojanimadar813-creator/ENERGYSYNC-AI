import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'energysync.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initializeSchema(dbInstance);
  }
  return dbInstance;
}

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Administrator',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      floor_area_sqm REAL NOT NULL,
      capacity_kw REAL NOT NULL,
      baseline_daily_kwh REAL NOT NULL,
      location_zone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS energy_consumption (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
      day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
      month INTEGER NOT NULL CHECK(month >= 1 AND month <= 12),
      consumption_kwh REAL NOT NULL CHECK(consumption_kwh >= 0),
      occupancy_count INTEGER NOT NULL DEFAULT 0,
      temperature_c REAL NOT NULL DEFAULT 28.0,
      solar_generation_kwh REAL NOT NULL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'SIMULATED DATA',
      is_holiday INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_energy_ts ON energy_consumption(timestamp);
    CREATE INDEX IF NOT EXISTS idx_energy_bldg ON energy_consumption(building_id, timestamp);

    CREATE TABLE IF NOT EXISTS occupancy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL UNIQUE,
      building_id INTEGER NOT NULL,
      room_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Empty',
      occupant_count INTEGER NOT NULL DEFAULT 0,
      capacity INTEGER NOT NULL DEFAULT 60,
      lights_on INTEGER NOT NULL DEFAULT 0,
      fans_on INTEGER NOT NULL DEFAULT 0,
      ac_on INTEGER NOT NULL DEFAULT 0,
      computers_on INTEGER NOT NULL DEFAULT 0,
      current_load_kw REAL NOT NULL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'SIMULATED DATA',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS solar_generation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
      weather_condition TEXT NOT NULL DEFAULT 'Clear Sunny',
      irradiance_wm2 REAL NOT NULL DEFAULT 0,
      generated_kwh REAL NOT NULL DEFAULT 0,
      consumed_direct_kwh REAL NOT NULL DEFAULT 0,
      excess_kwh REAL NOT NULL DEFAULT 0,
      battery_charged_kwh REAL NOT NULL DEFAULT 0,
      grid_import_kwh REAL NOT NULL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'SIMULATED DATA'
    );

    CREATE TABLE IF NOT EXISTS battery_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      capacity_kwh REAL NOT NULL DEFAULT 200,
      soc_percent REAL NOT NULL DEFAULT 55,
      stored_kwh REAL NOT NULL DEFAULT 110,
      max_charge_kw REAL NOT NULL DEFAULT 45,
      max_discharge_kw REAL NOT NULL DEFAULT 45,
      efficiency_pct REAL NOT NULL DEFAULT 94,
      min_soc_pct REAL NOT NULL DEFAULT 15,
      max_soc_pct REAL NOT NULL DEFAULT 95,
      action TEXT NOT NULL DEFAULT 'IDLE',
      power_kw REAL NOT NULL DEFAULT 0,
      tariff_inr_per_kwh REAL NOT NULL DEFAULT 6.9,
      data_source TEXT NOT NULL DEFAULT 'SIMULATED DATA'
    );

    CREATE TABLE IF NOT EXISTS energy_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      detected_kwh REAL NOT NULL,
      expected_kwh REAL NOT NULL,
      anomaly_score REAL NOT NULL,
      severity TEXT NOT NULL,
      reason TEXT NOT NULL,
      suggested_action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      data_source TEXT NOT NULL DEFAULT 'SIMULATED DATA',
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_hour INTEGER NOT NULL,
      predicted_kwh REAL NOT NULL,
      actual_kwh REAL,
      confidence_lower REAL NOT NULL,
      confidence_upper REAL NOT NULL,
      model_name TEXT NOT NULL DEFAULT 'RandomForestRegressor',
      mae REAL NOT NULL DEFAULT 0,
      rmse REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS optimization_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      building_id INTEGER,
      estimated_savings_kwh REAL NOT NULL,
      estimated_savings_inr REAL NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Pending',
      rationale TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS simulation_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      scenario_name TEXT NOT NULL DEFAULT 'Standard Academic Weekday',
      weather_condition TEXT NOT NULL DEFAULT 'Clear Sunny',
      is_holiday INTEGER NOT NULL DEFAULT 0,
      tariff_offpeak_inr REAL NOT NULL DEFAULT 4.8,
      tariff_standard_inr REAL NOT NULL DEFAULT 6.9,
      tariff_peak_inr REAL NOT NULL DEFAULT 9.6,
      last_run_at TEXT NOT NULL DEFAULT (datetime('now')),
      run_count INTEGER NOT NULL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'SIMULATED DATA'
    );

    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      zone TEXT NOT NULL DEFAULT 'North Karnataka',
      nodal_officer TEXT NOT NULL DEFAULT 'District Energy Officer',
      target_savings_pct REAL NOT NULL DEFAULT 18.0,
      tariff_zone TEXT NOT NULL DEFAULT 'HESCOM / BESCOM Institutional',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      district_id INTEGER NOT NULL,
      city TEXT NOT NULL,
      campus_type TEXT NOT NULL DEFAULT 'Engineering College',
      connected_buildings INTEGER NOT NULL DEFAULT 4,
      solar_capacity_kwp REAL NOT NULL DEFAULT 80,
      battery_capacity_kwh REAL NOT NULL DEFAULT 150,
      daily_demand_kwh REAL NOT NULL DEFAULT 1400,
      solar_generation_kwh REAL NOT NULL DEFAULT 360,
      battery_soc_pct REAL NOT NULL DEFAULT 62,
      grid_import_kwh REAL NOT NULL DEFAULT 920,
      estimated_savings_inr REAL NOT NULL DEFAULT 2800,
      active_alerts INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Active',
      data_source TEXT NOT NULL DEFAULT 'SIMULATED DATA',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_email TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'Medium',
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'SIMULATED DATA',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS offline_buffer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      building_id INTEGER NOT NULL,
      consumption_kwh REAL NOT NULL,
      occupancy_count INTEGER NOT NULL DEFAULT 0,
      temperature_c REAL NOT NULL DEFAULT 28.0,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS model_metrics_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_name TEXT NOT NULL,
      mae REAL NOT NULL,
      rmse REAL NOT NULL,
      r2_score REAL NOT NULL,
      train_samples INTEGER NOT NULL,
      test_samples INTEGER NOT NULL,
      weather_condition TEXT NOT NULL DEFAULT 'Clear Sunny',
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_code TEXT NOT NULL UNIQUE,
      asset_name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      health_score_pct REAL NOT NULL,
      risk_level TEXT NOT NULL,
      diagnostic_signal TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      detected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS load_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      load_name TEXT NOT NULL UNIQUE,
      source_building TEXT NOT NULL,
      power_kw REAL NOT NULL,
      duration_hours REAL NOT NULL,
      from_hour INTEGER NOT NULL,
      to_hour INTEGER NOT NULL,
      estimated_savings_inr REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled Peak',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe additive migration for users.college & users.district on existing DBs
  const userCols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const colNames = new Set(userCols.map((c) => c.name));
  if (!colNames.has('college')) {
    db.exec(`ALTER TABLE users ADD COLUMN college TEXT DEFAULT 'BLDEACET Vijayapura'`);
  }
  if (!colNames.has('district')) {
    db.exec(`ALTER TABLE users ADD COLUMN district TEXT DEFAULT 'Vijayapura'`);
  }

  // Safe additive columns on colleges for normalized Green Campus Leaderboard metrics
  const collegeCols = db.prepare('PRAGMA table_info(colleges)').all() as Array<{ name: string }>;
  const cNames = new Set(collegeCols.map((c) => c.name));
  if (!cNames.has('student_count')) {
    db.exec(`ALTER TABLE colleges ADD COLUMN student_count INTEGER NOT NULL DEFAULT 2200`);
  }
  if (!cNames.has('wastage_reduction_pct')) {
    db.exec(`ALTER TABLE colleges ADD COLUMN wastage_reduction_pct REAL NOT NULL DEFAULT 16.5`);
  }
  if (!cNames.has('battery_efficiency_pct')) {
    db.exec(`ALTER TABLE colleges ADD COLUMN battery_efficiency_pct REAL NOT NULL DEFAULT 93.0`);
  }
  if (!cNames.has('improvement_delta_pct')) {
    db.exec(`ALTER TABLE colleges ADD COLUMN improvement_delta_pct REAL NOT NULL DEFAULT 8.4`);
  }

  // Record versioned migrations idempotently
  const insertMig = db.prepare(
    `INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (?, ?)`
  );
  insertMig.run('001_core_campus', 'Initial 9-table campus energy, ML prediction, anomaly, solar & battery schema');
  insertMig.run('002_karnataka_statewide', 'Karnataka districts, college registry, and user institution columns');
  insertMig.run(
    '003_advanced_reliability',
    'Digital twin, peak load shifting, predictive maintenance, notifications, offline buffer, audit logs, and green leaderboard metrics'
  );
}
