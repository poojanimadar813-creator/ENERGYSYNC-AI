/**
 * ENERGYSYNC AI — Intelligent Battery Storage & Solar Dispatch Optimizer
 *
 * Implements a constrained 24-hour multi-period energy scheduling optimizer.
 *
 * Energy Flow Priority:
 *   SOLAR GENERATION -> DIRECT ENERGY CONSUMPTION -> EXCESS SOLAR
 *     -> BATTERY STORAGE -> FUTURE ENERGY DEMAND (Peak Shaving)
 *   GRID ELECTRICITY supplies remaining demand whenever solar + battery are insufficient.
 *
 * Physical Constraints Enforced at Every Timestep (t = 0..23):
 *   1. Battery capacity: 0 <= stored_kwh <= capacity_kwh
 *   2. Safe State of Charge window: min_soc_pct <= SOC_t <= max_soc_pct
 *   3. Charge power limit: charge_kw <= max_charge_kw
 *   4. Discharge power limit: discharge_kw <= max_discharge_kw
 *   5. Charge & discharge efficiency losses (eta_ch, eta_dis)
 *
 * Compares:
 *   - Baseline Strategy: Naive greedy self-consumption without tariff-aware peak lookahead
 *   - ENERGYSYNC AI Optimized Schedule: Pre-allocates solar & off-peak headroom to maximize
 *     discharging during high-tariff peak demand hours (17:00–22:00 & 11:00–15:00).
 */

import type {
  BatteryOptimizationResult,
  BatteryScheduleHour,
  DataSourceLabel,
} from '../../types/energy.ts';

export interface BatteryOptimizerInput {
  hourly_demand_kwh: number[]; // length 24
  hourly_solar_kwh: number[]; // length 24
  capacity_kwh?: number;
  initial_soc_pct?: number;
  min_soc_pct?: number;
  max_soc_pct?: number;
  max_charge_kw?: number;
  max_discharge_kw?: number;
  efficiency_pct?: number;
  tariff_offpeak_inr?: number;
  tariff_standard_inr?: number;
  tariff_peak_inr?: number;
  data_source?: DataSourceLabel;
}

export function getHourlyTariff(
  hour: number,
  offpeak = 4.8,
  standard = 6.9,
  peak = 9.6
): { tariff: number; tier: 'Off-Peak' | 'Standard' | 'Peak' } {
  // Indian institutional Time-of-Use tariff blocks
  if (hour >= 0 && hour <= 5) {
    return { tariff: offpeak, tier: 'Off-Peak' };
  }
  if ((hour >= 11 && hour <= 15) || (hour >= 18 && hour <= 22)) {
    return { tariff: peak, tier: 'Peak' };
  }
  return { tariff: standard, tier: 'Standard' };
}

