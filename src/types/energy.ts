export type DataSourceLabel = 'SIMULATED DATA' | 'LIVE SENSOR DATA';

export type WeatherCondition = 'Clear Sunny' | 'Partly Cloudy' | 'Monsoon Overcast';

export interface UserPublic {
  id: number;
  email: string;
  name: string;
  role: string;
  college?: string;
  district?: string;
  created_at: string;
}

export interface Building {
  id: number;
  code: string;
  name: string;
  category: string;
  floor_area_sqm: number;
  capacity_kw: number;
  baseline_daily_kwh: number;
  location_zone: string;
}

export interface EnergyConsumptionRecord {
  id: number;
  building_id: number;
  building_name?: string;
  building_code?: string;
  timestamp: string;
  hour: number;
  day_of_week: number;
  month: number;
  consumption_kwh: number;
  occupancy_count: number;
  temperature_c: number;
  solar_generation_kwh: number;
  data_source: DataSourceLabel;
  is_holiday: number;
}

export interface OccupancyRoom {
  id: number;
  room_code: string;
  building_id: number;
  building_name?: string;
  room_name: string;
  status: 'Occupied' | 'Empty' | 'Standby';
  occupant_count: number;
  capacity: number;
  lights_on: number;
  fans_on: number;
  ac_on: number;
  computers_on: number;
  current_load_kw: number;
  data_source: DataSourceLabel;
  updated_at: string;
}

export interface SolarRecord {
  id: number;
  timestamp: string;
  hour: number;
  weather_condition: WeatherCondition;
  irradiance_wm2: number;
  generated_kwh: number;
  consumed_direct_kwh: number;
  excess_kwh: number;
  battery_charged_kwh: number;
  grid_import_kwh: number;
  data_source: DataSourceLabel;
}

export interface BatteryStatusRecord {
  id: number;
  timestamp: string;
  capacity_kwh: number;
  soc_percent: number;
  stored_kwh: number;
  max_charge_kw: number;
  max_discharge_kw: number;
  efficiency_pct: number;
  min_soc_pct: number;
  max_soc_pct: number;
  action: 'CHARGE' | 'DISCHARGE' | 'IDLE' | 'SOLAR_STORE';
  power_kw: number;
  tariff_inr_per_kwh: number;
  data_source: DataSourceLabel;
}

export interface EnergyAlert {
  id: number;
  building_id: number;
  building_name?: string;
  timestamp: string;
  detected_kwh: number;
  expected_kwh: number;
  anomaly_score: number;
  severity: 'High' | 'Medium' | 'Low';
  reason: string;
  suggested_action: string;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  data_source: DataSourceLabel;
}

export interface AIPredictionPoint {
  id: number;
  target_hour: number;
  predicted_kwh: number;
  actual_kwh: number | null;
  confidence_lower: number;
  confidence_upper: number;
  model_name: string;
  mae: number;
  rmse: number;
  created_at: string;
}

export interface OptimizationRecommendation {
  id: number;
  title: string;
  category: 'HVAC & Lighting' | 'Lab Scheduling' | 'Solar Allocation' | 'Battery Dispatch' | 'Peak Shaving';
  building_id: number | null;
  building_name?: string;
  estimated_savings_kwh: number;
  estimated_savings_inr: number;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Approved' | 'Rejected';
  rationale: string;
  created_at: string;
}

export interface BatteryScheduleHour {
  hour: number;
  label: string;
  demand_kwh: number;
  solar_kwh: number;
  tariff_inr: number;
  tariff_tier: 'Off-Peak' | 'Standard' | 'Peak';
  // Baseline naive strategy
  baseline_action: 'CHARGE' | 'DISCHARGE' | 'IDLE';
  baseline_soc_pct: number;
  baseline_grid_kwh: number;
  baseline_cost_inr: number;
  // EnergySync AI optimized strategy
  optimized_action: 'SOLAR_STORE' | 'GRID_CHARGE' | 'DISCHARGE' | 'IDLE';
  battery_flow_kw: number; // + charging into battery, - discharging to load
  solar_direct_kwh: number;
  solar_to_battery_kwh: number;
  battery_to_load_kwh: number;
  optimized_soc_pct: number;
  optimized_grid_kwh: number;
  optimized_cost_inr: number;
}

