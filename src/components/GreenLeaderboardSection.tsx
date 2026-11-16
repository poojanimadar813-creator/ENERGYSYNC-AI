import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { Award, Info } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { GreenLeaderboardEntry } from '../types/energy.ts';

export const GreenLeaderboardSection: React.FC = () => {
  const [methodology, setMethodology] = useState('');
  const [entries, setEntries] = useState<GreenLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ methodology: string; leaderboard: GreenLeaderboardEntry[] }>(
      '/api/advanced/leaderboard'
    )
      .then((res) => {
        setMethodology(res.methodology);
        setEntries(res.leaderboard);
      })
      .finally(() => setLoading(false));
  }, []);

  const chartConfig = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (entries.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: entries.map((e) => e.code),
        datasets: [
          {
            label: 'Composite Green Score (/100)',
            data: entries.map((e) => e.composite_green_score),
            backgroundColor: '#10B981',
            borderRadius: 5,
          },
          {
            label: 'Renewable Share (%)',
            data: entries.map((e) => e.renewable_pct),
            backgroundColor: '#7C3AED',
            borderRadius: 5,
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
            ticks: { color: '#CBD5E1', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            max: 100,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [entries]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Computing normalized Karnataka Green Campus Leaderboard...
      </div>
    );
  }

  const topCampus = entries[0];
  const avgIntensity =
    entries.length > 0
      ? (entries.reduce((s, e) => s + e.kwh_per_student, 0) / entries.length).toFixed(3)
      : '0';
  const avgRe =
    entries.length > 0
      ? (entries.reduce((s, e) => s + e.renewable_pct, 0) / entries.length).toFixed(1)
      : '0';
  const totalCo2 = entries.reduce((s, e) => s + e.co2_avoided_kg_per_day, 0).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          Karnataka Green Campus Leaderboard
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Fair campus sustainability benchmarking across Karnataka engineering institutions using normalized intensity &amp; storage metrics.
        </p>
      </div>

      {/* Fairness & Normalization Methodology Notice */}
      <div className="rounded-xl border border-violet-500/35 bg-violet-950/20 px-4 py-3 text-xs text-slate-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Normalized Scoring Methodology (Not Raw kWh): </span>
          <span>{methodology}</span>
        </div>
      </div>

      {topCampus && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-emerald-500/35 bg-[#0D1526] p-4">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Award className="w-4 h-4" />
              <span>#1 Green Campus Leader</span>
            </div>
            <div className="mt-1.5 font-display text-base font-semibold text-white truncate">
              {topCampus.name}
            </div>
            <div className="mt-1 font-mono text-xs text-emerald-400">
              Score {topCampus.composite_green_score}/100 · {topCampus.kwh_per_student} kWh/student
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
            <div className="text-xs text-slate-400">Network Avg Intensity</div>
            <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
              {avgIntensity} kWh/std
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Normalized per enrolled student</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
            <div className="text-xs text-slate-400">Network Avg RE Share</div>
            <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
              {avgRe}%
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Solar offset of campus demand</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
            <div className="text-xs text-slate-400">Combined CO₂ Avoided</div>
            <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
              {totalCo2} kg/day
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Across {entries.length} campuses</div>
          </div>
        </div>
      )}

      {chartConfig && (
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Campus Sustainability Score vs Renewable Utilization
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Normalized comparison eliminating campus-size bias.
          </p>
          <ChartCanvas config={chartConfig} height={270} />
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 overflow-x-auto">
        <h3 className="font-display text-base font-semibold text-white mb-3">
          Statewide Normalized Ranking Table
        </h3>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 px-3 font-medium">Rank</th>
              <th className="py-2.5 px-3 font-medium">Campus</th>
              <th className="py-2.5 px-3 font-medium">District</th>
              <th className="py-2.5 px-3 font-medium text-right">kWh / Student</th>
              <th className="py-2.5 px-3 font-medium text-right">RE %</th>
              <th className="py-2.5 px-3 font-medium text-right">Wastage Red.</th>
              <th className="py-2.5 px-3 font-medium text-right">BESS Eff.</th>
              <th className="py-2.5 px-3 font-medium text-right">CO₂ Avoided</th>
              <th className="py-2.5 px-3 font-medium text-right">Delta %</th>
              <th className="py-2.5 px-3 font-medium text-right">Green Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
            {entries.map((row) => (
              <tr key={row.college_id} className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-semibold text-emerald-400">#{row.rank}</td>
                <td className="py-2.5 px-3 font-sans">
                  <div className="font-medium text-white">{row.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {row.code} · {row.student_count.toLocaleString()} students
                  </div>
                </td>
                <td className="py-2.5 px-3 font-sans text-slate-300">{row.district_name}</td>
                <td className="py-2.5 px-3 text-right text-white">{row.kwh_per_student}</td>
                <td className="py-2.5 px-3 text-right text-violet-300">{row.renewable_pct}%</td>
                <td className="py-2.5 px-3 text-right text-emerald-400">
                  {row.wastage_reduction_pct}%
                </td>
                <td className="py-2.5 px-3 text-right text-slate-300">
                  {row.battery_efficiency_pct}%
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400">
                  {row.co2_avoided_kg_per_day} kg/d
                </td>
                <td className="py-2.5 px-3 text-right text-sky-300">
                  +{row.improvement_delta_pct}%
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-white">
                  {row.composite_green_score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