export function optimizeBatterySchedule(input: BatteryOptimizerInput): BatteryOptimizationResult {
  const capacityKwh = Math.max(40, input.capacity_kwh ?? 200);
  const minSocPct = Math.min(40, Math.max(5, input.min_soc_pct ?? 15));
  const maxSocPct = Math.min(100, Math.max(60, input.max_soc_pct ?? 95));
  const initialSocPct = Math.min(maxSocPct, Math.max(minSocPct, input.initial_soc_pct ?? 52));
  const maxChargeKw = Math.max(5, input.max_charge_kw ?? 45);
  const maxDischargeKw = Math.max(5, input.max_discharge_kw ?? 45);
  const efficiencyPct = Math.min(99, Math.max(75, input.efficiency_pct ?? 94));
  const etaSingle = Math.sqrt(efficiencyPct / 100); // split round-trip efficiency equally

  const minStored = (minSocPct / 100) * capacityKwh;
  const maxStored = (maxSocPct / 100) * capacityKwh;

  const offpeakTariff = input.tariff_offpeak_inr ?? 4.8;
  const standardTariff = input.tariff_standard_inr ?? 6.9;
  const peakTariff = input.tariff_peak_inr ?? 9.6;

  // Lookahead calculation: determine total evening + peak net deficit to reserve battery energy
  const hourlyTariffs = Array.from({ length: 24 }, (_, h) =>
    getHourlyTariff(h, offpeakTariff, standardTariff, peakTariff)
  );

  // Dynamic peak-hour deficit assessment for lookahead planning
  const futurePeakDeficitFromHour = new Array(24).fill(0);
  let runningPeakDeficit = 0;
  for (let h = 23; h >= 0; h--) {
    const netLoad = Math.max(0, (input.hourly_demand_kwh[h] ?? 0) - (input.hourly_solar_kwh[h] ?? 0));
    if (hourlyTariffs[h].tier === 'Peak') {
      runningPeakDeficit += netLoad;
    }
    futurePeakDeficitFromHour[h] = runningPeakDeficit;
  }

  let baseStored = (initialSocPct / 100) * capacityKwh;
  let optStored = (initialSocPct / 100) * capacityKwh;

  const schedule: BatteryScheduleHour[] = [];

  let totalDemand = 0;
  let totalSolar = 0;
  let totalBaseGrid = 0;
  let totalOptGrid = 0;
  let totalBaseCost = 0;
  let totalOptCost = 0;
  let peakBaseGridKw = 0;
  let peakOptGridKw = 0;

  for (let h = 0; h < 24; h++) {
    const demand = Math.max(0, input.hourly_demand_kwh[h] ?? 0);
    const solar = Math.max(0, input.hourly_solar_kwh[h] ?? 0);
    const { tariff, tier } = hourlyTariffs[h];

    totalDemand += demand;
    totalSolar += solar;

    const solarDirect = Math.min(demand, solar);
    const excessSolar = Math.max(0, solar - demand);
    const remainingDemand = Math.max(0, demand - solarDirect);

    // ------------------------------------------------------------
    // 1. BASELINE STRATEGY (Naive greedy charge/discharge, no tariff awareness)
    // ------------------------------------------------------------
    let baseAction: 'CHARGE' | 'DISCHARGE' | 'IDLE' = 'IDLE';
    let baseGrid = remainingDemand;

    if (excessSolar > 0.1 && baseStored < maxStored) {
      const chargeAllowed = Math.min(excessSolar, maxChargeKw, (maxStored - baseStored) / etaSingle);
      baseStored += chargeAllowed * etaSingle;
      baseAction = 'CHARGE';
    } else if (remainingDemand > 0.1 && baseStored > minStored) {
      // Naive baseline immediately drains battery during morning standard tariff hours
      const dischargePotential = Math.min(
        remainingDemand,
        maxDischargeKw,
        (baseStored - minStored) * etaSingle
      );
      baseStored -= dischargePotential / etaSingle;
      baseGrid = Math.max(0, remainingDemand - dischargePotential);
      baseAction = 'DISCHARGE';
    }

    const baseCost = baseGrid * tariff;
    const baseSocPct = (baseStored / capacityKwh) * 100;
    totalBaseGrid += baseGrid;
    totalBaseCost += baseCost;
    if (baseGrid > peakBaseGridKw) peakBaseGridKw = baseGrid;

    // ------------------------------------------------------------
    // 2. ENERGYSYNC AI OPTIMIZED STRATEGY
    // ------------------------------------------------------------
    let optAction: 'SOLAR_STORE' | 'GRID_CHARGE' | 'DISCHARGE' | 'IDLE' = 'IDLE';
    let solarToBattery = 0;
    let batteryToLoad = 0;
    let gridChargeKwh = 0;
    let batteryFlowKw = 0;
    let optGrid = remainingDemand;

    // Step A: Always store excess solar first (zero marginal cost)
    if (excessSolar > 0.1 && optStored < maxStored - 0.01) {
      const maxAcInput = Math.min(excessSolar, maxChargeKw, (maxStored - optStored) / etaSingle);
      solarToBattery = maxAcInput;
      optStored += solarToBattery * etaSingle;
      batteryFlowKw = solarToBattery;
      optAction = 'SOLAR_STORE';
    }
    // Step B: Off-peak tariff arbitrage charging ONLY if upcoming peak deficit cannot be met by solar alone
    else if (tier === 'Off-Peak' && optStored < maxStored * 0.85) {
      // Calculate expected daytime solar surplus between hours 9..16
      let expectedDaytimeSolarSurplus = 0;
      for (let sh = Math.max(h + 1, 9); sh <= 16; sh++) {
        expectedDaytimeSolarSurplus += Math.max(
          0,
          (input.hourly_solar_kwh[sh] ?? 0) - (input.hourly_demand_kwh[sh] ?? 0)
        );
      }
      const eveningPeakNeed = futurePeakDeficitFromHour[Math.max(h, 17)] ?? 0;
      const targetReserve = Math.min(
        maxStored,
        minStored + Math.max(0, eveningPeakNeed - expectedDaytimeSolarSurplus * 0.7) / etaSingle
      );

      // Only charge from off-peak grid when peak tariff ratio justifies round-trip efficiency loss
      const arbitrageMargin = peakTariff * etaSingle * etaSingle > tariff * 1.15;
      if (arbitrageMargin && optStored < targetReserve - 1.0) {
        const needed = targetReserve - optStored;
        const chargeInput = Math.min(maxChargeKw * 0.65, needed / etaSingle);
        gridChargeKwh = chargeInput;
        optStored += gridChargeKwh * etaSingle;
        optGrid = remainingDemand + gridChargeKwh;
        batteryFlowKw = gridChargeKwh;
        optAction = 'GRID_CHARGE';
      }
    }
    // Step C: Smart discharge — prioritize Peak tariff periods & high-load threshold shaving
    else if (remainingDemand > 0.1 && optStored > minStored + 0.01) {
      const availableDischargeEnergy = (optStored - minStored) * etaSingle;
      const isPeakWindow = tier === 'Peak';
      // During Standard hours, preserve enough energy for upcoming Peak hours unless battery is nearly full
      const reserveForPeak = Math.min(
        maxStored - minStored,
        futurePeakDeficitFromHour[h] / etaSingle
      );
      const excessAbovePeakReserve = Math.max(0, (optStored - minStored - reserveForPeak) * etaSingle);

      const allowedDischarge = isPeakWindow
        ? Math.min(remainingDemand, maxDischargeKw, availableDischargeEnergy)
        : Math.min(remainingDemand, maxDischargeKw, excessAbovePeakReserve);

      if (allowedDischarge > 0.25) {
        batteryToLoad = allowedDischarge;
        optStored -= batteryToLoad / etaSingle;
        optGrid = Math.max(0, remainingDemand - batteryToLoad);
        batteryFlowKw = -batteryToLoad;
        optAction = 'DISCHARGE';
      }
    }

    const optCost = optGrid * tariff;
    const optSocPct = (optStored / capacityKwh) * 100;
    totalOptGrid += optGrid;
    totalOptCost += optCost;
    if (optGrid > peakOptGridKw) peakOptGridKw = optGrid;

    schedule.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      demand_kwh: Number(demand.toFixed(2)),
      solar_kwh: Number(solar.toFixed(2)),
      tariff_inr: Number(tariff.toFixed(2)),
      tariff_tier: tier,
      baseline_action: baseAction,
      baseline_soc_pct: Number(baseSocPct.toFixed(1)),
      baseline_grid_kwh: Number(baseGrid.toFixed(2)),
      baseline_cost_inr: Number(baseCost.toFixed(2)),
      optimized_action: optAction,
      battery_flow_kw: Number(batteryFlowKw.toFixed(2)),
      solar_direct_kwh: Number(solarDirect.toFixed(2)),
      solar_to_battery_kwh: Number(solarToBattery.toFixed(2)),
      battery_to_load_kwh: Number(batteryToLoad.toFixed(2)),
      optimized_soc_pct: Number(optSocPct.toFixed(1)),
      optimized_grid_kwh: Number(optGrid.toFixed(2)),
      optimized_cost_inr: Number(optCost.toFixed(2)),
    });
  }

  const costSavingsInr = Math.max(0, totalBaseCost - totalOptCost);
  const costSavingsPct = totalBaseCost > 0 ? (costSavingsInr / totalBaseCost) * 100 : 0;
  const gridReductionPct =
    totalDemand > 0 ? ((totalDemand - totalOptGrid) / totalDemand) * 100 : 0;

  return {
    params: {
      capacity_kwh: capacityKwh,
      initial_soc_pct: initialSocPct,
      min_soc_pct: minSocPct,
      max_soc_pct: maxSocPct,
      max_charge_kw: maxChargeKw,
      max_discharge_kw: maxDischargeKw,
      efficiency_pct: efficiencyPct,
    },
    summary: {
      total_demand_kwh: Number(totalDemand.toFixed(2)),
      total_solar_kwh: Number(totalSolar.toFixed(2)),
      baseline_grid_kwh: Number(totalBaseGrid.toFixed(2)),
      optimized_grid_kwh: Number(totalOptGrid.toFixed(2)),
      baseline_cost_inr: Number(totalBaseCost.toFixed(2)),
      optimized_cost_inr: Number(totalOptCost.toFixed(2)),
      estimated_cost_savings_inr: Number(costSavingsInr.toFixed(2)),
      estimated_cost_savings_pct: Number(costSavingsPct.toFixed(1)),
      peak_grid_reduction_kw: Number(Math.max(0, peakBaseGridKw - peakOptGridKw).toFixed(2)),
      grid_dependency_reduction_pct: Number(Math.max(0, gridReductionPct).toFixed(1)),
    },
    schedule,
    data_source: input.data_source ?? 'SIMULATED DATA',
  };
}
