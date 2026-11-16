import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { DistrictAnalyticsRow } from '../types/energy.ts';

export const DistrictAnalyticsSection: React.FC = () => {
  const [rows, setRows] = useState<DistrictAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ districts: DistrictAnalyticsRow[] }>('/api/state/analytics')
      .then((res) => setRows(res.districts))
      .finally(() => setLoading(false));
  }, []);

  const solarShareChart = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (rows.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.district_name),
        datasets: [
          {
            label: 'Solar Offset Share (%)',
            data: rows.map((r) => r.solar_share_pct),
            backgroundColor: 'rgba(16, 185, 129, 0.78)',
            borderRadius: 4,
          },
          {
            label: 'State Target Savings (%)',
            data: rows.map((r) => r.target_savings_pct),
            backgroundColor: 'rgba(139, 92, 246, 0.55)',
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
  }, [rows]);

  const savingsChart = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (rows.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.district_name),
        datasets: [
          {
            label: 'Estimated Daily Savings (₹)',
            data: rows.map((r) => r.estimated_savings_inr),
            backgroundColor: 'rgba(56, 189, 248, 0.72)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#CBD5E1', font: { size: 11 } } },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#CBD5E1', font: { size: 11 } },
          },
        },
      },
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Computing district-wise analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">District-wise Analytics</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Compare renewable solar share, grid import dependency, battery readiness, and calculated savings across Karnataka districts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Solar Share vs. District Savings Target (%)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Percentage of daily institutional demand offset by rooftop solar PV generation.
          </p>
          {solarShareChart && <ChartCanvas config={solarShareChart} height={280} />}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Daily Calculated Cost Savings by District (₹)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Combined solar self-consumption and battery peak-shaving savings estimate.
          </p>
          {savingsChart && <ChartCanvas config={savingsChart} height={280} />}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 overflow-x-auto">
        <h3 className="font-display text-base font-semibold text-white mb-3">
          District Energy &amp; Renewable Efficiency Matrix
        </h3>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 px-3 font-medium">District</th>
              <th className="py-2.5 px-3 font-medium">Zone</th>
              <th className="py-2.5 px-3 font-medium text-right">Campuses</th>
              <th className="py-2.5 px-3 font-medium text-right">Demand (kWh)</th>
              <th className="py-2.5 px-3 font-medium text-right">Solar (kWh)</th>
              <th className="py-2.5 px-3 font-medium text-right">Grid (kWh)</th>
              <th className="py-2.5 px-3 font-medium text-right">Solar Share</th>
              <th className="py-2.5 px-3 font-medium text-right">Avg SOC</th>
              <th className="py-2.5 px-3 font-medium text-right">Est. Savings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
            {rows.map((r) => (
              <tr key={r.district_id} className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-sans font-medium text-white">{r.district_name}</td>
                <td className="py-2.5 px-3 font-sans text-slate-300">{r.zone}</td>
                <td className="py-2.5 px-3 text-right text-slate-200">{r.college_count}</td>
                <td className="py-2.5 px-3 text-right text-white">{r.daily_demand_kwh}</td>
                <td className="py-2.5 px-3 text-right text-emerald-400">
                  {r.solar_generation_kwh}
                </td>
                <td className="py-2.5 px-3 text-right text-amber-300">{r.grid_import_kwh}</td>
                <td className="py-2.5 px-3 text-right text-emerald-400">{r.solar_share_pct}%</td>
                <td className="py-2.5 px-3 text-right text-violet-300">
                  {r.avg_battery_soc_pct}%
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400">
                  ₹{r.estimated_savings_inr.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
