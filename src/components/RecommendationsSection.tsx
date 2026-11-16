import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { OptimizationRecommendation } from '../types/energy.ts';

interface OptimizationResponse {
  recommendations: OptimizationRecommendation[];
}

interface RecommendationsSectionProps {
  onDataChanged: () => void;
}

export const RecommendationsSection: React.FC<RecommendationsSectionProps> = ({
  onDataChanged,
}) => {
  const [recs, setRecs] = useState<OptimizationRecommendation[]>([]);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const loadRecs = async () => {
    const res = await apiFetch<OptimizationResponse>('/api/optimization');
    setRecs(res.recommendations);
  };

  useEffect(() => {
    void loadRecs();
  }, []);

  const handleAction = async (id: number, action: 'Approve' | 'Reject' | 'Reset') => {
    setBusyId(id);
    try {
      await apiFetch('/api/optimization/recommend', {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      });
      await loadRecs();
      onDataChanged();
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await apiFetch('/api/optimization/recommend', {
        method: 'POST',
        body: JSON.stringify({ action: 'Generate' }),
      });
      await loadRecs();
      onDataChanged();
    } finally {
      setRegenerating(false);
    }
  };

  const approvedKwh = recs
    .filter((r) => r.status === 'Approved')
    .reduce((acc, r) => acc + r.estimated_savings_kwh, 0);
  const approvedInr = recs
    .filter((r) => r.status === 'Approved')
    .reduce((acc, r) => acc + r.estimated_savings_inr, 0);

  const visible = recs.filter((r) => (filter === 'All' ? true : r.status === filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            AI Energy Recommendation Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Actionable strategies generated from Random Forest forecasts, Isolation Forest alerts, and battery tariff optimization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D1526] border border-slate-800">
            {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  filter === tab ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            <span>Refresh Recommendations</span>
          </button>
        </div>
      </div>

      {/* Approved Impact Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Approved Strategies</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {recs.filter((r) => r.status === 'Approved').length} / {recs.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Estimated Approved Daily Energy Savings</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {approvedKwh.toFixed(1)} kWh/day
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Estimated Approved Cost Reduction</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            ₹{approvedInr.toLocaleString()}/day
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-3.5">
        {visible.map((rec) => (
          <div
            key={rec.id}
            className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-violet-300">{rec.category}</span>
                <span aria-hidden="true">·</span>
                <span>Priority {rec.priority}</span>
                {rec.building_name && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{rec.building_name}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span
                  className={`font-medium ${
                    rec.status === 'Approved'
                      ? 'text-emerald-400'
                      : rec.status === 'Rejected'
                        ? 'text-rose-400'
                        : 'text-amber-300'
                  }`}
                >
                  {rec.status}
                </span>
              </div>
              <h3 className="font-display text-base font-semibold text-white">{rec.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{rec.rationale}</p>
            </div>

            <div className="flex flex-wrap lg:flex-col items-end justify-between gap-3 shrink-0 lg:pl-5 lg:border-l border-slate-800/80">
              <div className="text-right font-mono tabular-nums">
                <div className="text-sm font-semibold text-emerald-400">
                  Est. -₹{rec.estimated_savings_inr}/day
                </div>
                <div className="text-xs text-slate-400">{rec.estimated_savings_kwh} kWh/day</div>
              </div>

              <div className="flex items-center gap-2">
                {rec.status !== 'Approved' && (
                  <button
                    disabled={busyId === rec.id}
                    onClick={() => handleAction(rec.id, 'Approve')}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                )}
                {rec.status !== 'Rejected' && (
                  <button
                    disabled={busyId === rec.id}
                    onClick={() => handleAction(rec.id, 'Reject')}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 hover:border-rose-500/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}
                {rec.status !== 'Pending' && (
                  <button
                    disabled={busyId === rec.id}
                    onClick={() => handleAction(rec.id, 'Reset')}
                    className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
