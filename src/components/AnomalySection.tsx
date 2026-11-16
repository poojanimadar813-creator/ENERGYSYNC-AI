import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { EnergyAlert } from '../types/energy.ts';

interface AnomaliesResponse {
  alerts: (EnergyAlert & { building_category?: string })[];
  summary: {
    total_alerts: number;
    active_alerts: number;
    high_severity: number;
    total_wastage_kwh: number;
  };
}

interface AnomalySectionProps {
  onDataChanged: () => void;
}

export const AnomalySection: React.FC<AnomalySectionProps> = ({ onDataChanged }) => {
  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Resolved'>('All');
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<AnomaliesResponse>('/api/energy/anomalies');
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, []);

  const updateAlertStatus = async (id: number, status: 'Acknowledged' | 'Resolved' | 'Active') => {
    await apiFetch(`/api/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    await loadAlerts();
    onDataChanged();
  };

  const filtered = (data?.alerts ?? []).filter((a) => {
    if (filter === 'Active') return a.status !== 'Resolved';
    if (filter === 'Resolved') return a.status === 'Resolved';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Isolation Forest Energy Wastage Detection
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Unsupervised anomaly scoring across empty classrooms, after-hours equipment, holiday draw, and unexpected lab surges.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D1526] border border-slate-800">
          {(['All', 'Active', 'Resolved'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filter === tab ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab} Alerts
            </button>
          ))}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Total Detected Anomalies</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {data?.summary.total_alerts ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Active Unresolved Alerts</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-rose-400">
            {data?.summary.active_alerts ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">High Severity Flags</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-amber-300">
            {data?.summary.high_severity ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Estimated Wastage Identified</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {data?.summary.total_wastage_kwh ?? 0} kWh
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
          Running Isolation Forest tree path scoring...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-10 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <div className="text-sm font-medium text-white">No matching alerts in this view</div>
          <p className="text-xs text-slate-400">
            Run a new energy simulation scenario from the top bar to test anomaly detection on fresh conditions.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((alert) => {
            const excess = Math.max(0, alert.detected_kwh - alert.expected_kwh).toFixed(1);
            return (
              <div
                key={alert.id}
                className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <ShieldAlert
                      className={`w-4 h-4 shrink-0 ${
                        alert.severity === 'High'
                          ? 'text-rose-400'
                          : alert.severity === 'Medium'
                            ? 'text-amber-300'
                            : 'text-slate-300'
                      }`}
                    />
                    <span className="font-display text-sm font-semibold text-white">
                      {alert.building_name}
                    </span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="font-mono text-slate-400">
                      {alert.timestamp.replace('T', ' ')}
                    </span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span
                      className={`font-mono font-medium ${
                        alert.severity === 'High' ? 'text-rose-400' : 'text-amber-300'
                      }`}
                    >
                      {alert.severity} Severity (iForest Score {alert.anomaly_score})
                    </span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="font-mono text-slate-400">{alert.data_source}</span>
                  </div>

                  <p className="text-sm text-slate-200">{alert.reason}</p>
                  <p className="text-xs text-emerald-300">
                    Suggested Action: {alert.suggested_action}
                  </p>
                </div>

                <div className="flex flex-wrap lg:flex-col items-end justify-between gap-3 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-3 lg:pt-0 lg:pl-5">
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-sm font-semibold text-rose-400">
                      {alert.detected_kwh} kWh detected
                    </div>
                    <div className="text-xs text-slate-400">
                      Expected {alert.expected_kwh} kWh (+{excess} kWh excess)
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.status !== 'Resolved' ? (
                      <>
                        {alert.status === 'Active' && (
                          <button
                            onClick={() => updateAlertStatus(alert.id, 'Acknowledged')}
                            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => updateAlertStatus(alert.id, 'Resolved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Mark Resolved
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => updateAlertStatus(alert.id, 'Active')}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-white cursor-pointer whitespace-nowrap"
                      >
                        Resolved · Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
