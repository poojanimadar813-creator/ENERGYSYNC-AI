import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { Download } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch, downloadAuthorizedCsv } from '../lib/api.ts';

interface ReportsData {
  daily_report: Array<{
    date: string;
    consumption_kwh: number;
    peak_kw: number;
    est_solar_kwh: number;
  }>;
  building_comparison: Array<{
    code: string;
    name: string;
    category: string;
    baseline_daily_kwh: number;
    avg_daily_kwh: number;
    period_total_kwh: number;
    max_hourly_kw: number;
  }>;
  wastage_report: Array<{
    building_name: string;
    alert_count: number;
    wastage_kwh: number;
  }>;
  solar_contribution: {
    generated_kwh: number;
    direct_kwh: number;
    battery_charged_kwh: number;
    grid_import_kwh: number;
  };
  battery_performance: {
    baseline_cost_inr: number;
    optimized_cost_inr: number;
    estimated_cost_savings_inr: number;
    estimated_cost_savings_pct: number;
    peak_grid_reduction_kw: number;
  };
}

export const ReportsSection: React.FC = () => {
  const [data, setData] = useState<ReportsData | null>(null);
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    apiFetch<ReportsData>('/api/reports').then(setData);
  }, []);

  const trendChart = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!data) return null;
    const rows =
      cadence === 'daily'
        ? data.daily_report
        : cadence === 'weekly'
          ? [
              {
                date: 'Week 1 (Days 1–7)',
                consumption_kwh: Number(
                  data.daily_report
                    .slice(0, 7)
                    .reduce((a, b) => a + b.consumption_kwh, 0)
                    .toFixed(1)
                ),
              },
              {
                date: 'Week 2 (Days 8–15)',
                consumption_kwh: Number(
                  data.daily_report
                    .slice(7)
                    .reduce((a, b) => a + b.consumption_kwh, 0)
                    .toFixed(1)
                ),
              },
            ]
          : [
              {
                date: 'Current 30-Day Projected Cycle',
                consumption_kwh: Number(
                  (
                    data.daily_report.reduce((a, b) => a + b.consumption_kwh, 0) * 2.0
                  ).toFixed(1)
                ),
              },
            ];

    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.date),
        datasets: [
          {
            label: 'Total Consumption (kWh)',
            data: rows.map((r) => r.consumption_kwh),
            backgroundColor: 'rgba(139, 92, 246, 0.78)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#CBD5E1', font: { size: 11 } } },
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
  }, [data, cadence]);

  const downloadCsv = (type: 'consumption' | 'anomalies' | 'battery') => {
    void downloadAuthorizedCsv(type);
  };

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Aggregating campus energy, solar, battery, and wastage reports...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Energy Reports &amp; CSV Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Daily, weekly, and monthly consumption analytics, solar contribution, battery savings, and CSV exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadCsv('consumption')}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Consumption CSV</span>
          </button>
          <button
            onClick={() => downloadCsv('battery')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-slate-500 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Battery Schedule CSV</span>
          </button>
          <button
            onClick={() => downloadCsv('anomalies')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-slate-500 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Anomalies CSV</span>
          </button>
        </div>
      </div>

      {/* Solar & Battery Report Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Daily Solar Contribution</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-amber-300">
            {data.solar_contribution.generated_kwh} kWh
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Direct {data.solar_contribution.direct_kwh} · Stored {data.solar_contribution.battery_charged_kwh} kWh
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Calculated Battery Cost Savings</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            ₹{data.battery_performance.estimated_cost_savings_inr}/day
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {data.battery_performance.estimated_cost_savings_pct}% tariff savings vs baseline
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Peak Grid Shaving</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            {data.battery_performance.peak_grid_reduction_kw} kW
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Estimated utility demand reduction</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Detected Wastage Events</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-rose-400">
            {data.wastage_report.reduce((a, b) => a + b.alert_count, 0)} alerts
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {data.wastage_report.reduce((a, b) => a + b.wastage_kwh, 0).toFixed(1)} kWh excess flagged
          </div>
        </div>
      </div>

      {/* Period Consumption Chart */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Campus Consumption Trend Report
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Switch between daily, weekly, and monthly views based on stored SQLite telemetry.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#080D1A] border border-slate-800">
            {(['daily', 'weekly', 'monthly'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCadence(c)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                  cadence === c ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {trendChart && <ChartCanvas config={trendChart} height={270} />}
      </div>

      {/* Building Comparison & Wastage Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0D1526] p-5 overflow-x-auto">
          <h3 className="font-display text-base font-semibold text-white mb-3">
            Building-Wise Multi-Day Comparison
          </h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3 font-medium">Building</th>
                <th className="py-2.5 px-3 font-medium text-right">Avg Daily (kWh)</th>
                <th className="py-2.5 px-3 font-medium text-right">Baseline (kWh)</th>
                <th className="py-2.5 px-3 font-medium text-right">Max Peak (kW)</th>
                <th className="py-2.5 px-3 font-medium text-right">15-Day Total (kWh)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
              {data.building_comparison.map((b) => (
                <tr key={b.code}>
                  <td className="py-2.5 px-3 font-sans font-medium text-white">{b.name}</td>
                  <td className="py-2.5 px-3 text-right text-slate-200">{b.avg_daily_kwh}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{b.baseline_daily_kwh}</td>
                  <td className="py-2.5 px-3 text-right text-amber-300">{b.max_hourly_kw}</td>
                  <td className="py-2.5 px-3 text-right text-white">{b.period_total_kwh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0D1526] p-5 overflow-x-auto">
          <h3 className="font-display text-base font-semibold text-white mb-3">
            Energy Wastage Attribution Report
          </h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3 font-medium">Building</th>
                <th className="py-2.5 px-3 font-medium text-right">Alerts</th>
                <th className="py-2.5 px-3 font-medium text-right">Excess Wastage (kWh)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
              {data.wastage_report.map((w) => (
                <tr key={w.building_name}>
                  <td className="py-2.5 px-3 font-sans font-medium text-white">
                    {w.building_name}
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-300">{w.alert_count}</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">{w.wastage_kwh} kWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
