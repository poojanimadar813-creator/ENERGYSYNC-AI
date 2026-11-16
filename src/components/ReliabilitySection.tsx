import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import {
  CheckCircle2,
  DatabaseBackup,
  HardDriveDownload,
  Lock,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import {
  flushAllOfflineBuffers,
  getLocalOfflineQueue,
  queueLocalOfflineReading,
} from '../lib/offlineSync.ts';
import type { Building, SystemReliabilityOverview } from '../types/energy.ts';

interface ReliabilitySectionProps {
  onDataChanged?: () => void;
}

interface PrivacyCheckResult {
  authenticated_actor: string;
  role: string;
  assigned_college: string;
  scoped_college_record: { id: number; code: string; name: string; city: string } | null;
  cross_college_write_isolated: boolean;
}

export const ReliabilitySection: React.FC<ReliabilitySectionProps> = ({ onDataChanged }) => {
  const [overview, setOverview] = useState<SystemReliabilityOverview | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyCheckResult | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [localQueueCount, setLocalQueueCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Offline buffer form state
  const [deviceId, setDeviceId] = useState('ESP32-NODE-B1');
  const [buildingId, setBuildingId] = useState(1);
  const [consumptionKwh, setConsumptionKwh] = useState('28.4');
  const [occupancyCount, setOccupancyCount] = useState('42');
  const [temperatureC, setTemperatureC] = useState('29.5');

  const loadAll = useCallback(async () => {
    const [rel, priv, bldgs] = await Promise.all([
      apiFetch<SystemReliabilityOverview>('/api/advanced/reliability'),
      apiFetch<PrivacyCheckResult>('/api/advanced/privacy-check'),
      apiFetch<{ buildings: Building[] }>('/api/buildings'),
    ]);
    setOverview(rel);
    setPrivacy(priv);
    setBuildings(bldgs.buildings);
    setLocalQueueCount(getLocalOfflineQueue().length);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateBackup = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        snapshot: { filename: string; size_kb: number; created_at: string };
      }>('/api/advanced/backup', { method: 'POST' });
      setStatusMsg(`Created SQLite backup snapshot ${res.snapshot.filename} (${res.snapshot.size_kb} KB).`);
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Backup creation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyBackup = async (filename: string) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        verification: { filename: string; integrity: string; tables: number; energy_rows: number };
      }>('/api/advanced/backup/verify', {
        method: 'POST',
        body: JSON.stringify({ filename }),
      });
      setStatusMsg(
        `Verified ${res.verification.filename}: SQLite integrity=${res.verification.integrity} · ${res.verification.tables} tables · ${res.verification.energy_rows} energy records.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Snapshot verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleBufferServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      await apiFetch('/api/advanced/offline-buffer', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId,
          building_id: Number(buildingId),
          consumption_kwh: Number(consumptionKwh),
          occupancy_count: Number(occupancyCount),
          temperature_c: Number(temperatureC),
        }),
      });
      setStatusMsg(`Buffered validated reading from ${deviceId} awaiting automatic sync.`);
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Validation rejected buffered payload.');
    } finally {
      setBusy(false);
    }
  };

  const handleQueueBrowserOffline = () => {
    const kwh = Number(consumptionKwh);
    const temp = Number(temperatureC);
    if (Number.isNaN(kwh) || kwh < 0 || kwh > 500 || Number.isNaN(temp) || temp < -10 || temp > 65) {
      setErrorMsg('Sensor validation failed: consumption_kwh must be 0..500 and temperature_c -10..65.');
      return;
    }
    setErrorMsg(null);
    const next = queueLocalOfflineReading({
      device_id: deviceId.trim() || 'ESP32-NODE-LOCAL',
      building_id: Number(buildingId),
      consumption_kwh: kwh,
      occupancy_count: Math.max(0, Number(occupancyCount) || 0),
      temperature_c: temp,
    });
    setLocalQueueCount(next.length);
    setStatusMsg(`Queued reading in browser offline cache (${next.length} pending auto-sync).`);
  };

  const handleSyncAll = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await flushAllOfflineBuffers();
      setStatusMsg(res.message);
      await loadAll();
      onDataChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Buffer synchronization failed.');
    } finally {
      setBusy(false);
    }
  };

  const metricsChart = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!overview || overview.model_metrics_history.length === 0) return null;
    const ordered = [...overview.model_metrics_history].reverse();
    return {
      type: 'line',
      data: {
        labels: ordered.map((m, i) => `Run #${i + 1}`),
        datasets: [
          {
            label: 'Random Forest MAE (kWh)',
            data: ordered.map((m) => m.mae),
            borderColor: '#10B981',
            tension: 0.3,
            borderWidth: 2,
          },
          {
            label: 'Random Forest RMSE (kWh)',
            data: ordered.map((m) => m.rmse),
            borderColor: '#7C3AED',
            tension: 0.3,
            borderWidth: 2,
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
  }, [overview]);

  if (!overview) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Loading system reliability, backups, and security diagnostics...
      </div>
    );
  }

  const pendingServerCount = overview.offline_buffer.filter((r) => r.synced === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          System Reliability, Backups &amp; Offline Sync
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Database backup &amp; integrity verification, offline sensor buffering, schema migrations, ML drift monitoring, API rate limiting, and audit logs.
        </p>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/35 px-4 py-2.5 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Top Reliability KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>API Rate Limiter</span>
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {overview.rate_limiter.max_requests_per_window} req/{overview.rate_limiter.window_seconds}s
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            {overview.rate_limiter.tracked_clients} active client(s) · {overview.rate_limiter.blocked_requests} blocked
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <DatabaseBackup className="w-3.5 h-3.5 text-violet-400" />
            <span>Verified Backups</span>
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {overview.backups.length} snapshots
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Online SQLite `.backup()` engine
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <WifiOff className="w-3.5 h-3.5 text-amber-300" />
            <span>Offline Sync Queue</span>
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-amber-300">
            {pendingServerCount + localQueueCount} pending
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {pendingServerCount} server buffer · {localQueueCount} browser cache
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>College Privacy Isolation</span>
          </div>
          <div className="mt-1.5 font-display text-base font-semibold text-emerald-400">
            {overview.data_privacy.college_isolation_enforced ? 'Enforced' : 'Disabled'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            {privacy?.assigned_college ?? 'BLDEACET Vijayapura'}
          </div>
        </div>
      </div>

      {/* Backups + Offline Buffer Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                SQLite Database Backup &amp; Recovery
              </h3>
              <p className="text-xs text-slate-400">
                Create consistent point-in-time snapshots and verify `PRAGMA integrity_check`.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => void handleCreateBackup()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-3 py-2 text-xs font-medium text-white cursor-pointer shrink-0"
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              <span>Create Backup</span>
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {overview.backups.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-4 text-xs text-slate-400">
                No snapshots created yet. Click Create Backup to generate a verified SQLite recovery point.
              </div>
            ) : (
              overview.backups.map((b) => (
                <div
                  key={b.filename}
                  className="rounded-lg border border-slate-800 bg-[#080D1A] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-white truncate">{b.filename}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {b.size_kb} KB · {new Date(b.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => void handleVerifyBackup(b.filename)}
                    className="rounded-lg border border-slate-700 hover:border-emerald-500 px-2.5 py-1 text-[11px] font-medium text-emerald-300 cursor-pointer shrink-0"
                  >
                    Verify Snapshot
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Offline Data Buffering &amp; Auto-Sync
              </h3>
              <p className="text-xs text-slate-400">
                Validates sensor bounds (kWh 0–500, Temp -10–65°C) before buffering &amp; syncing.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => void handleSyncAll()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-2 text-xs font-medium text-white cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Buffer</span>
            </button>
          </div>

          <form onSubmit={handleBufferServer} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <label className="space-y-1">
              <span className="text-slate-400">Device ID</span>
              <input
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Building</span>
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-2.5 py-1.5 text-white"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Power (kWh)</span>
              <input
                type="number"
                step="0.1"
                value={consumptionKwh}
                onChange={(e) => setConsumptionKwh(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Occupancy</span>
              <input
                type="number"
                value={occupancyCount}
                onChange={(e) => setOccupancyCount(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Temp (°C)</span>
              <input
                type="number"
                step="0.1"
                value={temperatureC}
                onChange={(e) => setTemperatureC(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-[#080D1A] px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg border border-violet-500/40 bg-violet-600/20 hover:bg-violet-600/35 px-2.5 py-1.5 text-xs font-medium text-violet-200 cursor-pointer"
              >
                Buffer Server
              </button>
              <button
                type="button"
                onClick={handleQueueBrowserOffline}
                className="w-full rounded-lg border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 text-xs font-medium text-slate-300 cursor-pointer"
              >
                Queue Local
              </button>
            </div>
          </form>

          {overview.offline_buffer.length > 0 && (
            <div className="max-h-36 overflow-y-auto border-t border-slate-800 pt-2 space-y-1.5 text-[11px] font-mono">
              {overview.offline_buffer.slice(0, 6).map((row) => (
                <div key={row.id} className="flex items-center justify-between text-slate-300">
                  <span>
                    {row.device_id} · Bldg #{row.building_id} · {row.consumption_kwh} kWh
                  </span>
                  <span className={row.synced ? 'text-emerald-400' : 'text-amber-300'}>
                    {row.synced ? 'SYNCED' : 'BUFFERED'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ML Performance Monitoring + Migrations & Privacy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            ML Model Performance Monitoring (MAE &amp; RMSE History)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Continuous Random Forest accuracy tracking across simulation scenarios.
          </p>
          {metricsChart && <ChartCanvas config={metricsChart} height={240} />}
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-4">
          <h3 className="font-display text-base font-semibold text-white">
            Versioned Database Migrations &amp; Security Controls
          </h3>
          <div className="space-y-2 text-xs">
            {overview.migrations.map((m) => (
              <div
                key={m.version}
                className="rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono text-emerald-400">{m.version}</span>
                  <span className="text-slate-300 ml-2">{m.description}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">Applied</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3 text-[11px] space-y-1 text-slate-300 font-mono">
            <div>Password Hash: {overview.data_privacy.password_hashing}</div>
            <div>Token Auth: {overview.data_privacy.token_signing}</div>
            <div>Sensor Bounds: {overview.data_privacy.validated_sensor_bounds}</div>
          </div>
        </div>
      </div>

      {/* Audit Logging */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 overflow-x-auto">
        <h3 className="font-display text-base font-semibold text-white mb-3">
          System Audit Trail
        </h3>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2 px-3 font-medium">Timestamp</th>
              <th className="py-2 px-3 font-medium">Actor</th>
              <th className="py-2 px-3 font-medium">Action</th>
              <th className="py-2 px-3 font-medium">Resource</th>
              <th className="py-2 px-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono text-[11px]">
            {overview.audit_logs.slice(0, 12).map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/30">
                <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{log.created_at}</td>
                <td className="py-2 px-3 text-slate-200">{log.actor_email}</td>
                <td className="py-2 px-3 text-violet-300">{log.action}</td>
                <td className="py-2 px-3 text-slate-300">{log.resource}</td>
                <td className="py-2 px-3 font-sans text-slate-400">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
