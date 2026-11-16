import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { MaintenanceDiagnostic } from '../types/energy.ts';

export const PredictiveMaintenanceSection: React.FC = () => {
  const [items, setItems] = useState<MaintenanceDiagnostic[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ diagnostics: MaintenanceDiagnostic[] }>('/api/advanced/maintenance').then((res) =>
      setItems(res.diagnostics)
    );
  }, []);

  const updateStatus = async (id: number, status: 'Open' | 'Scheduled' | 'Resolved') => {
    setBusyId(id);
    try {
      const res = await apiFetch<{ diagnostics: MaintenanceDiagnostic[] }>(
        `/api/advanced/maintenance/${id}`,
        {
          method: 'POST',
          body: JSON.stringify({ status }),
        }
      );
      setItems(res.diagnostics);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">Predictive Maintenance</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Detects solar inverter PR drops, BESS cell balancing drift, and HVAC compressor anomalies before equipment failure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs text-violet-300">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{item.asset_code}</span>
                    <span className="text-slate-500">·</span>
                    <span>{item.asset_type}</span>
                  </div>
                  <h3 className="font-display text-base font-semibold text-white mt-1">
                    {item.asset_name}
                  </h3>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div
                    className={`text-lg font-semibold ${
                      item.health_score_pct >= 90
                        ? 'text-emerald-400'
                        : item.health_score_pct >= 75
                          ? 'text-amber-300'
                          : 'text-rose-400'
                    }`}
                  >
                    {item.health_score_pct}% Health
                  </div>
                  <div className="text-[11px] text-slate-400">Risk: {item.risk_level}</div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{item.diagnostic_signal}</p>
              <p className="text-xs text-emerald-300 leading-relaxed">
                Recommended Maintenance: {item.recommended_action}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
              <span className="font-mono text-slate-400">Status: {item.status}</span>
              <div className="flex items-center gap-2">
                {item.status !== 'Scheduled' && (
                  <button
                    disabled={busyId === item.id}
                    onClick={() => void updateStatus(item.id, 'Scheduled')}
                    className="rounded-lg border border-slate-700 hover:border-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 cursor-pointer"
                  >
                    Schedule Service
                  </button>
                )}
                {item.status !== 'Resolved' && (
                  <button
                    disabled={busyId === item.id}
                    onClick={() => void updateStatus(item.id, 'Resolved')}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                  >
                    Mark Resolved
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