export interface BatteryOptimizationResult {
  params: {
    capacity_kwh: number;
    initial_soc_pct: number;
    min_soc_pct: number;
    max_soc_pct: number;
    max_charge_kw: number;
    max_discharge_kw: number;
    efficiency_pct: number;
  };
  summary: {
    total_demand_kwh: number;
    total_solar_kwh: number;
    baseline_grid_kwh: number;
    optimized_grid_kwh: number;
    baseline_cost_inr: number;
    optimized_cost_inr: number;
    estimated_cost_savings_inr: number;
    estimated_cost_savings_pct: number;
    peak_grid_reduction_kw: number;
    grid_dependency_reduction_pct: number;
  };
  schedule: BatteryScheduleHour[];
  data_source: DataSourceLabel;
}

export interface PredictionSummary {
  model_name: string;
  features_used: string[];
  train_samples: number;
  test_samples: number;
  mae: number;
  rmse: number;
  r2_score: number;
  predicted_daily_total_kwh: number;
  expected_peak_demand_kwh: number;
  expected_peak_hour: number;
  recommended_utilization_window: string;
  hourly_forecast: Array<{
    hour: number;
    label: string;
    actual_kwh: number | null;
    predicted_kwh: number;
    confidence_lower: number;
    confidence_upper: number;
    solar_kwh: number;
    temperature_c: number;
    occupancy_rate: number;
  }>;
  test_evaluation: Array<{
    timestamp: string;
    actual_kwh: number;
    predicted_kwh: number;
    error_kwh: number;
  }>;
  feature_importance: Array<{
    feature: string;
    importance_pct: number;
  }>;
  data_source: DataSourceLabel;
}

export interface DashboardSummary {
  campus_name: string;
  simulation_state: {
    scenario_name: string;
    weather_condition: WeatherCondition;
    is_holiday: boolean;
    last_run_at: string;
    run_count: number;
    data_source: DataSourceLabel;
  };
  kpis: {
    total_consumption_kwh: number;
    today_consumption_kwh: number;
    monthly_consumption_kwh: number;
    estimated_daily_cost_inr: number;
    solar_generation_today_kwh: number;
    solar_utilization_pct: number;
    battery_soc_pct: number;
    battery_stored_kwh: number;
    battery_capacity_kwh: number;
    grid_usage_today_kwh: number;
    estimated_savings_inr: number;
    estimated_savings_kwh: number;
    active_alerts_count: number;
  };
  energy_flow: {
    solar_generated_kw: number;
    solar_direct_kw: number;
    excess_solar_to_battery_kw: number;
    battery_discharge_kw: number;
    grid_import_kw: number;
    campus_demand_kw: number;
  };
  hourly_series: Array<{
    hour: number;
    label: string;
    consumption_kwh: number;
    predicted_kwh: number;
    solar_kwh: number;
    grid_kwh: number;
    battery_soc_pct: number;
  }>;
  building_breakdown: Array<{
    id: number;
    code: string;
    name: string;
    category: string;
    today_kwh: number;
    peak_kw: number;
    baseline_daily_kwh: number;
    efficiency_delta_pct: number;
  }>;
  recent_alerts: EnergyAlert[];
  top_recommendations: OptimizationRecommendation[];
}

export interface DistrictRecord {
  id: number;
  code: string;
  name: string;
  zone: string;
  nodal_officer: string;
  target_savings_pct: number;
  tariff_zone: string;
  created_at: string;
  college_count?: number;
  total_solar_kwp?: number;
  total_daily_demand_kwh?: number;
  total_solar_gen_kwh?: number;
  total_savings_inr?: number;
}

