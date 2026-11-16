import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { Calculator, Leaf, Trees } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { CarbonSummary } from '../types/energy.ts';

export const CarbonFormulasSection: React.FC = () => {
  const [carbon, setCarbon] = useState<CarbonSummary | null>(null);

  // Interactive Transparent Engineering Calculator inputs
  const [powerKw, setPowerKw] = useState(42.5);
  const [durationHours, setDurationHours] = useState(4);
  const [solarUsedKwh, setSolarUsedKwh] = useState(95);
  const [gridUsedKwh, setGridUsedKwh] = useState(75);
  const [tariffInr, setTariffInr] = useState(7.4);
  const [batteryStoredKwh, setBatteryStoredKwh] = useState(118);
  const [batteryCapacityKwh, setBatteryCapacityKwh] = useState(200);
  const [minReservePct, setMinReservePct] = useState(15);
  const [efficiencyPct, setEfficiencyPct] = useState(94);

  useEffect(() => {
    apiFetch<CarbonSummary>('/api/advanced/carbon').then(setCarbon);
  }, []);

  const calc = useMemo(() => {
    const emissionFactor = carbon?.grid_emission_factor_kg_per_kwh ?? 0.82;
    const energyKwh = Number((powerKw * durationHours).toFixed(2));
    const totalConsumed = Math.max(0.01, solarUsedKwh + gridUsedKwh);
    const rePct = Number(((solarUsedKwh / totalConsumed) * 100).toFixed(1));
    const costInr = Number((gridUsedKwh * tariffInr).toFixed(2));
    const usableCap = Math.max(1, batteryCapacityKwh * (1 - minReservePct / 100));
    const rawSoc = (batteryStoredKwh / usableCap) * 100;
    const effectiveSoc = Number(
      Math.min(100, Math.max(0, rawSoc * (efficiencyPct / 100))).toFixed(1)
    );
    const co2AvoidedKg = Number((solarUsedKwh * emissionFactor).toFixed(2));
    return { energyKwh, rePct, costInr, usableCap: Number(usableCap.toFixed(1)), effectiveSoc, co2AvoidedKg };
  }, [
    carbon,
    powerKw,
    durationHours,
    solarUsedKwh,
    gridUsedKwh,
    tariffInr,
    batteryStoredKwh,
    batteryCapacityKwh,
    minReservePct,
    efficiencyPct,
  ]);

  const chartConfig = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!carbon) return null;
    return {
      type: 'bar',
      data: {
        labels: ['Grid-Only Baseline CO₂', 'Actual Campus Grid CO₂', 'Daily CO₂ Avoided'],
        datasets: [
          {
            label: 'Emissions (kg CO₂ / day)',
            data: [
              carbon.campus.baseline_emissions_kg,
              carbon.campus.actual_emissions_kg,
              carbon.campus.co2_avoided_kg,
            ],
            backgroundColor: ['#64748B', '#F59E0B', '#10B981'],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#CBD5E1', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [carbon]);

  if (!carbon) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Computing carbon footprint and energy equations...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          Carbon Footprint Calculator &amp; Transparent Energy Calculations
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Quantified CO₂ emissions avoided (CEA India Grid Factor {carbon.grid_emission_factor_kg_per_kwh} kg CO₂/kWh) and transparent engineering equations.
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            <span>Campus CO₂ Avoided Today</span>
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {carbon.campus.co2_avoided_kg} kg CO₂
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            RE Share: {carbon.campus.renewable_pct}% ({carbon.campus.renewable_energy_used_kwh} kWh)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Trees className="w-3.5 h-3.5 text-emerald-400" />
            <span>Monthly Tree Equivalent</span>
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {carbon.campus.equivalent_trees_monthly} trees
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Actual grid CO₂: {carbon.campus.actual_emissions_kg} kg/day
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Karnataka Network Avoided</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {carbon.statewide.co2_avoided_kg} kg/day
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Network RE Share: {carbon.statewide.renewable_pct}%
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Annual Statewide Offset</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            {carbon.statewide.co2_avoided_tonnes_annual} tCO₂/yr
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Across {carbon.statewide.renewable_energy_kwh} kWh/day solar
          </div>
        </div>
      </div>

      {/* Chart + Explicit Engineering Formulas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Campus Grid Carbon Offset Comparison
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Baseline assumes 100% utility grid import; actual reflects solar direct use + BESS peak displacement.
          </p>
          {chartConfig && <ChartCanvas config={chartConfig} height={260} />}
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-3">
          <h3 className="font-display text-base font-semibold text-white">
            Verified Physics &amp; Storage Equations
          </h3>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
              <div className="text-slate-400 font-sans text-[11px]">Electrical Energy</div>
              <div className="text-violet-300 mt-0.5">{carbon.formulas.energy_kwh}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
              <div className="text-slate-400 font-sans text-[11px]">Renewable Utilization Share</div>
              <div className="text-emerald-400 mt-0.5">{carbon.formulas.renewable_pct}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
              <div className="text-slate-400 font-sans text-[11px]">Utility Grid Cost</div>
              <div className="text-amber-300 mt-0.5">{carbon.formulas.energy_cost}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
              <div className="text-slate-400 font-sans text-[11px]">Usable Battery State of Charge</div>
              <div className="text-sky-300 mt-0.5">{carbon.formulas.battery_soc_pct}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
              <div className="text-slate-400 font-sans text-[11px]">CO₂ Emissions Avoided</div>
              <div className="text-emerald-400 mt-0.5">{carbon.formulas.carbon_avoided_kg}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Calculator */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-violet-400" />
          <h3 className="font-display text-base font-semibold text-white">
            Interactive Campus Energy &amp; Storage Calculator
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-slate-400">Load Power P (kW)</span>
            <input
              type="number"
              step="0.5"
              value={powerKw}
              onChange={(e) => setPowerKw(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Duration t (hrs)</span>
            <input
              type="number"
              step="0.5"
              value={durationHours}
              onChange={(e) => setDurationHours(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Solar Used (kWh)</span>
            <input
              type="number"
              value={solarUsedKwh}
              onChange={(e) => setSolarUsedKwh(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Grid Used (kWh)</span>
            <input
              type="number"
              value={gridUsedKwh}
              onChange={(e) => setGridUsedKwh(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Tariff (₹/kWh)</span>
            <input
              type="number"
              step="0.2"
              value={tariffInr}
              onChange={(e) => setTariffInr(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Battery Stored (kWh)</span>
            <input
              type="number"
              value={batteryStoredKwh}
              onChange={(e) => setBatteryStoredKwh(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Battery Cap (kWh)</span>
            <input
              type="number"
              value={batteryCapacityKwh}
              onChange={(e) => setBatteryCapacityKwh(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Min Reserve (%)</span>
            <input
              type="number"
              min={0}
              max={50}
              value={minReservePct}
              onChange={(e) => setMinReservePct(Math.min(50, Math.max(0, Number(e.target.value))))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Efficiency η (%)</span>
            <input
              type="number"
              min={50}
              max={100}
              value={efficiencyPct}
              onChange={(e) => setEfficiencyPct(Math.min(100, Math.max(50, Number(e.target.value))))}
              className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 font-mono text-white"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono tabular-nums">
          <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
            <div className="text-[11px] font-sans text-slate-400">E = P × t</div>
            <div className="text-base font-semibold text-white mt-1">{calc.energyKwh} kWh</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
            <div className="text-[11px] font-sans text-slate-400">Renewable Share (RE%)</div>
            <div className="text-base font-semibold text-emerald-400 mt-1">{calc.rePct}%</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
            <div className="text-[11px] font-sans text-slate-400">Grid Energy Cost</div>
            <div className="text-base font-semibold text-amber-300 mt-1">₹{calc.costInr}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
            <div className="text-[11px] font-sans text-slate-400">Usable SOC% (η-adj)</div>
            <div className="text-base font-semibold text-violet-300 mt-1">
              {calc.effectiveSoc}% ({calc.usableCap} kWh)
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
            <div className="text-[11px] font-sans text-slate-400">CO₂ Avoided</div>
            <div className="text-base font-semibold text-emerald-400 mt-1">
              {calc.co2AvoidedKg} kg
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
