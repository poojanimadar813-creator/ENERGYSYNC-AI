import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { StateDashboardSummary } from '../types/energy.ts';

interface StateDashboardSectionProps {
  onNavigate: (tab: string) => void;
}

export const StateDashboardSection: React.FC<StateDashboardSectionProps> = ({ onNavigate }) => {
  const [data, setData] = useState<StateDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadState = () => {
    setError(null);
    apiFetch<StateDashboardSummary>('/api/state/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load state dashboard.'));
  };

  useEffect(() => {
    loadState();
  }, []);

  const districtChart = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!data) return null;
    return {
      type: 'bar',
      data: {
        labels: data.district_breakdown.map((d) => d.name),
        datasets: [
          {
            label: 'Daily Demand (kWh)',
            data: data.district_breakdown.map((d) => d.daily_demand_kwh),
            backgroundColor: 'rgba(139, 92, 246, 0.78)',
            borderRadius: 4,
          },
          {
            label: 'Solar Generation (kWh)',
            data: data.district_breakdown.map((d) => d.solar_generation_kwh),
            backgroundColor: 'rgba(16, 185, 129, 0.78)',
            borderRadius: 4,
          },
          {
            label: 'Grid Import (kWh)',
            data: data.district_breakdown.map((d) => d.grid_import_kwh),
            backgroundColor: 'rgba(245, 158, 11, 0.55)',
            borderRadius: 4,
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
            ticks: { color: '#94A3B8', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [data]);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Loading Karnataka State Dashboard...
      </div>
    );
  }

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Karnataka State Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {data.network_name} · Aggregated campus telemetry across {kpis.covered_districts} districts ·{' '}
            <span className="font-mono text-slate-300">SIMULATED DATA</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('college_registry')}
            className="rounded-lg border border-slate-700 hover:border-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 cursor-pointer"
          >
            View College Registry
          </button>
          <button
            onClick={() => onNavigate('add_college')}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
          >
            Add College
          </button>
        </div>
      </div>

      {/* Statewide KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Connected Colleges</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {kpis.active_colleges} / {kpis.total_colleges}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {kpis.covered_districts} Karnataka districts
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">State Daily Demand</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {kpis.total_daily_demand_kwh.toLocaleString()} kWh
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Aggregate campus load</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Statewide Solar Gen</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {kpis.total_solar_generation_kwh.toLocaleString()} kWh
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {kpis.total_solar_capacity_kwp} kWp installed
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Statewide BESS Capacity</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            {kpis.total_battery_capacity_kwh.toLocaleString()} kWh
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Avg SOC {kpis.avg_battery_soc_pct}%
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Estimated Daily Savings</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            ₹{kpis.total_estimated_savings_inr.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Calculated statewide</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Active Network Alerts</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-amber-300">
            {kpis.total_active_alerts}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Isolation Forest flags</div>
        </div>
      </div>

      {/* District Chart */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              District-Wise Daily Load, Solar Generation &amp; Grid Import
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live rollup from SQLite colleges and districts tables across Karnataka.
            </p>
          </div>
          <button
            onClick={() => onNavigate('district_analytics')}
            className="text-xs font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap cursor-pointer"
          >
            District Analytics →
          </button>
        </div>
        {districtChart && <ChartCanvas config={districtChart} height={300} />}
      </div>

      {/* Top Performing Campuses Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 overflow-x-auto">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-base font-semibold text-white">
            Active Network Campuses Snapshot
          </h3>
          <button
            onClick={() => onNavigate('statewide_reports')}
            className="text-xs font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap cursor-pointer"
          >
            Statewide Reports →
          </button>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 px-3 font-medium">Campus</th>
              <th className="py-2.5 px-3 font-medium">District</th>
              <th className="py-2.5 px-3 font-medium text-right">Demand (kWh)</th>
              <th className="py-2.5 px-3 font-medium text-right">Solar (kWh)</th>
              <th className="py-2.5 px-3 font-medium text-right">SOC</th>
              <th className="py-2.5 px-3 font-medium text-right">Est. Savings</th>
              <th className="py-2.5 px-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
            {data.top_colleges.map((c) => (
              <tr key={c.id} className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-sans font-medium text-white">{c.name}</td>
                <td className="py-2.5 px-3 font-sans text-slate-300">{c.district_name}</td>
                <td className="py-2.5 px-3 text-right text-white">{c.daily_demand_kwh}</td>
                <td className="py-2.5 px-3 text-right text-emerald-400">
                  {c.solar_generation_kwh}
                </td>
                <td className="py-2.5 px-3 text-right text-violet-300">{c.battery_soc_pct}%</td>
                <td className="py-2.5 px-3 text-right text-emerald-400">
                  ₹{c.estimated_savings_inr.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right font-sans text-slate-300">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
