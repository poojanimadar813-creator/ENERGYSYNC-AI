import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { PlusCircle } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { Building, DataSourceLabel } from '../types/energy.ts';

interface BuildingWithMetrics extends Building {
  today_kwh: number;
  peak_kw: number;
  avg_hourly_kwh: number;
  historical_total_kwh: number;
}

interface ConsumptionResponse {
  today_date: string;
  building_id: number | null;
  today_hourly: Array<{
    hour: number;
    consumption_kwh: number;
    occupancy_count: number;
    temperature_c: number;
    data_source: DataSourceLabel;
  }>;
  daily_history: Array<{
    date: string;
    total_kwh: number;
    peak_kw: number;
  }>;
}

interface MonitoringSectionProps {
  onDataChanged: () => void;
}

export const MonitoringSection: React.FC<MonitoringSectionProps> = ({ onDataChanged }) => {
  const [buildings, setBuildings] = useState<BuildingWithMetrics[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual / IoT meter ingestion form
  const [ingestBuildingId, setIngestBuildingId] = useState<number>(1);
  const [ingestKwh, setIngestKwh] = useState<string>('28.5');
  const [ingestOcc, setIngestOcc] = useState<string>('42');
  const [ingestSource, setIngestSource] = useState<DataSourceLabel>('LIVE SENSOR DATA');
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async (bldgId: number | null) => {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        apiFetch<{ buildings: BuildingWithMetrics[] }>('/api/buildings'),
        apiFetch<ConsumptionResponse>(
          `/api/energy/consumption?days=10${bldgId ? `&building_id=${bldgId}` : ''}`
        ),
      ]);
      setBuildings(bRes.buildings);
      setConsumption(cRes);
      if (bRes.buildings.length > 0 && !ingestBuildingId) {
        setIngestBuildingId(bRes.buildings[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(selectedBuildingId);
  }, [selectedBuildingId]);

  const hourlyConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const rows = consumption?.today_hourly ?? [];
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => `${String(r.hour).padStart(2, '0')}:00`),
        datasets: [
          {
            label: 'Hourly Consumption (kWh)',
            data: rows.map((r) => r.consumption_kwh),
            backgroundColor: 'rgba(139, 92, 246, 0.72)',
            borderColor: '#A78BFA',
            borderWidth: 1,
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
  }, [consumption]);

  const comparisonConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    return {
      type: 'bar',
      data: {
        labels: buildings.map((b) => b.category),
        datasets: [
          {
            label: "Today's Consumption (kWh)",
            data: buildings.map((b) => b.today_kwh),
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderRadius: 4,
          },
          {
            label: 'Baseline Daily Target (kWh)',
            data: buildings.map((b) => b.baseline_daily_kwh),
            backgroundColor: 'rgba(100, 116, 139, 0.45)',
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
            ticks: { color: '#94A3B8', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [buildings]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setIngestMsg(null);
    try {
      const kwhVal = Number(ingestKwh);
      const occVal = Number(ingestOcc);
      await apiFetch('/api/energy/data', {
        method: 'POST',
        body: JSON.stringify({
          building_id: ingestBuildingId,
          consumption_kwh: kwhVal,
          occupancy_count: occVal,
          data_source: ingestSource,
        }),
      });
      setIngestMsg(`Recorded ${kwhVal} kWh (${ingestSource}) and updated AI models.`);
      await loadData(selectedBuildingId);
      onDataChanged();
    } catch (err) {
      setIngestMsg(err instanceof Error ? err.message : 'Failed to log reading.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Building-Wise Energy Monitoring
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect consumption in kWh, peak demand, and historical patterns across all five campus zones.
          </p>
        </div>

        {/* Interactive building filter tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0D1526] border border-slate-800">
          <button
            onClick={() => setSelectedBuildingId(null)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              selectedBuildingId === null
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Campus
          </button>
          {buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBuildingId(b.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedBuildingId === b.id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {b.category}
            </button>
          ))}
        </div>
      </div>

      {/* Building Table */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              <th className="py-3 px-4 font-medium">Building</th>
              <th className="py-3 px-4 font-medium">Category</th>
              <th className="py-3 px-4 font-medium text-right">Today (kWh)</th>
              <th className="py-3 px-4 font-medium text-right">Baseline (kWh)</th>
              <th className="py-3 px-4 font-medium text-right">Peak Load (kW)</th>
              <th className="py-3 px-4 font-medium text-right">15-Day Total (kWh)</th>
              <th className="py-3 px-4 font-medium text-right">Capacity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {buildings.map((b) => {
              const isSelected = selectedBuildingId === b.id;
              return (
                <tr
                  key={b.id}
                  onClick={() => setSelectedBuildingId(isSelected ? null : b.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? 'bg-violet-950/25' : 'hover:bg-slate-800/35'
                  }`}
                >
                  <td className="py-3 px-4 font-medium text-white">{b.name}</td>
                  <td className="py-3 px-4 text-slate-300">{b.category}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                    {b.today_kwh.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                    {b.baseline_daily_kwh.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-300">
                    {b.peak_kw} kW
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                    {b.historical_total_kwh.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                    {b.capacity_kw} kW
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            {selectedBuildingId
              ? `${buildings.find((b) => b.id === selectedBuildingId)?.name ?? 'Selected Building'} — Hourly Profile`
              : 'Campus-Wide Hourly Profile'}
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            {loading ? 'Loading telemetry...' : `Date ${consumption?.today_date ?? ''} · Hourly kWh load`}
          </p>
          <ChartCanvas config={hourlyConfig} height={270} />
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Building Consumption vs. Baseline Target
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Comparative daily load across academic, lab, library, seminar, and admin zones.
          </p>
          <ChartCanvas config={comparisonConfig} height={270} />
        </div>
      </div>

      {/* Live / Manual Smart Meter Telemetry Ingestion */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Smart Meter / ESP32 Telemetry Ingestion
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit a new meter reading via POST /api/energy/data. Recomputes ML predictions and anomaly alerts immediately.
            </p>
          </div>
        </div>

        <form onSubmit={handleIngest} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Building</label>
            <select
              value={ingestBuildingId}
              onChange={(e) => setIngestBuildingId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Energy Reading (kWh)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="500"
              required
              value={ingestKwh}
              onChange={(e) => setIngestKwh(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Occupancy Count</label>
            <input
              type="number"
              min="0"
              max="600"
              required
              value={ingestOcc}
              onChange={(e) => setIngestOcc(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Source Label</label>
            <select
              value={ingestSource}
              onChange={(e) => setIngestSource(e.target.value as DataSourceLabel)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="LIVE SENSOR DATA">LIVE SENSOR DATA</option>
              <option value="SIMULATED DATA">SIMULATED DATA</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{submitting ? 'Logging...' : 'Log Reading'}</span>
          </button>
        </form>

        {ingestMsg && (
          <div className="mt-3 text-xs text-emerald-400 font-medium">{ingestMsg}</div>
        )}
      </div>
    </div>
  );
};
