import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { apiFetch, downloadAuthorizedFile } from '../lib/api.ts';
import type { StatewideReportsSummary } from '../types/energy.ts';

export const StatewideReportsSection: React.FC = () => {
  const [data, setData] = useState<StatewideReportsSummary | null>(null);
  const [view, setView] = useState<'districts' | 'colleges'>('districts');

  useEffect(() => {
    apiFetch<StatewideReportsSummary>('/api/state/reports').then(setData);
  }, []);

  const exportCsv = (scope: 'districts' | 'colleges') => {
    const today = new Date().toISOString().slice(0, 10);
    void downloadAuthorizedFile(
      `/api/state/reports/export?scope=${scope}`,
      `karnataka_statewide_${scope}_${today}.csv`
    );
  };

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Generating Karnataka Statewide Reports...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Statewide Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Consolidated Karnataka institutional energy consumption, solar contribution, and CSV audit exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportCsv('districts')}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export District CSV</span>
          </button>
          <button
            onClick={() => exportCsv('colleges')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-slate-500 px-3.5 py-2 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Colleges CSV</span>
          </button>
        </div>
      </div>

      {/* Totals Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Network Coverage</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {data.totals.colleges} Campuses
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {data.totals.districts} active districts
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Daily Demand Sum</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {data.totals.daily_demand_kwh.toLocaleString()} kWh
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Daily Solar Contribution</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {data.totals.solar_generation_kwh.toLocaleString()} kWh
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Est. Daily Savings</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            ₹{data.totals.estimated_daily_savings_inr.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Projected 30-Day Savings</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            ₹{data.totals.estimated_monthly_savings_inr.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Report Table Switcher */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-white">
            {view === 'districts'
              ? 'District-Level Statewide Audit Summary'
              : 'Institution-Level Compliance & Energy Report'}
          </h3>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#080D1A] border border-slate-800">
            <button
              onClick={() => setView('districts')}
              className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
                view === 'districts' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              By District
            </button>
            <button
              onClick={() => setView('colleges')}
              className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
                view === 'colleges' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              By College
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {view === 'districts' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-medium">Code</th>
                  <th className="py-2.5 px-3 font-medium">District</th>
                  <th className="py-2.5 px-3 font-medium text-right">Colleges</th>
                  <th className="py-2.5 px-3 font-medium text-right">Solar (kWp)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Demand (kWh)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Solar Gen (kWh)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Grid (kWh)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Est. Savings (₹/day)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {data.district_summary.map((d) => (
                  <tr key={d.district_id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-violet-300">{d.district_code}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-white">
                      {d.district_name}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">{d.college_count}</td>
                    <td className="py-2.5 px-3 text-right text-amber-300">
                      {d.solar_capacity_kwp}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white">{d.daily_demand_kwh}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">
                      {d.solar_generation_kwh}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">{d.grid_import_kwh}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">
                      ₹{d.estimated_savings_inr.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-medium">Code</th>
                  <th className="py-2.5 px-3 font-medium">College</th>
                  <th className="py-2.5 px-3 font-medium">District</th>
                  <th className="py-2.5 px-3 font-medium text-right">Demand (kWh)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Solar (kWh)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Alerts</th>
                  <th className="py-2.5 px-3 font-medium text-right">Est. Savings (₹/day)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {data.college_summary.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-violet-300">{c.code}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-white">{c.name}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">{c.district_name}</td>
                    <td className="py-2.5 px-3 text-right text-white">{c.daily_demand_kwh}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">
                      {c.solar_generation_kwh}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-300">{c.active_alerts}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">
                      ₹{c.estimated_savings_inr.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
