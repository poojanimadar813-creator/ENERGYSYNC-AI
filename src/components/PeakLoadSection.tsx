import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ArrowLeftRight } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { PeakLoadPlan } from '../types/energy.ts';

export const PeakLoadSection: React.FC = () => {
  const [plan, setPlan] = useState<PeakLoadPlan | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<PeakLoadPlan>('/api/advanced/peak-load').then(setPlan);
  }, []);

  const toggleShift = async (id: number, currentStatus: 'Deferred' | 'Scheduled Peak') => {
    setBusyId(id);
    try {
      const nextStatus = currentStatus === 'Deferred' ? 'Scheduled Peak' : 'Deferred';
      const res = await apiFetch<{ ok: boolean; plan: PeakLoadPlan }>('/api/advanced/peak-load/shift', {
        method: 'POST',
        body: JSON.stringify({ id, status: nextStatus }),
      });
      setPlan(res.plan);
    } finally {
      setBusyId(null);
    }
  };

  const chartConfig = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!plan) return null;
    return {
      type: 'line',
      data: {
        labels: plan.hourly_profile.map((p) => p.label),
        datasets: [
          {
            label: 'Unshifted Peak Load (kW)',
            data: plan.hourly_profile.map((p) => p.baseline_kw),
            borderColor: '#94A3B8',
            borderDash: [5, 4],
            tension: 0.3,
            fill: false,
            borderWidth: 1.8,
          },
          {
            label: 'Shifted Flexible Load Profile (kW)',
            data: plan.hourly_profile.map((p) => p.shifted_kw),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.14)',
            tension: 0.3,
            fill: true,
            borderWidth: 2.2,
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
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [plan]);

  if (!plan) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Analyzing campus peak demand intervals and deferrable loads...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          Smart Peak Load Management
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Identify peak electricity intervals and defer flexible equipment loads to off-peak or peak-solar periods.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Baseline Peak Demand</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-amber-300">
            {plan.peak_demand_kw} kW
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{plan.peak_window}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Post-Shift Peak Demand</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {plan.post_shift_peak_kw} kW
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {(plan.peak_demand_kw - plan.post_shift_peak_kw).toFixed(1)} kW shaved
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Flexible Load Pool</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            {plan.total_shiftable_kw} kW
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{plan.recommended_offpeak_window}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Calculated Shift Savings</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            ₹{plan.total_estimated_savings_inr}/day
          </div>
          <div className="mt-1 text-[11px] text-slate-400">From active deferred loads</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
        <h3 className="font-display text-base font-semibold text-white mb-1">
          24-Hour Peak Demand Shaving Curve
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Toggle flexible loads below to simulate shifting kW demand out of ₹9.60/kWh peak tariff periods.
        </p>
        {chartConfig && <ChartCanvas config={chartConfig} height={280} />}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 overflow-x-auto">
        <h3 className="font-display text-base font-semibold text-white mb-3">
          Deferrable Flexible Campus Loads
        </h3>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 px-3 font-medium">Load Process</th>
              <th className="py-2.5 px-3 font-medium">Building</th>
              <th className="py-2.5 px-3 font-medium text-right">Power (kW)</th>
              <th className="py-2.5 px-3 font-medium text-right">Energy (kWh)</th>
              <th className="py-2.5 px-3 font-medium">Shift Window</th>
              <th className="py-2.5 px-3 font-medium text-right">Est. Savings</th>
              <th className="py-2.5 px-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
            {plan.flexible_loads.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-sans font-medium text-white">{item.load_name}</td>
                <td className="py-2.5 px-3 font-sans text-slate-300">{item.source_building}</td>
                <td className="py-2.5 px-3 text-right text-white">{item.power_kw} kW</td>
                <td className="py-2.5 px-3 text-right text-slate-300">{item.energy_kwh} kWh</td>
                <td className="py-2.5 px-3 text-violet-300">
                  {String(item.from_hour).padStart(2, '0')}:00 →{' '}
                  {String(item.to_hour).padStart(2, '0')}:00
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400">
                  ₹{item.estimated_savings_inr}
                </td>
                <td className="py-2.5 px-3 text-right font-sans">
                  <button
                    disabled={busyId === item.id}
                    onClick={() => void toggleShift(item.id, item.status)}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                      item.status === 'Deferred'
                        ? 'bg-emerald-600/25 border border-emerald-500/40 text-emerald-300'
                        : 'bg-violet-600 hover:bg-violet-500 text-white'
                    }`}
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>{item.status === 'Deferred' ? 'Deferred (Restore)' : 'Shift Load'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