export interface CollegeRecord {
  id: number;
  code: string;
  name: string;
  district_id: number;
  district_name?: string;
  district_code?: string;
  city: string;
  campus_type: string;
  connected_buildings: number;
  solar_capacity_kwp: number;
  battery_capacity_kwh: number;
  daily_demand_kwh: number;
  solar_generation_kwh: number;
  battery_soc_pct: number;
  grid_import_kwh: number;
  estimated_savings_inr: number;
  active_alerts: number;
  status: 'Active' | 'Onboarding' | 'Maintenance';
  data_source: DataSourceLabel;
  created_at: string;
}

export interface StateDashboardSummary {
  network_name: string;
  kpis: {
    total_colleges: number;
    active_colleges: number;
    covered_districts: number;
    total_daily_demand_kwh: number;
    total_solar_generation_kwh: number;
    total_solar_capacity_kwp: number;
    total_battery_capacity_kwh: number;
    avg_battery_soc_pct: number;
    total_grid_import_kwh: number;
    total_estimated_savings_inr: number;
    total_active_alerts: number;
  };
  district_breakdown: Array<{
    id: number;
    code: string;
    name: string;
    zone: string;
    college_count: number;
    daily_demand_kwh: number;
    solar_generation_kwh: number;
    grid_import_kwh: number;
    estimated_savings_inr: number;
    solar_offset_pct: number;
  }>;
  top_colleges: CollegeRecord[];
}

export interface DistrictAnalyticsRow {
  district_id: number;
  district_code: string;
  district_name: string;
  zone: string;
  target_savings_pct: number;
  college_count: number;
  solar_capacity_kwp: number;
  daily_demand_kwh: number;
  solar_generation_kwh: number;
  grid_import_kwh: number;
  estimated_savings_inr: number;
  solar_share_pct: number;
  avg_battery_soc_pct: number;
  active_alerts: number;
}

export interface StatewideReportsSummary {
  generated_at: string;
  totals: {
    colleges: number;
    districts: number;
    daily_demand_kwh: number;
    solar_generation_kwh: number;
    grid_import_kwh: number;
    estimated_daily_savings_inr: number;
    estimated_monthly_savings_inr: number;
  };
  district_summary: DistrictAnalyticsRow[];
  college_summary: CollegeRecord[];
}

export interface DigitalTwinBuilding {
  id: number;
  code: string;
  name: string;
  category: string;
  location_zone: string;
  floor_area_sqm: number;
  capacity_kw: number;
  current_kw: number;
  today_kwh: number;
  solar_allocated_kwh: number;
  active_alerts: number;
  rooms_monitored: number;
  occupied_rooms: number;
  total_occupants: number;
  equipment: {
    lights_on: number;
    fans_on: number;
    ac_on: number;
    computers_on: number;
  };
  status: 'Nominal' | 'Elevated Load' | 'Wastage Alert';
}

export interface DigitalTwinState {
  timestamp: string;
  data_source: DataSourceLabel;
  solar_array: {
    capacity_kwp: number;
    current_output_kw: number;
    daily_generated_kwh: number;
    weather_condition: WeatherCondition;
    inverter_efficiency_pct: number;
  };
  battery_bank: {
    capacity_kwh: number;
    usable_capacity_kwh: number;
    soc_pct: number;
    stored_kwh: number;
    action: string;
    power_kw: number;
    health_pct: number;
  };
  buildings: DigitalTwinBuilding[];
}

export interface FlexibleLoadItem {
  id: number;
  load_name: string;
  source_building: string;
  power_kw: number;
  duration_hours: number;
  energy_kwh: number;
  from_hour: number;
  to_hour: number;
  estimated_savings_inr: number;
  status: 'Deferred' | 'Scheduled Peak';
}

