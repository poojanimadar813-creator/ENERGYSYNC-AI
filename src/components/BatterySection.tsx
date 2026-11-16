import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { SlidersHorizontal } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { BatteryOptimizationResult } from '../types/energy.ts';

interface BatteryResponse {
  hardware_notice: string;
  optimization: BatteryOptimizationResult;
}

export const BatterySection: React.FC = () => {
  const [opt, setOpt] = useState<BatteryOptimizationResult | null>(null);
  const [notice, setNotice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [runningOpt, setRunningOpt] = useState(false);

  // Tunable physical battery constraints
  const [capacityKwh, setCapacityKwh] = useState(200);
  const [initialSoc, setInitialSoc] = useState(52);
  const [minSoc, setMinSoc] = useState(15);
  const [maxSoc, setMaxSoc] = useState(95);
  const [maxChargeKw, setMaxChargeKw] = useState(45);
  const [efficiencyPct, setEfficiencyPct] = useState(94);

  useEffect(() => {
    apiFetch<BatteryResponse>('/api/battery')
      .then((res) => {
        setOpt(res.optimization);
        setNotice(res.hardware_notice);
        setCapacityKwh(res.optimization.params.capacity_kwh);
        setInitialSoc(res.optimization.params.initial_soc_pct);
        setMinSoc(res.optimization.params.min_soc_pct);
        setMaxSoc(res.optimization.params.max_soc_pct);
        setMaxChargeKw(res.optimization.params.max_charge_kw);
        setEfficiencyPct(res.optimization.params.efficiency_pct);
      })
      .finally(() => setLoading(false));
  }, []);

  const runCustomSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunningOpt(true);
    try {
      const updated = await apiFetch<BatteryOptimizationResult>('/api/battery/schedule', {
        method: 'POST',
        body: JSON.stringify({
          capacity_kwh: capacityKwh,
          initial_soc_pct: initialSoc,
          min_soc_pct: minSoc,
          max_soc_pct: maxSoc,
          max_charge_kw: maxChargeKw,
          max_discharge_kw: maxChargeKw,
          efficiency_pct: efficiencyPct,
        }),
      });
      setOpt(updated);
    } finally {
      setRunningOpt(false);
    }
  };

  const socChart = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!opt) return null;
    return {
      type: 'line',
      data: {
        labels: opt.schedule.map((s) => s.label),
        datasets: [
          {
            label: 'ENERGYSYNC AI Optimized SOC (%)',
            data: opt.schedule.map((s) => s.optimized_soc_pct),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.14)',
            fill: true,
            tension: 0.3,
            borderWidth: 2.2,
          },
          {
            label: 'Baseline Strategy SOC (%)',
            data: opt.schedule.map((s) => s.baseline_soc_pct),
            borderColor: '#94A3B8',
            borderDash: [5, 4],
            fill: false,
            tension: 0.3,
            borderWidth: 1.75,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#CBD5E1', boxWidth: 12, font: { size: 11 } } },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [opt]);

  const costChart = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!opt) return null;
    return {
      type: 'bar',
      data: {
        labels: opt.schedule.map((s) => s.label),
        datasets: [
          {
            label: 'Baseline Grid Cost (₹)',
            data: opt.schedule.map((s) => s.baseline_cost_inr),
            backgroundColor: 'rgba(148, 163, 184, 0.45)',
            borderRadius: 3,
          },
          {
            label: 'Optimized Grid Cost (₹)',
            data: opt.schedule.map((s) => s.optimized_cost_inr),
            backgroundColor: 'rgba(139, 92, 246, 0.78)',
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#CBD5E1', boxWidth: 12, font: { size: 11 } } },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [opt]);

  if (loading || !opt) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Computing 24-hour battery storage optimization schedule...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Intelligent Battery Storage Optimization
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Constrained multi-period dispatch solver · Respects capacity, rate limits, efficiency, and SOC bounds ·{' '}
            <span className="font-mono text-slate-300">{opt.data_source}</span>
          </p>
        </div>
      </div>

      {/* Hardware isolation notice */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] px-4 py-3 text-xs text-slate-300">
        <span className="font-semibold text-amber-300">Simulation Notice: </span>
        {notice}
      </div>

      {/* Baseline vs Optimized KPI Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Baseline Grid Cost</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-slate-200">
            ₹{opt.summary.baseline_cost_inr.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {opt.summary.baseline_grid_kwh} kWh imported
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Optimized Grid Cost</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            ₹{opt.summary.optimized_cost_inr.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {opt.summary.optimized_grid_kwh} kWh imported
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Estimated Cost Savings</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            ₹{opt.summary.estimated_cost_savings_inr.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400">
            {opt.summary.estimated_cost_savings_pct}% tariff reduction vs baseline
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Peak Grid Shaving</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {opt.summary.peak_grid_reduction_kw} kW
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Peak demand reduction</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Grid Offset Share</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {opt.summary.grid_dependency_reduction_pct}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Covered by solar + BESS</div>
        </div>
      </div>

      {/* Physical Constraint Configuration Form */}
      <form
        onSubmit={runCustomSchedule}
        className="rounded-xl border border-slate-800 bg-[#0D1526] p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="w-4 h-4 text-violet-400" />
          <h3 className="font-display text-base font-semibold text-white">
            Battery Physical Constraints &amp; Solver Parameters
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Capacity (kWh)</label>
            <input
              type="number"
              min="40"
              max="1000"
              value={capacityKwh}
              onChange={(e) => setCapacityKwh(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Initial SOC (%)</label>
            <input
              type="number"
              min="15"
              max="95"
              value={initialSoc}
              onChange={(e) => setInitialSoc(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Min SOC (%)</label>
            <input
              type="number"
              min="5"
              max="40"
              value={minSoc}
              onChange={(e) => setMinSoc(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Max SOC (%)</label>
            <input
              type="number"
              min="60"
              max="100"
              value={maxSoc}
              onChange={(e) => setMaxSoc(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Max Rate (kW)</label>
            <input
              type="number"
              min="5"
              max="200"
              value={maxChargeKw}
              onChange={(e) => setMaxChargeKw(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Efficiency (%)</label>
            <input
              type="number"
              min="75"
              max="99"
              value={efficiencyPct}
              onChange={(e) => setEfficiencyPct(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={runningOpt}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            {runningOpt ? 'Optimizing...' : 'Optimize Schedule'}
          </button>
        </div>
      </form>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Battery State of Charge (SOC): Baseline vs. Optimized
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Optimized schedule preserves solar buffer for high-tariff peak periods instead of draining early.
          </p>
          {socChart && <ChartCanvas config={socChart} height={280} />}
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Hourly Grid Electricity Cost Comparison (₹)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Shaves expensive ₹9.60/kWh peak-hour utility charges using stored solar energy.
          </p>
          {costChart && <ChartCanvas config={costChart} height={280} />}
        </div>
      </div>

      {/* 24-Hour Dispatch Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
        <h3 className="font-display text-base font-semibold text-white mb-3">
          24-Hour Recommended Battery Dispatch Schedule
        </h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3 font-medium">Hour</th>
                <th className="py-2.5 px-3 font-medium">Tariff Tier</th>
                <th className="py-2.5 px-3 font-medium text-right">Demand (kWh)</th>
                <th className="py-2.5 px-3 font-medium text-right">Solar (kWh)</th>
                <th className="py-2.5 px-3 font-medium">Optimized Action</th>
                <th className="py-2.5 px-3 font-medium text-right">Battery Flow</th>
                <th className="py-2.5 px-3 font-medium text-right">Opt. SOC</th>
                <th className="py-2.5 px-3 font-medium text-right">Opt. Grid (kWh)</th>
                <th className="py-2.5 px-3 font-medium text-right">Baseline vs Opt (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
              {opt.schedule.map((row) => (
                <tr key={row.hour} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-slate-300">{row.label}</td>
                  <td
                    className={`py-2 px-3 ${
                      row.tariff_tier === 'Peak'
                        ? 'text-rose-400'
                        : row.tariff_tier === 'Off-Peak'
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                    }`}
                  >
                    {row.tariff_tier} (₹{row.tariff_inr})
                  </td>
                  <td className="py-2 px-3 text-right text-white">{row.demand_kwh}</td>
                  <td className="py-2 px-3 text-right text-amber-300">{row.solar_kwh}</td>
                  <td
                    className={`py-2 px-3 font-semibold ${
                      row.optimized_action === 'SOLAR_STORE'
                        ? 'text-emerald-400'
                        : row.optimized_action === 'DISCHARGE'
                          ? 'text-violet-300'
                          : row.optimized_action === 'GRID_CHARGE'
                            ? 'text-sky-300'
                            : 'text-slate-500'
                    }`}
                  >
                    {row.optimized_action}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-200">
                    {row.battery_flow_kw > 0
                      ? `+${row.battery_flow_kw} kW`
                      : row.battery_flow_kw < 0
                        ? `${row.battery_flow_kw} kW`
                        : '0.0 kW'}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-300">{row.optimized_soc_pct}%</td>
                  <td className="py-2 px-3 text-right text-slate-200">{row.optimized_grid_kwh}</td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-slate-400">₹{row.baseline_cost_inr}</span>
                    <span className="text-slate-600"> → </span>
                    <span className="text-emerald-400">₹{row.optimized_cost_inr}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