export interface PeakLoadPlan {
  peak_window: string;
  recommended_offpeak_window: string;
  peak_demand_kw: number;
  post_shift_peak_kw: number;
  total_shiftable_kw: number;
  total_estimated_savings_inr: number;
  hourly_profile: Array<{
    hour: number;
    label: string;
    baseline_kw: number;
    shifted_kw: number;
    tariff_inr: number;
  }>;
  flexible_loads: FlexibleLoadItem[];
}

export interface MaintenanceDiagnostic {
  id: number;
  asset_code: string;
  asset_name: string;
  asset_type: 'Solar Inverter' | 'Battery Bank' | 'HVAC System' | 'Smart Meter';
  health_score_pct: number;
  risk_level: 'High' | 'Medium' | 'Low';
  diagnostic_signal: string;
  recommended_action: string;
  status: 'Open' | 'Scheduled' | 'Resolved';
  detected_at: string;
}

export interface WeatherForecastResult {
  weather_condition: WeatherCondition;
  temperature_c: number;
  cloud_cover_pct: number;
  peak_irradiance_wm2: number;
  predicted_daily_demand_kwh: number;
  predicted_solar_kwh: number;
  renewable_share_pct: number;
  hourly: Array<{
    hour: number;
    label: string;
    temperature_c: number;
    irradiance_wm2: number;
    predicted_demand_kwh: number;
    predicted_solar_kwh: number;
    net_grid_kwh: number;
  }>;
}

export interface SmartNotification {
  id: number;
  title: string;
  category: 'Excessive Consumption' | 'Low Battery' | 'Device Offline' | 'Anomaly Pattern' | 'System';
  severity: 'High' | 'Medium' | 'Low';
  message: string;
  is_read: number;
  data_source: DataSourceLabel;
  created_at: string;
}

export interface CarbonSummary {
  grid_emission_factor_kg_per_kwh: number;
  campus: {
    total_energy_kwh: number;
    renewable_energy_used_kwh: number;
    grid_energy_kwh: number;
    renewable_pct: number;
    baseline_emissions_kg: number;
    actual_emissions_kg: number;
    co2_avoided_kg: number;
    equivalent_trees_monthly: number;
  };
  statewide: {
    total_energy_kwh: number;
    renewable_energy_kwh: number;
    renewable_pct: number;
    co2_avoided_kg: number;
    co2_avoided_tonnes_annual: number;
  };
  formulas: {
    energy_kwh: string;
    renewable_pct: string;
    energy_cost: string;
    battery_soc_pct: string;
    carbon_avoided_kg: string;
  };
}

export interface GreenLeaderboardEntry {
  rank: number;
  college_id: number;
  code: string;
  name: string;
  district_name: string;
  city: string;
  student_count: number;
  kwh_per_student: number;
  renewable_pct: number;
  wastage_reduction_pct: number;
  battery_efficiency_pct: number;
  co2_avoided_kg_per_day: number;
  improvement_delta_pct: number;
  composite_green_score: number;
}

export interface SystemReliabilityOverview {
  migrations: Array<{ version: string; description: string; applied_at: string }>;
  backups: Array<{ filename: string; size_kb: number; created_at: string }>;
  rate_limiter: {
    window_seconds: number;
    max_requests_per_window: number;
    tracked_clients: number;
    blocked_requests: number;
  };
  offline_buffer: Array<{
    id: number;
    device_id: string;
    building_id: number;
    consumption_kwh: number;
    occupancy_count: number;
    temperature_c: number;
    captured_at: string;
    synced: number;
    synced_at: string | null;
  }>;
  model_metrics_history: Array<{
    id: number;
    model_name: string;
    mae: number;
    rmse: number;
    r2_score: number;
    train_samples: number;
    test_samples: number;
    weather_condition: string;
    recorded_at: string;
  }>;
  audit_logs: Array<{
    id: number;
    actor_email: string;
    actor_role: string;
    action: string;
    resource: string;
    details: string;
    created_at: string;
  }>;
  data_privacy: {
    college_isolation_enforced: boolean;
    password_hashing: string;
    token_signing: string;
    validated_sensor_bounds: string;
  };
}
